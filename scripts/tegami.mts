import { tegami } from "tegami";
import { runCli } from "tegami/cli";
import { github } from "tegami/plugins/github";

const paper = tegami({
  ignore: [
    "yuragi",
    "@yuragi/playground",
    "@yuragi/example-react-runtime-vite",
    "@yuragi/example-react-static-vite",
  ],
  plugins: [
    github({
      repo: "lawvs/yuragi",
      versionPr: {
        base: "main",
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
    bumpDep({ dependent, kind }) {
      if (dependent.manifest.private || kind === "devDependencies") return false;
      return kind === "peerDependencies" ? "major" : "patch";
    },
  },
  packages: {
    "@yuragi/core": { group: "yuragi" },
    "@yuragi/wasm": { group: "yuragi" },
    "@yuragi/compiler": { group: "yuragi" },
    "@yuragi/react": { group: "yuragi" },
  },
});

await runCli(paper);
