import * as React from "react";
import {
  createTypeShardsFont,
  type BinarySource,
  type TypeShardsFont,
} from "@type-shards/wasm";
import { ShardedText as StaticShardedText } from "./ShardedText";
import type { ShardedTextProps } from "./types";

type TypeShardsFontContextValue = {
  font: TypeShardsFont | null;
  error: Error | null;
};

export type TypeShardsFontProviderProps = {
  children: React.ReactNode;
  font: BinarySource | TypeShardsFont;
  axes?: Record<string, number>;
  wasm?: BinarySource;
  preload?: boolean | readonly string[];
};

export type RuntimeShardedTextProps = Omit<ShardedTextProps, "outline">;

const TypeShardsFontContext =
  React.createContext<TypeShardsFontContextValue | null>(null);

function isTypeShardsFont(value: BinarySource | TypeShardsFont): value is TypeShardsFont {
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

export function TypeShardsFontProvider({
  axes,
  children,
  font,
  preload,
  wasm,
}: TypeShardsFontProviderProps) {
  const [value, setValue] = React.useState<TypeShardsFontContextValue>({
    font: isTypeShardsFont(font) ? font : null,
    error: null,
  });
  const axesKey = stableRecordKey(axes);
  const preloadKey = stablePreloadKey(preload);

  React.useEffect(() => {
    let cancelled = false;
    let ownedFont: TypeShardsFont | null = null;

    if (isTypeShardsFont(font)) {
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
    void createTypeShardsFont({
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
    <TypeShardsFontContext.Provider value={value}>
      {children}
    </TypeShardsFontContext.Provider>
  );
}

export function useTypeShardsFont() {
  const context = React.useContext(TypeShardsFontContext);
  if (!context) {
    throw new Error(
      "ShardedText from @type-shards/react/wasm requires TypeShardsFontProvider",
    );
  }

  return context;
}

export function ShardedText(props: RuntimeShardedTextProps) {
  const { error, font } = useTypeShardsFont();
  const [outline, setOutline] = React.useState<ShardedTextProps["outline"]>();

  React.useEffect(() => {
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

  return <StaticShardedText {...props} outline={outline} />;
}
