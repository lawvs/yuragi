import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TextOutline } from "@yuragi-labs/core";
import { YuragiFontProvider, YuragiText } from "../src/index";

const outline: TextOutline = {
  em: 1000,
  ascender: 880,
  descender: -120,
  groups: [],
};

describe("runtime animations", () => {
  afterEach(() => {
    cleanup();
    document
      .querySelectorAll("[data-yuragi-exit]")
      .forEach((node) => node.remove());
  });

  it("completes one exit when runtime text changes", async () => {
    const onExitComplete = vi.fn();
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(() => outline),
      preload: vi.fn(() => undefined),
      dispose: vi.fn(),
    };

    const { rerender } = render(
      <YuragiFontProvider font={font} includeStyles={false}>
        <YuragiText
          text="First"
          onExitComplete={onExitComplete}
        />
      </YuragiFontProvider>,
    );

    rerender(
      <YuragiFontProvider font={font} includeStyles={false}>
        <YuragiText
          text="Second"
          onExitComplete={onExitComplete}
        />
      </YuragiFontProvider>,
    );

    await waitFor(() => {
      expect(onExitComplete).toHaveBeenCalledOnce();
    });
  });
});
