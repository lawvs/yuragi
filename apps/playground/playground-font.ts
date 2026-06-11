import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_PLAYGROUND_FONT_URL =
  "https://raw.githubusercontent.com/adobe-fonts/source-han-serif/release/Variable/OTF/SourceHanSerifSC-VF.otf";

export const DEFAULT_PLAYGROUND_FONT_SHA256 =
  "24980e3fdbdf7cbef800133c9bc8937cb65533ca50f0bd0565115db496f57220";

export type DownloadFont = (options: {
  url: string;
  destination: string;
}) => Promise<void>;

export type ResolvePlaygroundFontOptions = {
  cacheDir?: string;
  download?: DownloadFont;
  expectedSha256?: string | false;
  localBaseDir?: string;
};

const playgroundDir = fileURLToPath(new URL(".", import.meta.url));
const defaultCacheDir = fileURLToPath(
  new URL("./node_modules/.vite/type-shards/fonts/", import.meta.url),
);

async function fileExists(path: string) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function isRemoteFont(source: string) {
  try {
    const url = new URL(source);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function filenameFromUrl(url: string) {
  const name = basename(new URL(url).pathname);
  return name || "font.otf";
}

function localFontCandidates(
  source: string,
  options: ResolvePlaygroundFontOptions,
) {
  if (isAbsolute(source)) return source;

  return [
    options.localBaseDir ?? process.env.INIT_CWD,
    playgroundDir,
  ]
    .filter((base): base is string => base !== undefined)
    .map((base) => resolve(base, source));
}

async function resolveLocalFont(
  source: string,
  options: ResolvePlaygroundFontOptions,
) {
  const candidates = localFontCandidates(source, options);

  if (typeof candidates === "string") {
    if (await fileExists(candidates)) return candidates;

    throw new Error(
      `[type-shards playground] font file not found: ${candidates}`,
    );
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }

  throw new Error(
    `[type-shards playground] font file not found. Tried: ${candidates.join(", ")}`,
  );
}

async function sha256(path: string) {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

async function defaultDownloadFont({ url, destination }: {
  url: string;
  destination: string;
}) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `[type-shards playground] failed to download font: ${response.status} ${response.statusText}`,
    );
  }

  await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
}

async function resolveRemoteFont(
  url: string,
  options: ResolvePlaygroundFontOptions,
) {
  const cacheDir = options.cacheDir ?? defaultCacheDir;
  const destination = resolve(cacheDir, filenameFromUrl(url));
  const expectedSha256 =
    options.expectedSha256 === undefined && url === DEFAULT_PLAYGROUND_FONT_URL
      ? DEFAULT_PLAYGROUND_FONT_SHA256
      : options.expectedSha256;

  if (await fileExists(destination)) {
    if (
      typeof expectedSha256 !== "string" ||
      (await sha256(destination)) === expectedSha256
    ) {
      return destination;
    }

    await rm(destination, { force: true });
  }

  await mkdir(cacheDir, { recursive: true });
  const temporaryDestination = `${destination}.${process.pid}.${Date.now()}.tmp`;
  await rm(temporaryDestination, { force: true });

  try {
    await (options.download ?? defaultDownloadFont)({
      url,
      destination: temporaryDestination,
    });

    if (typeof expectedSha256 === "string") {
      const actualSha256 = await sha256(temporaryDestination);
      if (actualSha256 !== expectedSha256) {
        throw new Error(
          `[type-shards playground] downloaded font checksum mismatch: expected ${expectedSha256}, got ${actualSha256}`,
        );
      }
    }

    await rename(temporaryDestination, destination);
    return destination;
  } catch (error) {
    await rm(temporaryDestination, { force: true });
    throw error;
  }
}

export async function resolvePlaygroundFont(
  env: { TYPE_SHARDS_FONT?: string } = process.env,
  options: ResolvePlaygroundFontOptions = {},
) {
  const source = env.TYPE_SHARDS_FONT ?? DEFAULT_PLAYGROUND_FONT_URL;

  if (isRemoteFont(source)) {
    return resolveRemoteFont(source, options);
  }

  return resolveLocalFont(source, options);
}
