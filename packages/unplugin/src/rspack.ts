import { TypeShardsUnplugin } from "./core";
import type { TypeShardsPluginOptions } from "./types";
import type { RspackPluginInstance } from "unplugin";

const plugin: (options: TypeShardsPluginOptions) => RspackPluginInstance =
  TypeShardsUnplugin.rspack;

export default plugin;
export type * from "./types";
