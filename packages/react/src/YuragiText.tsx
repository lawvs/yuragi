import { ShardedSvg } from "./ShardedSvg";
import { createTextFallbackStyle } from "./style";
import type {
  ResolvedYuragiTextProps,
  StaticYuragiTextProps,
} from "./types";

export type { StaticYuragiTextProps } from "./types";

export function YuragiText(input: StaticYuragiTextProps) {
  const props: ResolvedYuragiTextProps = {
    size: 48,
    fallback: "text",
    ...input,
  };

  if (!props.outline) {
    if (props.fallback === "hidden") return null;
    if (props.fallback === "error") {
      throw new Error(`Missing yuragi outline for "${props.text}"`);
    }
    return (
      <span className={props.className} style={createTextFallbackStyle(props)}>
        {props.text}
      </span>
    );
  }

  return <ShardedSvg props={props} />;
}
