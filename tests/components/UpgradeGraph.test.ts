import { createApp, h, nextTick, type App as VueApp } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import UpgradeGraph from "../../src/components/UpgradeGraph.vue";
import { gameStore } from "../../src/core/gameStore";
import { upgradeById } from "../../src/core/upgrades";

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
    expect(map?.style.width).toBe("1200px");
    expect(map?.style.height).toBe("820px");
    expect(map?.style.getPropertyValue("--hex-width")).toBe("108px");
    expect(
      Number.parseFloat(map?.style.getPropertyValue("--hex-height") ?? "0"),
    ).toBeCloseTo(93.531, 3);
    expect(host.querySelector(".graph-connections")).toBeNull();
    expect(host.querySelectorAll(".hex-branch")).toHaveLength(5);
    expect(host.querySelector(".branch-territory")).toBeNull();
    expect(
      host.querySelector<HTMLElement>(
        '.hex-branch[data-branch="nutrition"]',
      )?.style.left,
    ).toBe("684px");
    expect(
      Number.parseFloat(
        host.querySelector<HTMLElement>(
          '.hex-branch[data-branch="nutrition"]',
        )?.style.top ?? "0",
      ),
    ).toBeCloseTo(361.235, 3);
    expect(host.querySelectorAll(".tree-node > .node-main")).toHaveLength(
      host.querySelectorAll(".tree-node").length,
    );
    expect(
      host.querySelectorAll('.tree-node[data-branch="nutrition"]'),
    ).toHaveLength(2);
    expect(host.querySelector(".node-level")).toBeNull();
    expect(
      host.querySelectorAll(
        'button[aria-label="Hydration protocol"] .node-progress-fill',
      ),
    ).toHaveLength(1);
    expect(
      host.querySelectorAll(
        'button[aria-label="Hydration protocol"] .node-progress-segment',
      ),
    ).toHaveLength(0);
    expect(
      host.querySelector(
        'button[aria-label="Hydration protocol"] .node-progress',
      )?.getAttribute("aria-label"),
    ).toBe("0% complete — 0 of 5 steps");
    expect(
      host.querySelector<HTMLElement>(
        'button[aria-label="Hydration protocol"] .node-progress-fill',
      )?.style.width,
    ).toBe("0%");
    expect(host.querySelector(".node-level-count")).toBeNull();
    expect(host.textContent).toContain("Rider");
    expect(host.textContent).toContain("Nutrition");
    expect(host.textContent).toContain("Bike");
    expect(host.textContent).toContain("Equipment");
    expect(host.textContent).toContain("Team");
    expect(host.textContent).toContain("Sector 2");
    expect(host.textContent).toContain("Sector 3");
    expect(host.textContent).toContain("Sector 4");
    app?.unmount();
    host.remove();
  });

  it("buys an available upgrade by clicking its tile", async () => {
    for (let index = 0; index < 100; index += 1) {
      gameStore.collectBag("sweat");
    }
    mountGraph();
    const hydration = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Hydration protocol"]',
    );
    if (!hydration) throw new Error("Missing Hydration node");

    hydration.dispatchEvent(new PointerEvent("pointerenter"));
    await nextTick();
    expect(host.textContent).toContain("Turn ad-hoc bottles");
    expect(host.querySelectorAll(".purchase-option")).toHaveLength(2);
    expect(host.textContent).toContain("Buy next step");
    expect(host.textContent).toContain("Buy all affordable");
    expect(host.textContent).toContain("×3");
    expect(host.textContent).toContain("×15");
    expect(host.textContent).toContain("×150");
    expect(host.textContent).toContain("×3.8K");

    hydration.click();
    await nextTick();
    expect(gameStore.getSnapshot().upgrades.hydration).toBe(1);

    host
      .querySelector<HTMLButtonElement>('.purchase-option[data-quantity="1"]')
      ?.click();
    await nextTick();
    expect(gameStore.getSnapshot().upgrades.hydration).toBe(2);
    app?.unmount();
    host.remove();
  });

  it("selects an unaffordable tile without purchasing it", async () => {
    mountGraph();
    const hydration = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Hydration protocol"]',
    );
    if (!hydration) throw new Error("Missing Hydration node");

    hydration.click();
    await nextTick();

    expect(gameStore.getSnapshot().upgrades.hydration).toBeUndefined();
    expect(host.textContent).toContain("Turn ad-hoc bottles");
    expect(
      host.querySelector<HTMLButtonElement>(
        '.purchase-option[data-quantity="1"]',
      )?.disabled,
    ).toBe(true);
    app?.unmount();
    host.remove();
  });

  it("fills one continuous bar without putting a level in the tile title", () => {
    const hydration = upgradeById("hydration");
    if (!hydration) throw new Error("Missing Hydration upgrade");
    for (let index = 0; index < 5; index += 1) {
      gameStore.collectBag("sweat");
    }
    expect(gameStore.purchase(hydration)).toBe(true);
    mountGraph();

    const tile = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Hydration protocol"]',
    );
    expect(tile?.textContent).not.toContain("Lv");
    expect(
      tile?.querySelector<HTMLElement>(".node-progress-fill")?.style.width,
    ).toBe("20%");
    expect(
      tile?.querySelector(".node-progress")?.getAttribute("aria-label"),
    ).toBe("20% complete — 1 of 5 steps");
    app?.unmount();
    host.remove();
  });

  it("shows the $2B moonshot and its full payoff from the opening", async () => {
    mountGraph();
    const hyperbike = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Hyperbike moonshot"]',
    );
    if (!hyperbike) throw new Error("Missing Hyperbike node");

    expect(hyperbike.textContent).toContain("$2B DREAM");
    hyperbike.click();
    await nextTick();

    expect(host.textContent).toContain("Pace ×10 · Sweat ×10 · Cash ×10");
    expect(
      host.querySelector<HTMLButtonElement>(
        '.purchase-option[data-quantity="1"]',
      )?.textContent,
    ).toContain("Need $2B more");
    expect(gameStore.getSnapshot().upgrades.hyperbike).toBeUndefined();
    app?.unmount();
    host.remove();
  });
});
