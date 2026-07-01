import type { CSSProperties } from "react";
import type { ShardTransitionOptions, TextOutline } from "@type-shards/core";

export type ShardedTextProps = {
  text: string;
  outline?: TextOutline;
  sharedId?: string | false;
  size?: number;
  maxWidth?: number;
  align?: "start" | "center" | "end";
  hover?: "none" | "outline";
  transition?: ShardTransitionOptions;
  fallback?: "text" | "hidden" | "error";
  className?: string;
  style?: CSSProperties;
};

export type ResolvedShardedTextProps = Required<
  Pick<ShardedTextProps, "text" | "size" | "fallback">
> &
  Omit<ShardedTextProps, "text" | "size" | "fallback">;
