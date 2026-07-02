import { YuragiUnplugin } from "./core";
import type { YuragiPluginOptions } from "./types";
import type { WebpackPluginInstance } from "unplugin";

const plugin: (options: YuragiPluginOptions) => WebpackPluginInstance =
  YuragiUnplugin.webpack;

export default plugin;
export type * from "./types";
