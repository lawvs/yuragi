use std::collections::BTreeMap;
use std::sync::Mutex;

use anyhow::Context;
use serde::Serialize;
use yuragi_compiler::{FontInstance, TextOutline};

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

fn parse_axes(input: &str) -> anyhow::Result<BTreeMap<String, f32>> {
    if input.trim().is_empty() {
        return Ok(BTreeMap::new());
    }

    serde_json::from_str(input).context("failed to parse axes JSON")
}

fn response_bytes<T: Serialize>(value: anyhow::Result<T>) -> Vec<u8> {
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

    serde_json::to_vec(&payload).unwrap_or_else(|error| {
        format!(
            "{{\"ok\":false,\"value\":null,\"error\":\"failed to serialize response: {}\"}}",
            error
        )
        .into_bytes()
    })
}

unsafe fn write_response<T: Serialize>(value: anyhow::Result<T>, out_len: *mut usize) -> *mut u8 {
    if out_len.is_null() {
        return std::ptr::null_mut();
    }

    let bytes = response_bytes(value);
    let len = bytes.len();
    let mut boxed = bytes.into_boxed_slice();
    let ptr = boxed.as_mut_ptr();

    // SAFETY: `out_len` was checked for null above. The JS/WASM ABI requires
    // callers to pass a writable pointer allocated from this module's memory.
    unsafe {
        *out_len = len;
    }

    std::mem::forget(boxed);
    ptr
}

unsafe fn read_bytes<'a>(ptr: *const u8, len: usize) -> anyhow::Result<&'a [u8]> {
    if len == 0 {
        return Ok(&[]);
    }

    if ptr.is_null() {
        anyhow::bail!("received null pointer for non-empty input");
    }

    // SAFETY: The caller guarantees `ptr` points to `len` readable bytes in
    // this module's linear memory. The null and zero-length cases are handled
    // above before constructing the slice.
    Ok(unsafe { std::slice::from_raw_parts(ptr, len) })
}

unsafe fn read_str<'a>(ptr: *const u8, len: usize, label: &str) -> anyhow::Result<&'a str> {
    // SAFETY: `read_str` has the same pointer validity requirements as
    // `read_bytes`; UTF-8 validity is checked by `from_utf8` below.
    std::str::from_utf8(unsafe { read_bytes(ptr, len)? })
        .with_context(|| format!("{} is not valid UTF-8", label))
}

unsafe fn set_font_from_raw(font_ptr: *const u8, font_len: usize) -> anyhow::Result<FontLoadInfo> {
    // SAFETY: The exported ABI requires JS to pass a valid font byte buffer.
    unsafe { read_bytes(font_ptr, font_len) }.and_then(set_font)
}

unsafe fn compile_title_from_raw(
    text_ptr: *const u8,
    text_len: usize,
    axes_ptr: *const u8,
    axes_len: usize,
) -> anyhow::Result<TextOutline> {
    // SAFETY: The exported ABI requires JS to pass valid UTF-8 buffers for
    // both text and axes JSON.
    let text = unsafe { read_str(text_ptr, text_len, "text") }?;
    let axes = unsafe { read_str(axes_ptr, axes_len, "axes") }?;

    compile_title(text, axes)
}

fn set_font(bytes: &[u8]) -> anyhow::Result<FontLoadInfo> {
    let font = FontInstance::new(bytes, &BTreeMap::new())?;
    let units_per_em = font.units_per_em();

    *FONT_BYTES
        .lock()
        .map_err(|_| anyhow::anyhow!("font store lock is poisoned"))? = Some(bytes.to_vec());

    Ok(FontLoadInfo {
        bytes: bytes.len(),
        units_per_em,
    })
}

fn compile_title(text: &str, axes_input: &str) -> anyhow::Result<TextOutline> {
    let font = FONT_BYTES
        .lock()
        .map_err(|_| anyhow::anyhow!("font store lock is poisoned"))?;
    let font = font
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("font has not been loaded"))?;
    let axes = parse_axes(axes_input)?;
    FontInstance::new(font, &axes)?.parse_text(text)
}

// SAFETY: The exported symbol names below are reserved for the JS/WASM ABI.
#[unsafe(no_mangle)]
pub extern "C" fn yuragi_alloc(len: usize) -> *mut u8 {
    let mut bytes = Vec::<u8>::with_capacity(len);
    let ptr = bytes.as_mut_ptr();
    std::mem::forget(bytes);
    ptr
}

// SAFETY: `yuragi_free` is a unique exported symbol in the JS/WASM ABI.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn yuragi_free(ptr: *mut u8, len: usize) {
    if ptr.is_null() {
        return;
    }

    // SAFETY: JS must pass a pointer previously returned by `yuragi_alloc` or
    // `write_response`, with the same allocation length. Rebuilding the Vec
    // lets Rust drop and deallocate that allocation.
    let _ = unsafe { Vec::from_raw_parts(ptr, 0, len) };
}

// SAFETY: `yuragi_set_font` is a unique exported symbol in the JS/WASM ABI.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn yuragi_set_font(
    font_ptr: *const u8,
    font_len: usize,
    out_len: *mut usize,
) -> *mut u8 {
    // SAFETY: The JS/WASM ABI supplies the raw font input and output-length
    // pointer from this module's linear memory.
    unsafe { write_response(set_font_from_raw(font_ptr, font_len), out_len) }
}

// SAFETY: `yuragi_compile_title` is a unique exported symbol in the JS/WASM ABI.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn yuragi_compile_title(
    text_ptr: *const u8,
    text_len: usize,
    axes_ptr: *const u8,
    axes_len: usize,
    out_len: *mut usize,
) -> *mut u8 {
    // SAFETY: The JS/WASM ABI supplies both raw string inputs and the
    // output-length pointer from this module's linear memory.
    unsafe {
        write_response(
            compile_title_from_raw(text_ptr, text_len, axes_ptr, axes_len),
            out_len,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_raw_input_can_use_a_null_pointer() {
        let bytes = unsafe { read_bytes(std::ptr::null(), 0) }.unwrap();

        assert!(bytes.is_empty());
    }

    #[test]
    fn response_returns_null_without_an_output_length_pointer() {
        let ptr = unsafe { write_response::<()>(Ok(()), std::ptr::null_mut()) };

        assert!(ptr.is_null());
    }
}
