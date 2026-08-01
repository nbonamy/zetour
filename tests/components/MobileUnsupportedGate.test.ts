import { createApp, h, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import MobileUnsupportedGate from "../../src/components/MobileUnsupportedGate.vue";

interface MutableMediaQuery {
  mediaQuery: MediaQueryList;
  setMatches: (matches: boolean) => void;
}

const mutableMediaQuery = (
  media: string,
  initialMatches: boolean,
): MutableMediaQuery => {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    get matches() {
      return matches;
    },
    media,
    onchange: null,
    addEventListener: vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.add(listener),
    ),
    removeEventListener: vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
    ),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as MediaQueryList;

  return {
    mediaQuery,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches, media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
};

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("MobileUnsupportedGate", () => {
  it("blocks compact touch-first devices with an honest desktop message", async () => {
    const compactViewport = mutableMediaQuery("(max-width: 1024px)", true);
    const touchFirst = mutableMediaQuery(
      "(hover: none) and (pointer: coarse)",
      true,
    );
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) =>
        query === "(max-width: 1024px)"
          ? compactViewport.mediaQuery
          : touchFirst.mediaQuery,
      ),
    });
    const blockedChange = vi.fn();
    const mountPoint = document.createElement("div");
    document.body.append(mountPoint);
    const app = createApp({
      render: () =>
        h(MobileUnsupportedGate, { onBlockedChange: blockedChange }),
    });
    app.mount(mountPoint);
    await nextTick();

    expect(document.querySelector(".mobile-unsupported-gate")).not.toBeNull();
    expect(document.body.textContent).toContain("Sorry, rider.");
    expect(document.body.textContent).toContain("not available on mobile");
    expect(document.body.textContent).toContain("desktop or laptop");
    expect(blockedChange).toHaveBeenLastCalledWith(true);

    compactViewport.setMatches(false);
    await nextTick();
    await vi.waitFor(() =>
      expect(document.querySelector(".mobile-unsupported-gate")).toBeNull(),
    );
    expect(blockedChange).toHaveBeenLastCalledWith(false);

    app.unmount();
    mountPoint.remove();
  });

  it("does not block a narrow desktop browser with a precise pointer", async () => {
    const compactViewport = mutableMediaQuery("(max-width: 1024px)", true);
    const precisePointer = mutableMediaQuery(
      "(hover: none) and (pointer: coarse)",
      false,
    );
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) =>
        query === "(max-width: 1024px)"
          ? compactViewport.mediaQuery
          : precisePointer.mediaQuery,
      ),
    });
    const mountPoint = document.createElement("div");
    document.body.append(mountPoint);
    const app = createApp({
      render: () => h(MobileUnsupportedGate),
    });
    app.mount(mountPoint);
    await nextTick();

    expect(document.querySelector(".mobile-unsupported-gate")).toBeNull();

    app.unmount();
    mountPoint.remove();
  });
});
