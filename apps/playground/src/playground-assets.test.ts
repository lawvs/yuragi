import { describe, expect, it } from "vitest";
import { playgroundAssetUrl } from "./playground-assets";

describe("playgroundAssetUrl", () => {
  it("keeps generated assets under the configured Vite base path", () => {
    expect(
      playgroundAssetUrl(
        "/yuragi/",
        "yuragi-wasm/yuragi_wasm_compiler.wasm",
      ),
    ).toBe("/yuragi/yuragi-wasm/yuragi_wasm_compiler.wasm");
  });
});
