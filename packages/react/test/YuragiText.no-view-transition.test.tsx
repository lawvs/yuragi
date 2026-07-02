import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { YuragiText } from "../src/YuragiText";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof React & { ViewTransition?: unknown }>(
    "react",
  );
  return {
    ...actual,
    ViewTransition: undefined,
  };
});

describe("YuragiText without ViewTransition", () => {
  it("throws when sharedId is set and outline is missing", () => {
    expect(() =>
      render(<YuragiText text="Missing" sharedId="title:missing" />),
    ).toThrow(
      "yuragi v1 requires React Canary ViewTransition when sharedId is set",
    );
  });

  it("does not require ViewTransition when sharedId is false", () => {
    expect(() =>
      render(<YuragiText text="Missing" sharedId={false} />),
    ).not.toThrow();
  });
});
