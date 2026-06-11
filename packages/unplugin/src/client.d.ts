declare module "virtual:type-shards/outlines" {
  import type {
    OutlineMap,
    OutlineProvider,
    TextOutlineBundle,
  } from "@type-shards/core";

  export const bundle: TextOutlineBundle;
  export const provider: OutlineProvider;
  export function createStaticOutlineProvider(
    outlines: OutlineMap,
  ): OutlineProvider;
  const outlines: OutlineMap;
  export default outlines;
}
