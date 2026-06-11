import type { OutlineMap, OutlineProvider } from "./types";

export function createStaticOutlineProvider(
  outlines: OutlineMap,
): OutlineProvider {
  return {
    async preload() {
      return undefined;
    },
    get(text) {
      return outlines[text];
    },
    async resolve(text) {
      const outline = outlines[text];
      if (!outline) {
        throw new Error(`No type-shards outline found for "${text}"`);
      }
      return outline;
    },
  };
}
