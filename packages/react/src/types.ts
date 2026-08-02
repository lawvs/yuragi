import type { CSSProperties } from "react";
import type { TextOutline } from "@yuragi-labs/core";

export type YuragiAnimationOptions = {
  enter?: boolean;
  exit?: boolean;
  speed?: number;
};

type ResolvedYuragiAnimationOptions = {
  enter: boolean;
  exit: boolean;
  speed?: number;
};

export type StaticYuragiTextProps = {
  text: string;
  outline?: TextOutline;
  size?: number;
  maxWidth?: number;
  align?: "start" | "center" | "end";
  hover?: "none" | "outline";
  hoverMotion?: boolean;
  animation?: boolean | YuragiAnimationOptions;
  onEnterComplete?: () => void;
  onExitComplete?: () => void;
  fallback?: "text" | "hidden" | "error";
  className?: string;
  style?: CSSProperties;
};

export type ResolvedYuragiTextProps = Required<
  Pick<StaticYuragiTextProps, "text" | "size" | "fallback">
> &
  Omit<StaticYuragiTextProps, "text" | "size" | "fallback" | "animation"> & {
    animation: ResolvedYuragiAnimationOptions;
  };
