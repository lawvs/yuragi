import * as React from "react";
import { ShardedSvg } from "./ShardedSvg";
import { createTextFallbackStyle } from "./style";
import type { ResolvedShardedTextProps, ShardedTextProps } from "./types";

export type { ShardedTextProps } from "./types";

export function ShardedText(input: ShardedTextProps) {
  const props: ResolvedShardedTextProps = {
    size: 48,
    fallback: "text",
    ...input,
  };

  const ViewTransition = (
    React as typeof React & {
      ViewTransition?: React.ComponentType<{
        name: string;
        children: React.ReactNode;
      }>;
    }
  ).ViewTransition;

  if (props.sharedId && !ViewTransition) {
    throw new Error(
      "yuragi v1 requires React Canary ViewTransition when sharedId is set",
    );
  }

  let content: React.ReactNode;

  if (!props.outline) {
    if (props.fallback === "hidden") return null;
    if (props.fallback === "error") {
      throw new Error(`Missing yuragi outline for "${props.text}"`);
    }
    content = (
      <span className={props.className} style={createTextFallbackStyle(props)}>
        {props.text}
      </span>
    );
  } else {
    content = <ShardedSvg props={props} />;
  }

  if (props.sharedId && ViewTransition) {
    return <ViewTransition name={props.sharedId}>{content}</ViewTransition>;
  }

  return content;
}
