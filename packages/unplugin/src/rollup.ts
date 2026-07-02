import { YuragiUnplugin } from "./core";
import type { YuragiPluginOptions } from "./types";
import type { UnpluginInstance } from "unplugin";

const plugin: UnpluginInstance<YuragiPluginOptions>["rollup"] =
  YuragiUnplugin.rollup;

export default plugin;
export type * from "./types";
