import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createYuragiFont,
  type BinarySource,
  type YuragiFont,
} from "@yuragi-labs/core/wasm";
import type { FontAxes } from "@yuragi-labs/core";
import { YuragiStyles } from "./YuragiStyles";
import { YuragiText as StaticYuragiText } from "./YuragiText";
import type {
  StaticYuragiTextProps,
  YuragiAnimationOptions,
} from "./types";

export type { FontAxes, FontAxisTag, KnownFontAxisTag } from "@yuragi-labs/core";
export type { YuragiAnimationOptions } from "./types";

export type YuragiFontStatus = "loading" | "ready" | "error";

export type YuragiFontState =
  | {
      status: "loading";
      ready: false;
      font: null;
      error: null;
    }
  | {
      status: "ready";
      ready: true;
      font: YuragiFont;
      error: null;
    }
  | {
      status: "error";
      ready: false;
      font: null;
      error: Error;
    };

export type YuragiFontProviderProps = {
  children: ReactNode;
  font: BinarySource | YuragiFont;
  axes?: FontAxes;
  wasm?: BinarySource;
  preload?: readonly string[];
  includeStyles?: boolean;
  styleNonce?: string;
};

export type YuragiTextProps = Omit<
  StaticYuragiTextProps,
  "outline" | "fallback"
> & {
  fallback?:
    | StaticYuragiTextProps["fallback"]
    | { delayMs: number };
};

const YuragiFontContext = createContext<YuragiFontState | null>(null);

function loadingFontState(): YuragiFontState {
  return { status: "loading", ready: false, font: null, error: null };
}

function readyFontState(font: YuragiFont): YuragiFontState {
  return { status: "ready", ready: true, font, error: null };
}

function errorFontState(error: unknown): YuragiFontState {
  return {
    status: "error",
    ready: false,
    font: null,
    error: error instanceof Error ? error : new Error(String(error)),
  };
}

function isYuragiFont(value: BinarySource | YuragiFont): value is YuragiFont {
  return (
    typeof value === "object" &&
    value !== null &&
    "compile" in value &&
    "preload" in value &&
    "dispose" in value
  );
}

function stableRecordKey(record: FontAxes | undefined) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(record ?? {}).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
}

function stablePreloadKey(preload: readonly string[] | undefined) {
  return JSON.stringify(preload ?? []);
}

export function YuragiFontProvider({
  axes,
  children,
  font,
  includeStyles = true,
  preload,
  styleNonce,
  wasm,
}: YuragiFontProviderProps) {
  const [value, setValue] = useState<YuragiFontState>(
    isYuragiFont(font) ? readyFontState(font) : loadingFontState(),
  );
  const axesKey = stableRecordKey(axes);
  const preloadKey = stablePreloadKey(preload);

  useEffect(() => {
    let cancelled = false;
    let ownedFont: YuragiFont | null = null;

    if (isYuragiFont(font)) {
      setValue((current) =>
        current.status === "ready" && current.font === font
          ? current
          : readyFontState(font),
      );
      if (preload) {
        try {
          font.preload(preload);
        } catch (error: unknown) {
          if (!cancelled) setValue(errorFontState(error));
        }
      }

      return () => {
        cancelled = true;
      };
    }

    setValue(loadingFontState());
    void createYuragiFont({
      font,
      axes,
      wasm,
      preload,
    })
      .then((createdFont) => {
        if (cancelled) {
          createdFont.dispose();
          return;
        }

        ownedFont = createdFont;
        setValue(readyFontState(createdFont));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setValue(errorFontState(error));
        }
      });

    return () => {
      cancelled = true;
      ownedFont?.dispose();
    };
  }, [axesKey, font, preloadKey, wasm]);

  return (
    <>
      {includeStyles ? <YuragiStyles nonce={styleNonce} /> : null}
      <YuragiFontContext.Provider value={value}>
        {children}
      </YuragiFontContext.Provider>
    </>
  );
}

export function useYuragiFont() {
  const context = useContext(YuragiFontContext);
  if (!context) {
    throw new Error(
      "useYuragiFont from @yuragi-labs/react requires YuragiFontProvider",
    );
  }

  return context;
}

export function YuragiText(props: YuragiTextProps) {
  const { error, font } = useYuragiFont();
  const { fallback: requestedFallback, ...staticProps } = props;
  const fallbackDelayMs =
    typeof requestedFallback === "object"
      ? requestedFallback.delayMs
      : undefined;
  if (
    fallbackDelayMs !== undefined &&
    (!Number.isFinite(fallbackDelayMs) || fallbackDelayMs < 0)
  ) {
    throw new RangeError(
      "fallback.delayMs must be finite and non-negative",
    );
  }
  const [revealedFallback, setRevealedFallback] = useState<{
    text: string;
    delayMs: number;
  }>();
  const displayedFontRef = useRef<YuragiFont | null>(null);
  const outline = useMemo(() => {
    if (!font || error) return undefined;
    try {
      return font.compile(props.text);
    } catch {
      return undefined;
    }
  }, [error, font, props.text]);
  const firstOutlineForFont =
    outline !== undefined && displayedFontRef.current !== font;

  useLayoutEffect(() => {
    if (outline && font) displayedFontRef.current = font;
  }, [font, outline]);

  useEffect(() => {
    if (
      fallbackDelayMs === undefined ||
      fallbackDelayMs === 0 ||
      outline
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      setRevealedFallback({
        text: props.text,
        delayMs: fallbackDelayMs,
      });
    }, fallbackDelayMs);
    return () => clearTimeout(timeout);
  }, [fallbackDelayMs, outline, props.text]);

  const delayedFallbackRevealed =
    fallbackDelayMs === 0 ||
    (revealedFallback?.text === props.text &&
      revealedFallback.delayMs === fallbackDelayMs);
  let animation: boolean | YuragiAnimationOptions | undefined = props.animation;
  if (
    outline &&
    (firstOutlineForFont || delayedFallbackRevealed) &&
    animation !== false
  ) {
    animation =
      typeof animation === "object"
        ? { ...animation, enter: false }
        : { enter: false };
  }
  const fallback =
    typeof requestedFallback !== "object"
      ? requestedFallback
      : delayedFallbackRevealed
        ? "text"
        : "hidden";

  return (
    <StaticYuragiText
      {...staticProps}
      outline={outline}
      animation={animation}
      fallback={fallback}
    />
  );
}
