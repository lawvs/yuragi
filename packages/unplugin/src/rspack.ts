import { YuragiUnplugin } from "./core";
import type { YuragiPluginOptions } from "./types";
import type { RspackPluginInstance } from "unplugin";

const plugin: (options: YuragiPluginOptions) => RspackPluginInstance =
  YuragiUnplugin.rspack;

export default plugin;
export type * from "./types";
