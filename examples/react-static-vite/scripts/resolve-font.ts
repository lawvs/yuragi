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

const DEFAULT_FONT_URL =
  "https://raw.githubusercontent.com/adobe-fonts/source-han-serif/release/Variable/OTF/SourceHanSerifSC-VF.otf";
const DEFAULT_FONT_SHA256 =
  "24980e3fdbdf7cbef800133c9bc8937cb65533ca50f0bd0565115db496f57220";
const cacheDir = fileURLToPath(
  new URL("../node_modules/.cache/yuragi/fonts/", import.meta.url),
);

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function resolveRemoteFont(url: string): Promise<string> {
  const filename = basename(new URL(url).pathname) || "font.otf";
  const destination = resolve(cacheDir, filename);
  const expectedHash = url === DEFAULT_FONT_URL ? DEFAULT_FONT_SHA256 : null;

  if (await fileExists(destination)) {
    if (!expectedHash || (await sha256(destination)) === expectedHash) {
      return destination;
    }

    await rm(destination, { force: true });
  }

  await mkdir(cacheDir, { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  await rm(temporary, { force: true });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download font: ${response.status} ${response.statusText}`,
      );
    }

    await writeFile(temporary, new Uint8Array(await response.arrayBuffer()));
    if (expectedHash) {
      const actualHash = await sha256(temporary);
      if (actualHash !== expectedHash) {
        throw new Error(
          `Font checksum mismatch: expected ${expectedHash}, got ${actualHash}`,
        );
      }
    }

    await rename(temporary, destination);
    return destination;
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function resolveFont(
  source = process.env.YURAGI_FONT,
): Promise<string> {
  const resolvedSource = source || DEFAULT_FONT_URL;

  if (/^https?:\/\//.test(resolvedSource)) {
    return resolveRemoteFont(resolvedSource);
  }

  const path = isAbsolute(resolvedSource)
    ? resolvedSource
    : resolve(process.cwd(), resolvedSource);
  await access(path, constants.R_OK);
  return path;
}
