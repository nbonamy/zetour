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

    const map = host.querySelector<HTMLElement>(".graph-map");
    expect(map?.style.width).toBe("1000px");
    expect(map?.style.height).toBe("700px");
    expect(map?.style.getPropertyValue("--hex-width")).toBe("108px");
    expect(
      Number.parseFloat(map?.style.getPropertyValue("--hex-height") ?? "0"),
    ).toBeCloseTo(93.531, 3);
    expect(host.querySelector(".graph-connections")).toBeNull();
    expect(host.querySelectorAll(".hex-branch")).toHaveLength(5);
    expect(host.querySelectorAll(".branch-territory")).toHaveLength(5);
    expect(
      host.querySelector('[aria-label="Bike branch territory"]')?.textContent,
    ).toContain("Bike");
    expect(
      host.querySelector<HTMLElement>(
        '.hex-branch[data-branch="nutrition"]',
      )?.style.left,
    ).toBe("584px");
    expect(
      Number.parseFloat(
        host.querySelector<HTMLElement>(
          '.hex-branch[data-branch="nutrition"]',
        )?.style.top ?? "0",
      ),
    ).toBeCloseTo(301.235, 3);
    expect(host.querySelectorAll(".tree-node > .node-main")).toHaveLength(
      host.querySelectorAll(".tree-node").length,
    );
    expect(
      host.querySelectorAll('.tree-node[data-branch="nutrition"]'),
    ).toHaveLength(2);
    expect(host.querySelector(".node-level")).toBeNull();
    expect(
      host.querySelectorAll(
        'button[aria-label="Hydration"] .node-progress-segment',
      ),
    ).toHaveLength(5);
    expect(
      host.querySelector(
        'button[aria-label="Hydration"] .node-progress',
      )?.getAttribute("aria-label"),
    ).toBe("Level 0 of 5");
    expect(host.querySelector(".node-level-count")).toBeNull();
    expect(host.textContent).toContain("Rider");
    expect(host.textContent).toContain("Nutrition");
    expect(host.textContent).toContain("Bike");
    expect(host.textContent).toContain("Equipment");
    expect(host.textContent).toContain("Team");
    expect(host.textContent).toContain("Sector 2");
    expect(host.textContent).toContain("Sector 3");
    expect(host.textContent).toContain("Sector 5");
    app?.unmount();
    host.remove();
  });

  it("selects nodes safely and buys only from the explicit detail action", async () => {
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
    expect(gameStore.getSnapshot().upgrades.hydration).toBeUndefined();

    host.querySelector<HTMLButtonElement>(".detail-buy")?.click();
    await nextTick();
    expect(gameStore.getSnapshot().upgrades.hydration).toBe(1);
    app?.unmount();
    host.remove();
  });
});
