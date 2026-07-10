import type { CSSProperties } from "react";
import type { ShardTransitionOptions, TextOutline } from "@yuragi/core";

export type YuragiTextProps = {
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
  Pick<YuragiTextProps, "text" | "size" | "fallback">
> &
  Omit<YuragiTextProps, "text" | "size" | "fallback">;
