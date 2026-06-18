import type { AnimateShardsOptions } from "@type-shards/core";

export function createSettleAnimationOptions(
  speed: number | undefined,
): AnimateShardsOptions {
  return speed === undefined
    ? { type: "settle", stagger: "by-x" }
    : { type: "settle", stagger: "by-x", speed };
}

export function createScatterAnimationOptions(
  speed: number | undefined,
): AnimateShardsOptions {
  return speed === undefined
    ? { type: "scatter", stagger: "by-x" }
    : { type: "scatter", stagger: "by-x", speed };
}
