import { runNativeCompiler } from "./native";
import type { TextOutlineBundle } from "@type-shards/core";
import type { CompileOutlinesOptions } from "./types";

export type { CompileOutlinesOptions };

export async function normalizeTitles(
  titles: CompileOutlinesOptions["titles"],
): Promise<string[]> {
  const resolved = typeof titles === "function" ? await titles() : titles;
  return Array.from(new Set(resolved));
}

export async function compileOutlines(
  options: CompileOutlinesOptions,
): Promise<TextOutlineBundle> {
  const titles = await normalizeTitles(options.titles);
  if (titles.length === 0) {
    console.warn("[type-shards] titles is empty; emitting an empty bundle");
  }
  return runNativeCompiler({
    font: options.font,
    axes: options.axes,
    titles,
  });
}
