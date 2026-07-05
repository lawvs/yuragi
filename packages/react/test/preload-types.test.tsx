import { describe, expect, it } from "vitest";
import { YuragiFontProvider } from "../src/index";

describe("YuragiFontProvider preload types", () => {
  it("accepts an explicit title list", () => {
    const element = (
      <YuragiFontProvider
        font={new Uint8Array([1, 2, 3])}
        preload={["Dashboard"]}
      >
        <span>Dashboard</span>
      </YuragiFontProvider>
    );

    expect(element).toBeDefined();
  });

  it("does not accept boolean preload flags", () => {
    const element = (
      // @ts-expect-error preload only accepts explicit title arrays.
      <YuragiFontProvider font={new Uint8Array([1, 2, 3])} preload>
        <span>Dashboard</span>
      </YuragiFontProvider>
    );

    expect(element).toBeDefined();
  });
});
