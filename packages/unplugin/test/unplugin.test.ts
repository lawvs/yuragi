import vm from "node:vm";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { compileOutlines } from "@yuragi/compiler";
import {
  createVirtualModuleCode,
  RESOLVED_VIRTUAL_MODULE_ID,
  TypeShardsUnplugin,
  VIRTUAL_MODULE_ID,
} from "../src/core";
import type { TextOutlineBundle } from "@yuragi/core";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execFile = promisify(execFileCallback);

vi.mock("@yuragi/compiler", () => ({
  compileOutlines: vi.fn(async () => bundle),
}));

const bundle: TextOutlineBundle = {
  version: 1,
  font: {
    source: "font.otf",
    unitsPerEm: 1000,
    hash: "abc",
  },
  outlines: {
    Dashboard: {
      em: 1000,
      ascender: 880,
      descender: -120,
      groups: [],
    },
  },
};

type EvaluatedVirtualModule = {
  bundle: TextOutlineBundle;
  defaultExport: TextOutlineBundle["outlines"];
  provider: {
    get(text: string): unknown;
  };
};

type TestRawPlugin = {
  resolveId(id: string): unknown;
  load(id: string): unknown;
  buildStart(this: unknown, options: unknown): Promise<void>;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function createTestPlugin(): TestRawPlugin {
  return TypeShardsUnplugin.raw(
    {
      font: "font.otf",
      titles: ["Dashboard"],
    },
    { framework: "rollup" },
  ) as unknown as TestRawPlugin;
}

const buildContext = {
  addWatchFile() {},
  emitFile() {
    return "";
  },
  getWatchFiles() {
    return [];
  },
  warn() {},
  error(error: Error) {
    throw error;
  },
};

function evaluateVirtualModule(code: string): EvaluatedVirtualModule {
  const createStaticOutlineProvider = (outlines: TextOutlineBundle["outlines"]) => ({
    get(text: string) {
      return outlines[text];
    },
  });
  const transformed = code
    .replace(
      `import { createStaticOutlineProvider } from "@yuragi/core";`,
      "",
    )
    .replace("export { bundle };", "")
    .replace("export default bundle.outlines;", "const defaultExport = bundle.outlines;")
    .replace("export const provider =", "const provider =")
    .replace("export { createStaticOutlineProvider };", "")
    .concat("\n({ bundle, defaultExport, provider });");

  return vm.runInNewContext(transformed, { createStaticOutlineProvider }) as EvaluatedVirtualModule;
}

beforeEach(() => {
  vi.mocked(compileOutlines).mockResolvedValue(bundle);
});

describe("createVirtualModuleCode", () => {
  it("exports bundle, outlines, provider, and createStaticOutlineProvider", () => {
    const code = createVirtualModuleCode(bundle);

    expect(code).toContain("const bundle =");
    expect(code).toContain("export default bundle.outlines");
    expect(code).toContain("export const provider =");
    expect(code).toContain("export { createStaticOutlineProvider }");
  });

  it("uses the expected virtual module id", () => {
    expect(VIRTUAL_MODULE_ID).toBe("virtual:yuragi/outlines");
  });

  it("preserves an own __proto__ outline key as data", () => {
    const protoBundle = JSON.parse(
      `{
        "version": 1,
        "font": {
          "source": "font.otf",
          "unitsPerEm": 1000,
          "hash": "abc"
        },
        "outlines": {
          "Dashboard": {
            "em": 1000,
            "ascender": 880,
            "descender": -120,
            "groups": []
          },
          "__proto__": {
            "em": 1000,
            "ascender": 880,
            "descender": -120,
            "groups": []
          }
        }
      }`,
    ) as TextOutlineBundle;

    const evaluated = evaluateVirtualModule(createVirtualModuleCode(protoBundle));

    expect(Object.hasOwn(evaluated.bundle.outlines, "__proto__")).toBe(true);
    expect(evaluated.defaultExport.__proto__).toEqual(protoBundle.outlines.__proto__);
    expect(evaluated.provider.get("__proto__")).toEqual(protoBundle.outlines.__proto__);
  });

  it("treats hostile strings as serialized data", () => {
    const hostileBundle: TextOutlineBundle = {
      ...bundle,
      font: {
        ...bundle.font,
        source: `font"; throw new Error("executed"); //`,
      },
    };

    const evaluated = evaluateVirtualModule(createVirtualModuleCode(hostileBundle));

    expect(evaluated.bundle.font.source).toBe(hostileBundle.font.source);
  });
});

describe("TypeShardsUnplugin", () => {
  it("resolves and loads the virtual module after buildStart", async () => {
    const plugin = createTestPlugin();

    expect(plugin.resolveId?.(VIRTUAL_MODULE_ID)).toBe(RESOLVED_VIRTUAL_MODULE_ID);
    expect(() => plugin.load?.(RESOLVED_VIRTUAL_MODULE_ID)).toThrow(
      "[yuragi] virtual outlines requested before buildStart completed",
    );

    await plugin.buildStart?.call(
      buildContext as never,
      {},
    );

    await expect(plugin.load(RESOLVED_VIRTUAL_MODULE_ID)).resolves.toContain(
      "const bundle =",
    );
  });

  it("waits for an in-progress buildStart compile before loading", async () => {
    const compile = deferred<TextOutlineBundle>();
    vi.mocked(compileOutlines).mockReturnValueOnce(compile.promise);
    const plugin = createTestPlugin();

    const buildStartPromise = plugin.buildStart.call(buildContext as never, {});
    const loadPromise = plugin.load(RESOLVED_VIRTUAL_MODULE_ID) as Promise<string>;

    compile.resolve(bundle);

    await expect(buildStartPromise).resolves.toBeUndefined();
    await expect(loadPromise).resolves.toContain("const bundle =");
  });
});

describe("package declarations", () => {
  it("packs client virtual module types", async () => {
    const packDir = await mkdtemp(resolve(tmpdir(), "yuragi-unplugin-pack-"));

    try {
      await execFile("pnpm", ["pack", "--pack-destination", packDir], {
        cwd: packageDir,
      });

      const tarballs = (await readdir(packDir)).filter((file) => file.endsWith(".tgz"));
      expect(tarballs).toHaveLength(1);

      const { stdout } = await execFile("tar", [
        "-tzf",
        resolve(packDir, tarballs[0]),
      ]);

      expect(stdout.split("\n")).toContain("package/dist/client.d.ts");
    } finally {
      await rm(packDir, { force: true, recursive: true });
    }
  });
});
