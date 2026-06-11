import { TypeShardsUnplugin } from "./core";
import type { TypeShardsPluginOptions } from "./types";
import type { EsbuildPlugin } from "unplugin";

const plugin: (options: TypeShardsPluginOptions) => EsbuildPlugin =
  TypeShardsUnplugin.esbuild;

export default plugin;
export type * from "./types";
