import { TypeShardsUnplugin } from "./core";
import type { TypeShardsPluginOptions } from "./types";
import type { WebpackPluginInstance } from "unplugin";

const plugin: (options: TypeShardsPluginOptions) => WebpackPluginInstance =
  TypeShardsUnplugin.webpack;

export default plugin;
export type * from "./types";
