import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createYuragiFont,
  type BinarySource,
  type YuragiFont,
} from "@yuragi/wasm";
import { YuragiStyles } from "./YuragiStyles";
import { YuragiText as StaticYuragiText } from "./YuragiText";
import type { YuragiTextProps } from "./types";

type YuragiFontContextValue = {
  font: YuragiFont | null;
  error: Error | null;
};

export type YuragiFontProviderProps = {
  children: ReactNode;
  font: BinarySource | YuragiFont;
  axes?: Record<string, number>;
  wasm?: BinarySource;
  preload?: boolean | readonly string[];
  includeStyles?: boolean;
  styleNonce?: string;
};

export type RuntimeYuragiTextProps = Omit<YuragiTextProps, "outline">;

const YuragiFontContext = createContext<YuragiFontContextValue | null>(null);

function isYuragiFont(value: BinarySource | YuragiFont): value is YuragiFont {
  return (
    typeof value === "object" &&
    value !== null &&
    "compile" in value &&
    "preload" in value &&
    "dispose" in value
  );
}

function preloadTitles(preload: boolean | readonly string[] | undefined) {
  return Array.isArray(preload) ? preload : undefined;
}

function stableRecordKey(record: Record<string, number> | undefined) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(record ?? {}).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
}

function stablePreloadKey(preload: boolean | readonly string[] | undefined) {
  if (Array.isArray(preload)) return JSON.stringify(preload);
  return String(preload ?? false);
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
  const [value, setValue] = useState<YuragiFontContextValue>({
    font: isYuragiFont(font) ? font : null,
    error: null,
  });
  const axesKey = stableRecordKey(axes);
  const preloadKey = stablePreloadKey(preload);

  useEffect(() => {
    let cancelled = false;
    let ownedFont: YuragiFont | null = null;

    if (isYuragiFont(font)) {
      setValue({ font, error: null });
      if (Array.isArray(preload)) {
        void font.preload(preload).catch((error: unknown) => {
          if (!cancelled) {
            setValue({
              font,
              error: error instanceof Error ? error : new Error(String(error)),
            });
          }
        });
      }

      return () => {
        cancelled = true;
      };
    }

    setValue({ font: null, error: null });
    void createYuragiFont({
      font,
      axes,
      wasm,
      preload: preloadTitles(preload),
    })
      .then((createdFont) => {
        if (cancelled) {
          createdFont.dispose();
          return;
        }

        ownedFont = createdFont;
        setValue({ font: createdFont, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setValue({
            font: null,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });

    return () => {
      cancelled = true;
      ownedFont?.dispose();
    };
  }, [axesKey, font, preloadKey, wasm]);

  return (
    <>
      <YuragiStyles disabled={!includeStyles} nonce={styleNonce} />
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
      "YuragiText from @yuragi/react/wasm requires YuragiFontProvider",
    );
  }

  return context;
}

export function YuragiText(props: RuntimeYuragiTextProps) {
  const { error, font } = useYuragiFont();
  const [outline, setOutline] = useState<YuragiTextProps["outline"]>();

  useEffect(() => {
    let cancelled = false;
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

  return <StaticYuragiText {...props} outline={outline} />;
}
