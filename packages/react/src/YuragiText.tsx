import type { ReactNode } from "react";
import { ShardedSvg } from "./ShardedSvg";
import { createTextFallbackStyle } from "./style";
import type { ResolvedYuragiTextProps, YuragiTextProps } from "./types";

export type { YuragiTextProps } from "./types";

export function YuragiText(input: YuragiTextProps) {
  const props: ResolvedYuragiTextProps = {
    size: 48,
    fallback: "text",
    ...input,
  };

  let content: ReactNode;

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

  return content;
}
