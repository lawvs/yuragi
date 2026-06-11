export type CompileOutlinesOptions = {
  font: string;
  axes?: Record<string, number>;
  titles: string[] | (() => string[] | Promise<string[]>);
};
