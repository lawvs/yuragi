import { TypeShardsUnplugin } from "./core";
import type { TypeShardsPluginOptions } from "./types";
import type { UnpluginInstance } from "unplugin";

const plugin: UnpluginInstance<TypeShardsPluginOptions>["rollup"] =
  TypeShardsUnplugin.rollup;

export default plugin;
export type * from "./types";
