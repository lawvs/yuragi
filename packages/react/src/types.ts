import type { CSSProperties } from "react";
import type { ShardTransitionOptions, TextOutline } from "@yuragi/core";

export type StaticYuragiTextProps = {
  text: string;
  outline?: TextOutline;
  size?: number;
  maxWidth?: number;
  align?: "start" | "center" | "end";
  hover?: "none" | "outline";
  transition?: ShardTransitionOptions;
  fallback?: "text" | "hidden" | "error";
  className?: string;
  style?: CSSProperties;
};

export type ResolvedYuragiTextProps = Required<
  Pick<StaticYuragiTextProps, "text" | "size" | "fallback">
> &
  Omit<StaticYuragiTextProps, "text" | "size" | "fallback">;
