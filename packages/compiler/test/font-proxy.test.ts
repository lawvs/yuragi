import { afterEach, describe, expect, it, vi } from "vitest";

function mockUndici() {
  const dispatcher = {};
  const ProxyAgent = vi.fn(function ProxyAgent(_proxy: string) {
    return dispatcher;
  });
  const setGlobalDispatcher = vi.fn();

  vi.doMock("undici", () => ({
    fetch: vi.fn(),
    ProxyAgent,
    setGlobalDispatcher,
  }));

  return { dispatcher, ProxyAgent, setGlobalDispatcher };
}

describe("font download proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("undici");
    vi.resetModules();
  });

  it("prefers https_proxy when configuring the global dispatcher", async () => {
    vi.stubEnv("https_proxy", "http://https-proxy.test:8080");
    vi.stubEnv("http_proxy", "http://http-proxy.test:8080");
    const { dispatcher, ProxyAgent, setGlobalDispatcher } = mockUndici();

    await import("../../../scripts/font-cache");

    expect(ProxyAgent).toHaveBeenCalledWith("http://https-proxy.test:8080");
    expect(ProxyAgent).toHaveBeenCalledTimes(1);
    expect(setGlobalDispatcher).toHaveBeenCalledWith(dispatcher);
  });

  it("falls back to http_proxy", async () => {
    vi.stubEnv("https_proxy", "");
    vi.stubEnv("http_proxy", "http://http-proxy.test:8080");
    const { dispatcher, ProxyAgent, setGlobalDispatcher } = mockUndici();

    await import("../../../scripts/font-cache");

    expect(ProxyAgent).toHaveBeenCalledWith("http://http-proxy.test:8080");
    expect(ProxyAgent).toHaveBeenCalledTimes(1);
    expect(setGlobalDispatcher).toHaveBeenCalledWith(dispatcher);
  });
});
