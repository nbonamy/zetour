import { createApp, h, nextTick, type App as VueApp } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import UpgradeGraph from "../../src/components/UpgradeGraph.vue";
import { gameStore } from "../../src/core/gameStore";

describe("UpgradeGraph", () => {
  let app: VueApp<Element> | undefined;
  let host: HTMLDivElement;

  beforeEach(() => {
    gameStore.resetCareer();
    host = document.createElement("div");
    document.body.append(host);
  });

  const mountGraph = (): void => {
    app = createApp({
      setup: () => () =>
        h(UpgradeGraph, { snapshot: gameStore.getSnapshot() }),
    });
    app.mount(host);
  };

  it("shows the five career branches with their stage gates", () => {
    mountGraph();

    expect(host.textContent).toContain("Rider");
    expect(host.textContent).toContain("Nutrition");
    expect(host.textContent).toContain("Bike");
    expect(host.textContent).toContain("Equipment");
    expect(host.textContent).toContain("Team");
    expect(host.textContent).toContain("Stage 2");
    expect(host.textContent).toContain("Stage 3");
    expect(host.textContent).toContain("Stage 5");
    app?.unmount();
    host.remove();
  });

  it("selects on hover and buys a revealed node on click", async () => {
    for (let index = 0; index < 5; index += 1) {
      gameStore.collectBag("sweat");
    }
    mountGraph();
    const hydration = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Hydration"]',
    );
    if (!hydration) throw new Error("Missing Hydration node");

    hydration.dispatchEvent(new PointerEvent("pointerenter"));
    await nextTick();
    expect(host.textContent).toContain("Preserve Flow longer");

    hydration.click();
    await nextTick();
    expect(gameStore.getSnapshot().upgrades.hydration).toBe(1);
    app?.unmount();
    host.remove();
  });
});
