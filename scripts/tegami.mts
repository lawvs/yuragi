import { tegami } from "tegami";
import { runCli } from "tegami/cli";
import { github } from "tegami/plugins/github";

const paper = tegami({
  ignore: [
    "yuragi",
    "@yuragi-labs/playground",
    "@yuragi-labs/example-react-runtime-vite",
    "@yuragi-labs/example-react-static-vite",
  ],
  plugins: [
    github({
      repo: "lawvs/yuragi",
      versionPr: {
        base: "main",
        branch: "tegami/version-packages",
      },
    }),
  ],
  groups: {
    yuragi: {
      syncBump: true,
      syncGitTag: true,
    },
  },
  npm: {
    client: "npm",
    bumpDep({ dependent, kind }) {
      if (dependent.manifest.private || kind === "devDependencies") return false;
      return kind === "peerDependencies" ? "major" : "patch";
    },
  },
  packages: {
    "@yuragi-labs/core": { group: "yuragi" },
    "@yuragi-labs/wasm": { group: "yuragi" },
    "@yuragi-labs/compiler": { group: "yuragi" },
    "@yuragi-labs/react": { group: "yuragi" },
  },
});

await runCli(paper);
