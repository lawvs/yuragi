import { ShardedSvg } from "./ShardedSvg";
import { createTextFallbackStyle } from "./style";
import type {
  ResolvedYuragiTextProps,
  StaticYuragiTextProps,
  YuragiAnimationOptions,
} from "./types";

export type { StaticYuragiTextProps, YuragiAnimationOptions } from "./types";

function resolveAnimation(
  animation: boolean | YuragiAnimationOptions | undefined,
): ResolvedYuragiTextProps["animation"] {
  if (typeof animation === "boolean") {
    return { enter: animation, exit: animation };
  }

  return {
    enter: animation?.enter ?? true,
    exit: animation?.exit ?? true,
    speed: animation?.speed,
  };
}

export function YuragiText(input: StaticYuragiTextProps) {
  const props: ResolvedYuragiTextProps = {
    size: 48,
    fallback: "text",
    ...input,
    animation: resolveAnimation(input.animation),
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
