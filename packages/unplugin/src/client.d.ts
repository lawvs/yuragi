declare module "virtual:yuragi/outlines" {
  import type {
    OutlineMap,
    OutlineProvider,
    TextOutlineBundle,
  } from "@yuragi/core";

  export const bundle: TextOutlineBundle;
  export const provider: OutlineProvider;
  export function createStaticOutlineProvider(
    outlines: OutlineMap,
  ): OutlineProvider;
  const outlines: OutlineMap;
  export default outlines;
}
