import { EventEmitter } from "node:events";
import { access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

const { runNativeCompiler } = await import("../src/native");

describe("runNativeCompiler", () => {
  it("spawns cargo with an external target cache, temp titles, axes, and parsed JSON", async () => {
    let titlesPath = "";
    let titlesJson = "";

    spawnMock.mockImplementation((_command, args) => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter & { setEncoding: (encoding: string) => void };
        stderr: EventEmitter & { setEncoding: (encoding: string) => void };
      };

      child.stdout = new EventEmitter() as EventEmitter & {
        setEncoding: (encoding: string) => void;
      };
      child.stderr = new EventEmitter() as EventEmitter & {
        setEncoding: (encoding: string) => void;
      };
      child.stdout.setEncoding = vi.fn();
      child.stderr.setEncoding = vi.fn();

      setImmediate(async () => {
        const titlesArgIndex = args.indexOf("--titles");
        titlesPath = args[titlesArgIndex + 1];
        titlesJson = await readFile(titlesPath, "utf8");

        child.stdout.emit(
          "data",
          JSON.stringify({
            version: 1,
            font: {
              source: "/fonts/test.ttf",
              axes: { wght: 700 },
              unitsPerEm: 1000,
              hash: "abc123",
            },
            outlines: {},
          }),
        );
        child.emit("close", 0);
      });

      return child;
    });

    const result = await runNativeCompiler({
      font: "/fonts/test.ttf",
      axes: { wght: 700 },
      titles: ["Dashboard", "Settings"],
    });

    expect(result.font.hash).toBe("abc123");
    expect(titlesJson).toBe(JSON.stringify(["Dashboard", "Settings"]));
    await expect(access(titlesPath)).rejects.toThrow();

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawnMock.mock.calls[0];
    expect(command).toBe("cargo");
    expect(args).toEqual([
      "run",
      "--quiet",
      "--manifest-path",
      expect.stringContaining("packages/compiler/native/Cargo.toml"),
      "--",
      "--font",
      "/fonts/test.ttf",
      "--titles",
      titlesPath,
      "--axes",
      JSON.stringify({ wght: 700 }),
    ]);

    expect(options.cwd).toEqual(expect.stringContaining("packages/compiler"));
    expect(options.env.CARGO_TARGET_DIR).toEqual(
      expect.stringContaining(resolve(tmpdir(), "yuragi-cargo-target-")),
    );
    expect(options.env.CARGO_TARGET_DIR).not.toContain("packages/compiler");
  });
});
