use std::collections::BTreeMap;
use std::path::PathBuf;

use anyhow::Context;
use clap::Parser;
use serde::Serialize;
use sha2::{Digest, Sha256};

mod direction;
mod font;

#[derive(Parser)]
struct Args {
    #[arg(long)]
    font: PathBuf,
    #[arg(long)]
    titles: PathBuf,
    #[arg(long)]
    axes: Option<String>,
}

#[derive(Serialize)]
struct Bundle {
    version: u8,
    font: FontInfo,
    outlines: BTreeMap<String, font::TextOutline>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FontInfo {
    source: String,
    axes: BTreeMap<String, f32>,
    units_per_em: u16,
    hash: String,
}

fn parse_axes(input: Option<String>) -> anyhow::Result<BTreeMap<String, f32>> {
    match input {
        Some(json) => serde_json::from_str(&json).context("failed to parse --axes JSON"),
        None => Ok(BTreeMap::new()),
    }
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    let titles_json = std::fs::read_to_string(&args.titles)
        .with_context(|| format!("failed to read titles file {}", args.titles.display()))?;
    let titles: Vec<String> =
        serde_json::from_str(&titles_json).context("failed to parse titles JSON")?;

    let font_buf = std::fs::read(&args.font)
        .with_context(|| format!("failed to read font {}", args.font.display()))?;
    let hash = format!("{:x}", Sha256::digest(&font_buf));
    let axes = parse_axes(args.axes)?;

    let font = font::FontInstance::new(&font_buf, &axes)?;

    let outlines = titles
        .iter()
        .map(|title| {
            font.parse_text(title)
                .map(|outline| (title.clone(), outline))
        })
        .collect::<anyhow::Result<BTreeMap<_, _>>>()?;

    let bundle = Bundle {
        version: 1,
        font: FontInfo {
            source: args.font.to_string_lossy().into_owned(),
            axes,
            units_per_em: font.units_per_em(),
            hash,
        },
        outlines,
    };

    println!("{}", serde_json::to_string(&bundle)?);
    Ok(())
}
