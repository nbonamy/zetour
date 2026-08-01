import { createApp, h, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import MobileLandscapeGate from "../../src/components/MobileLandscapeGate.vue";

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
const originalOrientation = Object.getOwnPropertyDescriptor(
  window.screen,
  "orientation",
);
const originalRequestFullscreen = Object.getOwnPropertyDescriptor(
  document.documentElement,
  "requestFullscreen",
);
const originalVisualViewport = Object.getOwnPropertyDescriptor(
  window,
  "visualViewport",
);

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
  if (originalOrientation) {
    Object.defineProperty(window.screen, "orientation", originalOrientation);
  }
  if (originalRequestFullscreen) {
    Object.defineProperty(
      document.documentElement,
      "requestFullscreen",
      originalRequestFullscreen,
    );
  } else {
    Reflect.deleteProperty(document.documentElement, "requestFullscreen");
  }
  if (originalVisualViewport) {
    Object.defineProperty(window, "visualViewport", originalVisualViewport);
  } else {
    Reflect.deleteProperty(window, "visualViewport");
  }
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("MobileLandscapeGate", () => {
  it("requests fullscreen and landscape, then clears after physical rotation", async () => {
    const compactViewport = mutableMediaQuery("(max-width: 1024px)", true);
    const portrait = mutableMediaQuery("(orientation: portrait)", true);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) =>
        query === "(max-width: 1024px)"
          ? compactViewport.mediaQuery
          : portrait.mediaQuery,
      ),
    });

    const requestFullscreen = vi.fn(async () => undefined);
    const lock = vi.fn(async () => undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(window.screen, "orientation", {
      configurable: true,
      value: { lock },
    });
    const visualViewport = {
      width: 393,
      height: 852,
      // Safari reports its position inside the larger layout viewport here.
      // Fixed elements are already relative to the visible viewport, so these
      // values must not be applied as another translation.
      offsetLeft: 7,
      offsetTop: 129,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as VisualViewport;
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: visualViewport,
    });
    const scrollTo = vi
      .spyOn(window, "scrollTo")
      .mockImplementation(() => undefined);

    const mountPoint = document.createElement("div");
    document.body.append(mountPoint);
    const app = createApp({
      render: () => h(MobileLandscapeGate),
    });
    app.mount(mountPoint);
    await nextTick();

    const button = document.querySelector<HTMLButtonElement>(
      ".mobile-landscape-card button",
    );
    expect(button?.textContent).toContain("Play in landscape");
    button?.click();
    await nextTick();
    await nextTick();

    expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: "hide" });
    expect(lock).toHaveBeenCalledWith("landscape");
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("Rotate your phone"),
    );

    Object.assign(visualViewport, { width: 852, height: 393 });
    portrait.setMatches(false);
    await nextTick();
    await vi.waitFor(() =>
      expect(document.querySelector(".mobile-landscape-gate")).toBeNull(),
    );
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(
      document.documentElement.style.getPropertyValue("--mobile-game-width"),
    ).toBe("698.67px");
    expect(
      document.documentElement.style.getPropertyValue("--mobile-viewport-top"),
    ).toBe("");
    expect(
      document.documentElement.style.getPropertyValue("--mobile-viewport-left"),
    ).toBe("");

    app.unmount();
    expect(
      document.documentElement.style.getPropertyValue("--mobile-game-width"),
    ).toBe("");
    mountPoint.remove();
  });

  it("asks for physical rotation when iPhone-style fullscreen is unavailable", async () => {
    const compactViewport = mutableMediaQuery("(max-width: 1024px)", true);
    const portrait = mutableMediaQuery("(orientation: portrait)", true);
    const standalone = mutableMediaQuery("(display-mode: standalone)", false);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => {
        if (query === "(max-width: 1024px)") {
          return compactViewport.mediaQuery;
        }
        if (query === "(display-mode: standalone)") {
          return standalone.mediaQuery;
        }
        return portrait.mediaQuery;
      }),
    });
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window.screen, "orientation", {
      configurable: true,
      value: {},
    });

    const mountPoint = document.createElement("div");
    document.body.append(mountPoint);
    const app = createApp({
      render: () => h(MobileLandscapeGate),
    });
    app.mount(mountPoint);
    await nextTick();

    expect(
      document.querySelector(".mobile-landscape-card button"),
    ).toBeNull();
    expect(document.body.textContent).toContain("Rotate your phone sideways");

    app.unmount();
    mountPoint.remove();
  });
});
