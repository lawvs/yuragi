export type DemoPost = {
  id: string;
  title: string;
  summary: string;
};

export const demoPosts: DemoPost[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    summary: "A compact operations screen with shard typography.",
  },
  {
    id: "settings",
    title: "Settings",
    summary: "A detail page transition with a shared title.",
  },
  {
    id: "missing",
    title: "Missing Outline",
    summary: "This entry demonstrates readable text fallback.",
  },
];

export const outlineTitles = ["Dashboard", "Settings"];
