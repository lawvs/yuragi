use std::collections::{BTreeMap, HashSet};

use anyhow::Context;
use itertools::Itertools;
use lyon_path::PathEvent;
use serde::Serialize;
use skrifa::instance::{Location, Size};
use skrifa::outline::{DrawSettings, OutlinePen};
use skrifa::setting::VariationSetting;
use skrifa::{FontRef, MetadataProvider, Tag};

use crate::direction;

#[derive(Serialize, PartialEq, Clone, Debug)]
#[serde(rename_all = "lowercase")]
#[serde(tag = "ty", content = "spec")]
enum OutlineCmd {
    Move(f64, f64),
    Line(f64, f64),
    Quad {
        to: (f64, f64),
        ctrl: (f64, f64),
    },
    Cubic {
        to: (f64, f64),
        ctrl_first: (f64, f64),
        ctrl_second: (f64, f64),
    },
    Close,
}

impl OutlineCmd {
    fn dst_pt(&self) -> Option<(f64, f64)> {
        match self {
            OutlineCmd::Move(x, y) => Some((*x, *y)),
            OutlineCmd::Line(x, y) => Some((*x, *y)),
            OutlineCmd::Quad { to, .. } => Some(*to),
            OutlineCmd::Cubic { to, .. } => Some(*to),
            OutlineCmd::Close => None,
        }
    }

    fn may_be_inside(&self, path: impl Iterator<Item = PathEvent>) -> bool {
        match self.dst_pt() {
            None => true,
            Some((x, y)) => lyon_algorithms::hit_test::hit_test_path(
                &(x as f32, y as f32).into(),
                path,
                lyon_path::FillRule::EvenOdd,
                1e-5,
            ),
        }
    }
}

type Outline = Vec<OutlineCmd>;

#[derive(Serialize, Clone, Copy, Debug)]
pub struct GlyphBBox {
    pub top: i16,
    pub bottom: i16,
    pub left: i16,
    pub right: i16,
}

#[derive(Serialize, Clone, Debug)]
pub struct Shard {
    pub path: String,
    pub direction: (f32, f32),
}

#[derive(Serialize, Clone, Debug)]
pub struct ShardGlyph {
    pub char: char,
    pub advance: u16,
    pub bbox: GlyphBBox,
    pub shards: Vec<Shard>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ShardGroup {
    pub text: String,
    pub advance: u64,
    pub break_after: bool,
    pub glyphs: Vec<ShardGlyph>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TextOutline {
    pub em: u16,
    pub ascender: i16,
    pub descender: i16,
    pub groups: Vec<ShardGroup>,
}

pub struct FontInstance<'a> {
    face: FontRef<'a>,
    location: Location,
}

impl<'a> FontInstance<'a> {
    pub fn new(bytes: &'a [u8], axes: &BTreeMap<String, f32>) -> anyhow::Result<Self> {
        let face = parse_font(bytes)?;
        let settings = axes
            .iter()
            .map(|(tag, value)| axis_tag(tag).map(|tag| VariationSetting::new(tag, *value)))
            .collect::<anyhow::Result<Vec<_>>>()?;
        let location = face.axes().location(settings);

        Ok(Self { face, location })
    }

    pub fn units_per_em(&self) -> u16 {
        self.face
            .metrics(Size::unscaled(), &self.location)
            .units_per_em
    }

    pub fn parse_text(&self, text: &str) -> anyhow::Result<TextOutline> {
        parse_text(text, self)
    }
}

fn parse_font(bytes: &[u8]) -> anyhow::Result<FontRef<'_>> {
    FontRef::from_index(bytes, 0).context("failed to parse font")
}

fn axis_tag(tag: &str) -> anyhow::Result<Tag> {
    let bytes = tag.as_bytes();
    if bytes.len() != 4 {
        anyhow::bail!("variation axis tag \"{}\" must be exactly 4 bytes", tag);
    }

    Ok(Tag::new(&[bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn serialize_outline(outline: &Outline) -> String {
    let mut ret = String::new();
    for cmd in outline {
        match cmd {
            OutlineCmd::Move(x, y) => {
                ret.push_str(&format!("M {} {}", x, -y));
            }
            OutlineCmd::Line(x, y) => {
                ret.push_str(&format!("L {} {}", x, -y));
            }
            OutlineCmd::Quad { to, ctrl } => {
                ret.push_str(&format!("Q {} {} {} {}", ctrl.0, -ctrl.1, to.0, -to.1));
            }
            OutlineCmd::Cubic {
                to,
                ctrl_first,
                ctrl_second,
            } => {
                ret.push_str(&format!(
                    "C {} {} {} {} {} {}",
                    ctrl_first.0, -ctrl_first.1, ctrl_second.0, -ctrl_second.1, to.0, -to.1
                ));
            }
            OutlineCmd::Close => {
                ret.push('Z');
            }
        }
    }
    ret
}

fn split_closed_loop<I: Iterator<Item = OutlineCmd>>(outline: I) -> Vec<Outline> {
    let mut output = Vec::new();
    let mut cur = Vec::new();

    for cmd in outline {
        let is_close = cmd == OutlineCmd::Close;
        cur.push(cmd);
        if is_close {
            output.push(cur);
            cur = Vec::new();
        }
    }

    if !cur.is_empty() {
        cur.push(OutlineCmd::Close);
        output.push(cur);
    }

    output
}

fn component_to_lyon_path_ev<I: Iterator<Item = OutlineCmd>>(
    outline: I,
) -> impl Iterator<Item = PathEvent> {
    let mut start = (0.0, 0.0).into();
    let mut last = (0.0, 0.0).into();
    outline.map(move |cmd| match cmd {
        OutlineCmd::Move(x, y) => {
            start = (x as f32, y as f32).into();
            last = (x as f32, y as f32).into();
            PathEvent::Begin {
                at: (x as f32, y as f32).into(),
            }
        }
        OutlineCmd::Line(x, y) => {
            let current = (x as f32, y as f32).into();
            let output = PathEvent::Line {
                from: last,
                to: current,
            };
            last = current;
            output
        }
        OutlineCmd::Quad { to, ctrl } => {
            let current = (to.0 as f32, to.1 as f32).into();
            let output = PathEvent::Quadratic {
                from: last,
                to: current,
                ctrl: (ctrl.0 as f32, ctrl.1 as f32).into(),
            };
            last = current;
            output
        }
        OutlineCmd::Cubic {
            to,
            ctrl_first,
            ctrl_second,
        } => {
            let current = (to.0 as f32, to.1 as f32).into();
            let output = PathEvent::Cubic {
                from: last,
                to: current,
                ctrl1: (ctrl_first.0 as f32, ctrl_first.1 as f32).into(),
                ctrl2: (ctrl_second.0 as f32, ctrl_second.1 as f32).into(),
            };
            last = current;
            output
        }
        OutlineCmd::Close => {
            let output = PathEvent::End {
                last,
                first: start,
                close: true,
            };
            start = (0.0, 0.0).into();
            last = (0.0, 0.0).into();
            output
        }
    })
}

fn collect_outline(
    id: usize,
    outlines: &[Outline],
    children: &[Vec<usize>],
    collect: &mut Vec<Outline>,
) {
    let mut current = outlines[id].clone();
    for child in children[id].iter() {
        current.extend(outlines[*child].iter().cloned());
        for double_child in children[*child].iter() {
            collect_outline(*double_child, outlines, children, collect);
        }
    }
    collect.push(current);
}

fn split_components(input: Outline) -> Vec<Outline> {
    let loops = split_closed_loop(input.into_iter());
    let mut inside: Vec<HashSet<usize>> = loops.iter().map(|_| HashSet::new()).collect();

    for i in 0..loops.len() {
        for j in 0..loops.len() {
            if i == j {
                continue;
            }

            let i_inside_j = loops[i]
                .iter()
                .all(|cmd| cmd.may_be_inside(component_to_lyon_path_ev(loops[j].iter().cloned())));
            if i_inside_j {
                inside[i].insert(j);
            }
        }
    }

    let mut processed: Vec<bool> = loops.iter().map(|_| false).collect();
    let mut is_root: Vec<bool> = loops.iter().map(|_| true).collect();
    let mut children: Vec<Vec<usize>> = loops.iter().map(|_| Vec::new()).collect();

    loop {
        let mut selected = None;
        for i in 0..inside.len() {
            if inside[i].is_empty() && !processed[i] {
                selected = Some(i);
                break;
            }
        }

        let selected = if let Some(inner) = selected {
            inner
        } else {
            break;
        };

        for i in 0..inside.len() {
            if inside[i].remove(&selected) && inside[i].is_empty() {
                children[selected].push(i);
                is_root[i] = false;
            }
        }

        processed[selected] = true;
    }

    let mut collected = Vec::new();
    for i in 0..loops.len() {
        if is_root[i] {
            collect_outline(i, &loops, &children, &mut collected);
        }
    }

    collected
}

#[derive(Default)]
struct OutlineBuilder {
    outline: Outline,
    bounds: Option<(f32, f32, f32, f32)>,
}

impl OutlineBuilder {
    fn include(&mut self, x: f32, y: f32) {
        self.bounds = Some(match self.bounds {
            Some((x_min, y_min, x_max, y_max)) => {
                (x_min.min(x), y_min.min(y), x_max.max(x), y_max.max(y))
            }
            None => (x, y, x, y),
        });
    }

    fn glyph_bbox(&self) -> anyhow::Result<GlyphBBox> {
        let Some((x_min, y_min, x_max, y_max)) = self.bounds else {
            return Ok(GlyphBBox {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
            });
        };

        let x_min = checked_i16(x_min).context("glyph bbox x_min is out of range")?;
        let y_min = checked_i16(y_min).context("glyph bbox y_min is out of range")?;
        let x_max = checked_i16(x_max).context("glyph bbox x_max is out of range")?;
        let y_max = checked_i16(y_max).context("glyph bbox y_max is out of range")?;

        Ok(GlyphBBox {
            top: -y_max,
            bottom: -y_min,
            left: x_min,
            right: x_max,
        })
    }
}

impl OutlinePen for OutlineBuilder {
    fn move_to(&mut self, x: f32, y: f32) {
        self.include(x, y);
        self.outline.push(OutlineCmd::Move(x as f64, y as f64));
    }

    fn line_to(&mut self, x: f32, y: f32) {
        self.include(x, y);
        self.outline.push(OutlineCmd::Line(x as f64, y as f64));
    }

    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.include(x1, y1);
        self.include(x, y);
        self.outline.push(OutlineCmd::Quad {
            to: (x as f64, y as f64),
            ctrl: (x1 as f64, y1 as f64),
        });
    }

    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.include(x1, y1);
        self.include(x2, y2);
        self.include(x, y);
        self.outline.push(OutlineCmd::Cubic {
            to: (x as f64, y as f64),
            ctrl_first: (x1 as f64, y1 as f64),
            ctrl_second: (x2 as f64, y2 as f64),
        });
    }

    fn close(&mut self) {
        self.outline.push(OutlineCmd::Close);
    }
}

fn checked_i16(value: f32) -> Option<i16> {
    (value.is_finite() && value >= i16::MIN as f32 && value <= i16::MAX as f32)
        .then(|| value as i16)
}

fn checked_u16(value: f32) -> Option<u16> {
    let value = value.round();
    (value.is_finite() && value >= 0.0 && value <= u16::MAX as f32).then(|| value as u16)
}

pub fn parse_char(c: char, font: &FontInstance) -> anyhow::Result<ShardGlyph> {
    let glyph = font
        .face
        .charmap()
        .map(c)
        .ok_or_else(|| anyhow::anyhow!("Glyph \"{}\" not found in font", c))?;
    let mut builder = OutlineBuilder::default();

    if let Some(outline) = font.face.outline_glyphs().get(glyph) {
        outline
            .draw(
                DrawSettings::unhinted(Size::unscaled(), &font.location),
                &mut builder,
            )
            .with_context(|| format!("failed to draw glyph '{}'", c))?;
    }

    let bbox = builder.glyph_bbox()?;

    let advance = font
        .face
        .glyph_metrics(Size::unscaled(), &font.location)
        .advance_width(glyph)
        .and_then(checked_u16)
        .ok_or_else(|| anyhow::anyhow!("Glyph '{}' has no outline and hor adv", c))?;

    let mut components = split_components(builder.outline);
    components.sort_by(|a, b| {
        let a_bbox: lyon_path::geom::euclid::Box2D<f32, lyon_path::geom::euclid::UnknownUnit> =
            lyon_algorithms::aabb::bounding_box(component_to_lyon_path_ev(a.iter().cloned()));
        let b_bbox: lyon_path::geom::euclid::Box2D<f32, lyon_path::geom::euclid::UnknownUnit> =
            lyon_algorithms::aabb::bounding_box(component_to_lyon_path_ev(b.iter().cloned()));
        a_bbox.min.x.partial_cmp(&b_bbox.min.x).unwrap()
    });

    let shards = components
        .iter()
        .map(|component| {
            let path = serialize_outline(component);
            let direction = direction::compute_direction(
                &lyon_path::Path::from_iter(component_to_lyon_path_ev(component.iter().cloned())),
                1e-1,
            );
            Shard { path, direction }
        })
        .collect();

    Ok(ShardGlyph {
        char: c,
        advance,
        bbox,
        shards,
    })
}

fn parse_text(text: &str, font: &FontInstance) -> anyhow::Result<TextOutline> {
    use unicode_segmentation::UnicodeSegmentation;

    let mut segmented: BTreeMap<usize, bool> = text
        .split_word_bound_indices()
        .map(|(i, _)| (i, false))
        .collect();

    for (i, opportunity) in unicode_linebreak::linebreaks(text) {
        if opportunity == unicode_linebreak::BreakOpportunity::Allowed || i == text.len() {
            segmented.insert(i, true);
        } else {
            anyhow::bail!(
                "unexpected mandatory line break at byte {} before end of text {:?}",
                i,
                text
            );
        }
    }

    let segs = segmented
        .iter()
        .tuple_windows()
        .map(|((aptr, _), (bptr, break_after))| (&text[*aptr..*bptr], *break_after));

    let groups = segs
        .map(|(s, break_after)| -> anyhow::Result<ShardGroup> {
            let glyphs = s
                .chars()
                .map(|c| parse_char(c, font))
                .collect::<anyhow::Result<Vec<_>>>()?;
            let advance = glyphs.iter().map(|glyph| glyph.advance as u64).sum();
            Ok(ShardGroup {
                text: s.to_string(),
                advance,
                break_after,
                glyphs,
            })
        })
        .collect::<anyhow::Result<Vec<_>>>()?;

    let metrics = font.face.metrics(Size::unscaled(), &font.location);

    Ok(TextOutline {
        em: metrics.units_per_em,
        ascender: checked_i16(metrics.ascent).context("font ascender is out of range")?,
        descender: checked_i16(metrics.descent).context("font descender is out of range")?,
        groups,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_font_collection() -> Vec<u8> {
        vec![
            b't', b't', b'c', b'f', 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 16, 0, 1, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0,
        ]
    }

    #[test]
    fn loads_the_first_face_from_a_font_collection() {
        let bytes = empty_font_collection();
        let face = parse_font(&bytes).unwrap();

        assert_eq!(face.ttc_index(), Some(0));
    }

    #[test]
    fn rejects_axis_tags_that_are_not_exactly_four_bytes() {
        let error = axis_tag("wgt").unwrap_err();

        assert_eq!(
            error.to_string(),
            "variation axis tag \"wgt\" must be exactly 4 bytes"
        );
    }
}
