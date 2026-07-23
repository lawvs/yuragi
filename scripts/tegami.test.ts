import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tegami } from "tegami";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

describe("Tegami workspace discovery", () => {
  it("discovers every publishable package with the npm client", async () => {
    const paper = tegami({
      cwd: repoRoot,
      ignore: [
        "yuragi",
        "@yuragi-labs/playground",
        "@yuragi-labs/example-react-runtime-vite",
        "@yuragi-labs/example-react-static-vite",
      ],
      npm: {
        client: "npm",
        updateLockFile: false,
      },
      packages: {
        "@yuragi-labs/core": {},
        "@yuragi-labs/compiler": {},
        "@yuragi-labs/react": {},
      },
    });

    const context = await paper._internal.context();

    expect(
      context.graph
        .getPackages()
        .map((pkg) => pkg.name)
        .sort(),
    ).toEqual([
      "@yuragi-labs/compiler",
      "@yuragi-labs/core",
      "@yuragi-labs/react",
    ]);
  });
});
