import { describe, expect, it } from "vitest";
import * as core from "../src/index";

describe("@yuragi-labs/core public surface", () => {
  it("exports the unified renderer instead of internal stages", () => {
    expect(core.renderYuragiText).toBeTypeOf("function");
    expect(core.YuragiTextError).toBeTypeOf("function");
    expect(core.YURAGI_STYLE_TEXT).toBeTypeOf("string");
    expect(core).not.toHaveProperty("layoutShardedText");
    expect(core).not.toHaveProperty("createShardedSvg");
    expect(core).not.toHaveProperty("prepareShardAnimation");
    expect(core).not.toHaveProperty("ShardAnimationError");
  });
});
