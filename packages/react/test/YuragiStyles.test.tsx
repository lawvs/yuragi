import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { YURAGI_STYLE_TEXT } from "@yuragi-labs/core";
import { YuragiStyles } from "../src/YuragiStyles";

describe("YuragiStyles", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the core yuragi stylesheet as a React style element", () => {
    render(<YuragiStyles />);

    const style = document.querySelector("style[data-yuragi-style]");
    expect(style).not.toBeNull();
    expect(style?.textContent).toBe(YURAGI_STYLE_TEXT);
  });

  it("passes a nonce to the style element", () => {
    render(<YuragiStyles nonce="nonce-123" />);

    const style = document.querySelector("style[data-yuragi-style]");
    expect(style?.getAttribute("nonce")).toBe("nonce-123");
  });

  it("does not accept disabled props", () => {
    const element = (
      // @ts-expect-error callers should omit YuragiStyles instead.
      <YuragiStyles disabled />
    );

    expect(element).toBeDefined();
  });
});
