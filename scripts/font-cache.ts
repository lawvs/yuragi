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
import {
  SOURCE_HAN_SERIF_SHA256,
  SOURCE_HAN_SERIF_URL,
} from "../shared/source-han-serif";

export * from "../shared/source-han-serif";

export type DownloadFont = (options: {
  url: string;
  destination: string;
}) => Promise<void>;

export type ResolveFontOptions = {
  cacheDir?: string;
  download?: DownloadFont;
  expectedSha256?: string | false;
  localBaseDir?: string;
};

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const defaultCacheDir = fileURLToPath(
  new URL("../node_modules/.cache/yuragi/fonts/", import.meta.url),
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
  return basename(new URL(url).pathname) || "font.otf";
}

function localFontCandidates(source: string, options: ResolveFontOptions) {
  if (isAbsolute(source)) return [source];

  return Array.from(
    new Set(
      [
        options.localBaseDir,
        process.env.INIT_CWD,
        process.cwd(),
        repoRoot,
      ]
        .filter((base): base is string => base !== undefined)
        .map((base) => resolve(base, source)),
    ),
  );
}

async function resolveLocalFont(source: string, options: ResolveFontOptions) {
  const candidates = localFontCandidates(source, options);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }

  throw new Error(
    `[yuragi] font file not found. Tried: ${candidates.join(", ")}`,
  );
}

async function sha256(path: string) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function defaultDownloadFont({
  url,
  destination,
}: {
  url: string;
  destination: string;
}) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `[yuragi] failed to download font: ${response.status} ${response.statusText}`,
    );
  }

  await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
}

async function resolveRemoteFont(url: string, options: ResolveFontOptions) {
  const cacheDir = options.cacheDir ?? defaultCacheDir;
  const destination = resolve(cacheDir, filenameFromUrl(url));
  const expectedSha256 =
    options.expectedSha256 === undefined && url === SOURCE_HAN_SERIF_URL
      ? SOURCE_HAN_SERIF_SHA256
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
          `[yuragi] downloaded font checksum mismatch: expected ${expectedSha256}, got ${actualSha256}`,
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

export async function resolveFont(
  env: { YURAGI_FONT?: string } = process.env,
  options: ResolveFontOptions = {},
) {
  const source = env.YURAGI_FONT ?? SOURCE_HAN_SERIF_URL;

  if (isRemoteFont(source)) {
    return resolveRemoteFont(source, options);
  }

  return resolveLocalFont(source, options);
}
