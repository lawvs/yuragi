import { TypeShardsUnplugin } from "./core";
import type { TypeShardsPluginOptions } from "./types";
import type { UnpluginInstance } from "unplugin";

const plugin: UnpluginInstance<TypeShardsPluginOptions>["vite"] =
  TypeShardsUnplugin.vite;

export default plugin;
export type * from "./types";
