import { YURAGI_STYLE_TEXT } from "@yuragi-labs/core";

export type YuragiStylesProps = {
  nonce?: string;
};

export function YuragiStyles({ nonce }: YuragiStylesProps) {
  return (
    <style data-yuragi-style="" nonce={nonce}>
      {YURAGI_STYLE_TEXT}
    </style>
  );
}
