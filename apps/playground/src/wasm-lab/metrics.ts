export type CompileMetrics = {
  wasmBytes?: number;
  fontBytes?: number;
  wasmLoadMs?: number;
  fontLoadMs?: number;
  compileMs?: number;
  outlineBytes?: number;
  usedFallback?: boolean;
};

export type MetricRow = {
  label: string;
  value: string;
  detail: string;
};

export function formatBytes(bytes: number) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function formatMs(ms: number | undefined) {
  return typeof ms === "number" ? `${ms.toFixed(1)} ms` : "not loaded";
}

export function summarizeCompileMetrics(metrics: CompileMetrics): MetricRow[] {
  return [
    {
      label: "WASM",
      value:
        typeof metrics.wasmBytes === "number"
          ? formatBytes(metrics.wasmBytes)
          : "missing",
      detail: formatMs(metrics.wasmLoadMs),
    },
    {
      label: "Font",
      value:
        typeof metrics.fontBytes === "number"
          ? formatBytes(metrics.fontBytes)
          : "not loaded",
      detail: formatMs(metrics.fontLoadMs),
    },
    {
      label: "Compile",
      value:
        typeof metrics.compileMs === "number"
          ? formatMs(metrics.compileMs)
          : "idle",
      detail: metrics.usedFallback ? "fallback text" : "outline ready",
    },
    {
      label: "Outline",
      value:
        typeof metrics.outlineBytes === "number"
          ? formatBytes(metrics.outlineBytes)
          : "none",
      detail: "JSON",
    },
  ];
}
