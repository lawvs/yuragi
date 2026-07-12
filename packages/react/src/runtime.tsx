import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createYuragiFont,
  type BinarySource,
  type YuragiFont,
} from "@yuragi/wasm";
import type { FontAxes } from "@yuragi/core";
import { YuragiStyles } from "./YuragiStyles";
import { YuragiText as StaticYuragiText } from "./YuragiText";
import type { StaticYuragiTextProps } from "./types";

export type { FontAxes, FontAxisTag, KnownFontAxisTag } from "@yuragi/core";

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

export type YuragiTextProps = Omit<StaticYuragiTextProps, "outline">;

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
      setValue(readyFontState(font));
      if (preload) {
        void font.preload(preload).catch((error: unknown) => {
          if (!cancelled) {
            setValue(errorFontState(error));
          }
        });
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
      "useYuragiFont from @yuragi/react requires YuragiFontProvider",
    );
  }

  return context;
}

export function YuragiText(props: YuragiTextProps) {
  const { error, font } = useYuragiFont();
  const [outline, setOutline] =
    useState<StaticYuragiTextProps["outline"]>();
  const previousFontRef = useRef(font);
  const previousErrorRef = useRef(error);
  const hasDisplayedOutlineRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (
      previousFontRef.current !== font ||
      previousErrorRef.current !== error
    ) {
      previousFontRef.current = font;
      previousErrorRef.current = error;
      hasDisplayedOutlineRef.current = false;
    }
    setOutline(undefined);

    if (!font || error) return;

    void font
      .compile(props.text)
      .then((compiledOutline) => {
        if (!cancelled) {
          setOutline(compiledOutline);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOutline(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [error, font, props.text]);

  useEffect(() => {
    if (outline) {
      hasDisplayedOutlineRef.current = true;
    }
  }, [outline]);

  const transition =
    outline &&
    !hasDisplayedOutlineRef.current &&
    props.transition?.enter === "settle"
      ? { ...props.transition, enter: "none" as const }
      : props.transition;

  return (
    <StaticYuragiText
      {...props}
      outline={outline}
      transition={transition}
    />
  );
}
