import { runNativeCompiler } from "./native";
import type { TextOutlineBundle } from "@yuragi-labs/core";
import type { CompileOutlinesOptions } from "./types";

export type { CompileOutlinesOptions };
export type { FontAxes, FontAxisTag, KnownFontAxisTag } from "@yuragi-labs/core";

function normalizeTitles(titles: readonly string[]): string[] {
  return Array.from(new Set(titles));
}

export async function compileOutlines(
  options: CompileOutlinesOptions,
): Promise<TextOutlineBundle> {
  const titles = normalizeTitles(options.titles);
  if (titles.length === 0) {
    console.warn("[yuragi] titles is empty; emitting an empty bundle");
  }
  return runNativeCompiler({
    font: options.font,
    axes: options.axes,
    titles,
  });
}
