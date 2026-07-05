import { compileOutlines } from "@yuragi/compiler";
import type { TextOutlineBundle } from "@yuragi/core";
import { createUnplugin } from "unplugin";
import type { YuragiPluginOptions } from "./types";

export const VIRTUAL_MODULE_ID = "virtual:yuragi/outlines";
export const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

export function createVirtualModuleCode(bundle: TextOutlineBundle): string {
  const serialized = JSON.stringify(bundle);

  return [
    `const bundle = JSON.parse(${JSON.stringify(serialized)});`,
    `export { bundle };`,
    `export default bundle.outlines;`,
  ].join("\n");
}

export const YuragiUnplugin = createUnplugin<YuragiPluginOptions>(
  (options) => {
    let code: string | undefined;
    let codePromise: Promise<string> | undefined;

    return {
      name: "yuragi",
      async buildStart() {
        codePromise = compileOutlines(options).then(createVirtualModuleCode);
        code = await codePromise;
      },
      resolveId(id) {
        if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID;
        return undefined;
      },
      load(id) {
        if (id === RESOLVED_VIRTUAL_MODULE_ID) {
          if (codePromise === undefined) {
            throw new Error(
              "[yuragi] virtual outlines requested before buildStart completed",
            );
          }

          return codePromise.then((nextCode) => {
            code = nextCode;
            return code;
          });
        }

        return undefined;
      },
    };
  },
);
