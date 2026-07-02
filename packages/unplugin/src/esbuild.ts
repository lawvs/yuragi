import { YuragiUnplugin } from "./core";
import type { YuragiPluginOptions } from "./types";
import type { EsbuildPlugin } from "unplugin";

const plugin: (options: YuragiPluginOptions) => EsbuildPlugin =
  YuragiUnplugin.esbuild;

export default plugin;
export type * from "./types";
