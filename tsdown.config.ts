import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  fixedExtension: false,
  hash: false,
  deps: {
    neverBundle: [/^@yuragi-labs\//, "react", "react-dom"],
  },
});
