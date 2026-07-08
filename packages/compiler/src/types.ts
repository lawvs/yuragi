import type { FontAxes } from "@yuragi/core";

export type CompileOutlinesOptions = {
  font: string;
  axes?: FontAxes;
  titles: string[] | (() => string[] | Promise<string[]>);
};
