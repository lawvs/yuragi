import { YuragiUnplugin } from "./core";
import type { YuragiPluginOptions } from "./types";
import type { UnpluginInstance } from "unplugin";

const plugin: UnpluginInstance<YuragiPluginOptions>["vite"] =
  YuragiUnplugin.vite;

export default plugin;
export type * from "./types";
