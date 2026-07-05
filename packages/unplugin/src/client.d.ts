declare module "virtual:yuragi/outlines" {
  import type { OutlineMap, TextOutlineBundle } from "@yuragi/core";

  export const bundle: TextOutlineBundle;
  const outlines: OutlineMap;
  export default outlines;
}
