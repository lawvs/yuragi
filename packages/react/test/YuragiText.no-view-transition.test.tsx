import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { YuragiText } from "../src/YuragiText";

vi.mock("react", async () => {
  const actual =
    await vi.importActual<typeof import("react") & { ViewTransition?: unknown }>(
      "react",
    );
  return {
    ...actual,
    ViewTransition: undefined,
  };
});

describe("YuragiText without ViewTransition", () => {
  it("does not require ViewTransition when sharedId is set", () => {
    expect(() =>
      render(<YuragiText text="Missing" sharedId="title:missing" />),
    ).not.toThrow();
  });

  it("does not require ViewTransition when sharedId is false", () => {
    expect(() =>
      render(<YuragiText text="Missing" sharedId={false} />),
    ).not.toThrow();
  });
});
