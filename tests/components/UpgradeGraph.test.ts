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

  it("shows the five career branches with their Rider Level gates", () => {
    mountGraph();

    const map = host.querySelector<HTMLElement>(".graph-map");
    const stage = host.querySelector<HTMLElement>(".graph-stage");
    expect(map?.style.width).toBe("1120px");
    expect(map?.style.height).toBe("780px");
    expect(map?.style.transform).toBe("scale(0.7)");
    expect(map?.style.left).toBe("808px");
    expect(map?.style.top).toBe("757px");
    expect(stage?.style.width).toBe("2736px");
    expect(stage?.style.height).toBe("2294px");
    expect(map?.style.getPropertyValue("--hex-width")).toBe("");
    expect(host.querySelector(".graph-connections")).not.toBeNull();
    expect(host.querySelectorAll(".hex-branch")).toHaveLength(0);
    expect(host.querySelectorAll(".branch-hub")).toHaveLength(5);
    expect(host.querySelector(".branch-territory")).toBeNull();
    expect(
      host.querySelector<HTMLElement>(
        '.branch-hub[data-branch="nutrition"]',
      )?.style.left,
    ).toBe("678px");
    expect(
      Number.parseFloat(
        host.querySelector<HTMLElement>(
          '.branch-hub[data-branch="nutrition"]',
        )?.style.top ?? "0",
      ),
    ).toBe(228);
    expect(host.querySelectorAll(".tree-node > .node-main")).toHaveLength(
      host.querySelectorAll(".tree-node").length,
    );
    expect(host.querySelectorAll(".node-medallion")).toHaveLength(
      host.querySelectorAll(".tree-node").length,
    );
    expect(host.querySelectorAll(".graph-connection")).toHaveLength(
      host.querySelectorAll(".tree-node").length + 5,
    );
    expect(
      host.querySelector('[data-edge="hub:nutrition"]'),
    ).not.toBeNull();
    expect(
      host.querySelector('[data-edge="hub:nutrition"]')?.getAttribute("d"),
    ).toBe("M 560 390 L 678 228");
    const hubAngles = Array.from(
      host.querySelectorAll<HTMLElement>(".branch-hub"),
      (hub) => Number(hub.dataset.angle),
    ).sort((left, right) => left - right);
    expect(hubAngles).toEqual([-126, -54, 18, 90, 162]);
    expect(
      hubAngles.slice(1).map((angle, index) => angle - hubAngles[index]),
    ).toEqual([72, 72, 72, 72]);
    const hubRadii = Array.from(
      host.querySelectorAll<HTMLElement>(".branch-hub"),
      (hub) =>
        Math.hypot(
          Number.parseFloat(hub.style.left) - 560,
          Number.parseFloat(hub.style.top) - 390,
        ),
    );
    hubRadii.forEach((radius) => expect(radius).toBeCloseTo(200, 0));
    expect(host.querySelector(".graph-viewport .graph-help")).toBeNull();
    expect(host.querySelector(".graph-pane > .graph-help")).not.toBeNull();
    expect(host.querySelector(".graph-viewport .graph-map-title")).toBeNull();
    expect(host.querySelector(".graph-pane > .graph-map-title")).not.toBeNull();
    expect(
      host
        .querySelector('[data-edge="node:fueling"]')
        ?.classList.contains("edge-mystery"),
    ).toBe(true);
    expect(host.textContent).toContain("Career map");
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
    expect(host.textContent).toContain("Level 2");
    expect(host.textContent).toContain("Level 3");
    expect(host.textContent).toContain("Level 6");
    app?.unmount();
    host.remove();
  });

  it("keeps its fixed canvas while smoothly zooming the map", async () => {
    mountGraph();

    host.querySelector<HTMLButtonElement>('button[aria-label="Zoom out"]')?.click();
    await nextTick();

    expect(
      host.querySelector<HTMLElement>(".graph-map")?.style.transform,
    ).toBe("scale(0.6)");
    expect(host.querySelector<HTMLElement>(".graph-stage")?.style.width).toBe(
      "2736px",
    );
    expect(host.querySelector(".graph-zoom output")?.textContent).toBe("60%");

    host.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')?.click();
    await nextTick();
    expect(
      host.querySelector<HTMLElement>(".graph-map")?.style.transform,
    ).toBe("scale(0.7)");

    const viewport = host.querySelector<HTMLElement>(".graph-viewport");
    const wheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 90,
      deltaY: -100,
    });
    viewport?.dispatchEvent(wheel);
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(wheel.defaultPrevented).toBe(true);
    const wheelScale = Number.parseFloat(
      host
        .querySelector<HTMLElement>(".graph-map")
        ?.style.transform.match(/[\d.]+/)?.[0] ?? "0",
    );
    expect(wheelScale).toBeGreaterThan(0.7);
    expect(wheelScale).toBeLessThan(0.73);
    expect(host.querySelector(".graph-zoom output")?.textContent).toBe("72%");
    expect(host.querySelector<HTMLElement>(".graph-stage")?.style.width).toBe(
      "2736px",
    );
    app?.unmount();
    host.remove();
  });

  it("buys an available upgrade by clicking its tile", async () => {
    gameStore.activateKonamiCheat();
    mountGraph();
    const hydration = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Hydration protocol"]',
    );
    if (!hydration) throw new Error("Missing Hydration node");

    expect(hydration.dataset.purchaseState).toBe("purchasable");
    expect(hydration.classList.contains("unaffordable")).toBe(false);
    expect(hydration.querySelector(".node-funds-marker")).toBeNull();

    hydration.dispatchEvent(new PointerEvent("pointerenter"));
    await nextTick();
    expect(hydration.hasAttribute("title")).toBe(false);
    expect(hydration.querySelector(".node-progress")?.hasAttribute("title")).toBe(
      false,
    );
    expect(hydration.classList.contains("tooltip-visible")).toBe(true);
    expect(host.textContent).toContain("Turn ad-hoc bottles");
    expect(host.querySelectorAll(".purchase-option")).toHaveLength(2);
    expect(host.textContent).toContain("Buy next step");
    expect(host.textContent).toContain("Buy all affordable");
    expect(host.textContent).toContain("Nutrition · Sweat ×1.03");
    expect(host.textContent).toContain("Planned bottles");
    expect(host.textContent).toContain("Heat-adapted race protocol");

    hydration.dispatchEvent(new PointerEvent("pointerleave"));
    await nextTick();
    expect(hydration.classList.contains("tooltip-visible")).toBe(false);
    expect(host.textContent).toContain("Turn ad-hoc bottles");

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

    expect(hydration.dataset.purchaseState).toBe("unaffordable");
    expect(hydration.classList.contains("unaffordable")).toBe(true);
    expect(hydration.querySelector(".node-funds-marker")?.textContent?.trim()).toBe(
      "S",
    );
    expect(hydration.querySelector(".node-label small")?.textContent).toContain(
      "Need 125 more Sweat",
    );

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
    for (let index = 0; index < 16; index += 1) {
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

  it("shows the $100M Bike capstone as dependency locked with its full payoff", async () => {
    for (let index = 0; index < 550; index += 1) {
      gameStore.collectBag("sweat");
    }
    gameStore.activateKonamiCheat();
    const roadBike = upgradeById("road-bike");
    if (!roadBike) throw new Error("Missing road bike upgrade");
    expect(gameStore.purchase(roadBike)).toBe(true);
    mountGraph();
    const hyperbike = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Hyperbike moonshot"]',
    );
    if (!hyperbike) throw new Error("Missing Hyperbike node");

    expect(hyperbike.textContent).not.toContain("$100M DREAM");
    expect(hyperbike.dataset.branch).toBe("bike");
    expect(hyperbike.dataset.purchaseState).toBe("dependency-locked");
    expect(hyperbike.classList.contains("locked")).toBe(true);
    expect(hyperbike.disabled).toBe(false);
    expect(hyperbike.getAttribute("aria-disabled")).toBe("true");
    expect(hyperbike.querySelector(".node-label small")?.textContent).toContain(
      "Requires Sustained power tier 10",
    );
    hyperbike.click();
    await nextTick();

    expect(host.textContent).toContain(
      "Flat speed +2.5 km/h · Output ×10",
    );
    expect(
      host.querySelector<HTMLButtonElement>(
        '.purchase-option[data-quantity="1"]',
      )?.textContent,
    ).toContain("Requires Sustained power tier 10");
    expect(gameStore.getSnapshot().upgrades.hyperbike).toBeUndefined();
    app?.unmount();
    host.remove();
  });
});
