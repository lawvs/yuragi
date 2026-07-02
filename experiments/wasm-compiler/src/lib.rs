use std::collections::BTreeMap;
use std::sync::Mutex;

use anyhow::Context;
use serde::Serialize;

#[path = "../../../packages/compiler/native/src/direction.rs"]
mod direction;
#[path = "../../../packages/compiler/native/src/font.rs"]
mod font;

static FONT_BYTES: Mutex<Option<Vec<u8>>> = Mutex::new(None);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiResponse<T: Serialize> {
    ok: bool,
    value: Option<T>,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FontLoadInfo {
    bytes: usize,
    units_per_em: u16,
}

fn axis_tag(tag: &str) -> anyhow::Result<ttf_parser::Tag> {
    let bytes = tag.as_bytes();
    if bytes.len() != 4 {
        anyhow::bail!("variation axis tag \"{}\" must be exactly 4 bytes", tag);
    }

    Ok(ttf_parser::Tag::from_bytes(&[
        bytes[0], bytes[1], bytes[2], bytes[3],
    ]))
}

fn parse_axes(input: &str) -> anyhow::Result<BTreeMap<String, f32>> {
    if input.trim().is_empty() {
        return Ok(BTreeMap::new());
    }

    serde_json::from_str(input).context("failed to parse axes JSON")
}

fn response<T: Serialize>(value: anyhow::Result<T>, out_len: *mut usize) -> *mut u8 {
    let payload = match value {
        Ok(value) => ApiResponse {
            ok: true,
            value: Some(value),
            error: None,
        },
        Err(error) => ApiResponse::<T> {
            ok: false,
            value: None,
            error: Some(error.to_string()),
        },
    };

    let bytes = serde_json::to_vec(&payload).unwrap_or_else(|error| {
        format!(
            "{{\"ok\":false,\"value\":null,\"error\":\"failed to serialize response: {}\"}}",
            error
        )
        .into_bytes()
    });
    let len = bytes.len();
    let mut boxed = bytes.into_boxed_slice();
    let ptr = boxed.as_mut_ptr();
    std::mem::forget(boxed);

    unsafe {
        *out_len = len;
    }

    ptr
}

unsafe fn read_bytes<'a>(ptr: *const u8, len: usize) -> anyhow::Result<&'a [u8]> {
    if ptr.is_null() && len > 0 {
        anyhow::bail!("received null pointer for non-empty input");
    }

    Ok(std::slice::from_raw_parts(ptr, len))
}

unsafe fn read_str<'a>(ptr: *const u8, len: usize, label: &str) -> anyhow::Result<&'a str> {
    std::str::from_utf8(read_bytes(ptr, len)?)
        .with_context(|| format!("{} is not valid UTF-8", label))
}

fn set_font(bytes: &[u8]) -> anyhow::Result<FontLoadInfo> {
    let face = ttf_parser::Face::parse(bytes, 0).context("failed to parse font")?;
    let units_per_em = face.units_per_em();

    *FONT_BYTES
        .lock()
        .map_err(|_| anyhow::anyhow!("font store lock is poisoned"))? = Some(bytes.to_vec());

    Ok(FontLoadInfo {
        bytes: bytes.len(),
        units_per_em,
    })
}

fn compile_title(text: &str, axes_input: &str) -> anyhow::Result<font::TextOutline> {
    let font = FONT_BYTES
        .lock()
        .map_err(|_| anyhow::anyhow!("font store lock is poisoned"))?;
    let font = font
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("font has not been loaded"))?;
    let axes = parse_axes(axes_input)?;
    let mut face = ttf_parser::Face::parse(font, 0).context("failed to parse font")?;

    for (tag, value) in axes.iter() {
        face.set_variation(axis_tag(tag)?, *value);
    }

    font::parse_text(text, &face)
}

#[no_mangle]
pub extern "C" fn yuragi_alloc(len: usize) -> *mut u8 {
    let mut bytes = Vec::<u8>::with_capacity(len);
    let ptr = bytes.as_mut_ptr();
    std::mem::forget(bytes);
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn yuragi_free(ptr: *mut u8, len: usize) {
    if ptr.is_null() {
        return;
    }

    let _ = Vec::from_raw_parts(ptr, 0, len);
}

#[no_mangle]
pub unsafe extern "C" fn yuragi_set_font(
    font_ptr: *const u8,
    font_len: usize,
    out_len: *mut usize,
) -> *mut u8 {
    response(read_bytes(font_ptr, font_len).and_then(set_font), out_len)
}

#[no_mangle]
pub unsafe extern "C" fn yuragi_compile_title(
    text_ptr: *const u8,
    text_len: usize,
    axes_ptr: *const u8,
    axes_len: usize,
    out_len: *mut usize,
) -> *mut u8 {
    let result = read_str(text_ptr, text_len, "text").and_then(|text| {
        read_str(axes_ptr, axes_len, "axes").and_then(|axes| compile_title(text, axes))
    });

    response(result, out_len)
}
