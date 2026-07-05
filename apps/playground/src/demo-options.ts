import type { DemoPost } from "./data";

export type Align = "start" | "center" | "end";

export const alignOptions: Align[] = ["start", "center", "end"];

export function titleSharedId(post: DemoPost) {
  return `title:${post.id}`;
}
