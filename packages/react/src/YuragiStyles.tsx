import * as React from "react";
import { YURAGI_STYLE_TEXT } from "@yuragi/core";

export type YuragiStylesProps = {
  nonce?: string;
  disabled?: boolean;
};

export function YuragiStyles({ disabled, nonce }: YuragiStylesProps) {
  if (disabled) return null;

  return (
    <style data-yuragi-style="" nonce={nonce}>
      {YURAGI_STYLE_TEXT}
    </style>
  );
}
