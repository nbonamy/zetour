import { createApp, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const componentState = vi.hoisted(() => ({
  paused: false,
}));

vi.mock("../src/components/GameCanvas.vue", () => ({
  default: {
    name: "GameCanvas",
    props: ["paused"],
    setup(props: { paused: boolean }) {
      return () => {
        componentState.paused = props.paused;
        return null;
      };
    },
  },
}));
vi.mock("../src/components/UpgradeGraph.vue", () => ({
  default: {
    name: "UpgradeGraph",
    render: () => null,
  },
}));

import App from "../src/App.vue";
import { gameStore } from "../src/core/gameStore";

describe("App", () => {
  beforeEach(() => {
    gameStore.resetCareer();
    document.body.innerHTML = '<div id="test-app"></div>';
    componentState.paused = false;
  });

  it("shows resources and pauses the ride while the workshop is open", async () => {
    const app = createApp(App);
    const host = document.querySelector("#test-app");
    if (!host) throw new Error("Missing test host");
    app.mount(host);

    expect(document.body.textContent).toContain("Ze Tour");
    expect(document.body.textContent).toContain("Paris");
    expect(document.body.textContent).toContain("Bordeaux");
    expect(document.body.textContent).toContain("💧");
    expect(document.querySelector(".terrain-profile")).not.toBeNull();
    expect(document.body.textContent).toContain("Speed");
    expect(document.body.textContent).toContain("Sector distance");
    expect(document.body.textContent).toContain("Steer ↑ ↓");
    expect(document.body.textContent).toContain("Leaderboard");
    expect(document.body.textContent).toContain("Course record");
    expect(document.body.textContent).toContain("On record pace");
    expect(document.body.textContent).toContain("Record");
    expect(document.body.textContent).toContain("You");
    expect(document.body.textContent).not.toContain("-2% to +2%");
    expect(document.body.textContent).not.toContain("+6% to +12%");
    expect(document.body.textContent).toContain("Sweat");
    expect(document.body.textContent).toContain("Cash");
    expect(document.body.textContent).not.toContain(
      "An incremental cycling experiment",
    );
    expect(document.body.textContent).not.toContain(
      "All collected resources are available immediately",
    );
    expect(componentState.paused).toBe(false);

    const trigger = document.querySelector<HTMLButtonElement>(
      ".workshop-trigger",
    );
    trigger?.click();
    await nextTick();

    expect(document.body.textContent).toContain("Career workshop");
    expect(componentState.paused).toBe(true);
    app.unmount();
  });

  it("shows and activates the single power-up reserve", async () => {
    gameStore.collectPowerUp("super-draft");
    const app = createApp(App);
    const host = document.querySelector("#test-app");
    if (!host) throw new Error("Missing test host");
    app.mount(host);

    expect(document.body.textContent).toContain("Super Draft");
    const useButton = document.querySelector<HTMLButtonElement>(
      ".power-up-reserve button",
    );
    expect(useButton?.disabled).toBe(false);
    useButton?.click();
    await nextTick();

    expect(gameStore.getSnapshot().reservedPowerUp).toBeNull();
    expect(gameStore.getSnapshot().activePowerUp?.type).toBe("super-draft");
    expect(document.querySelector(".active-power-up")?.textContent).toContain(
      "Super Draft",
    );
    app.unmount();
  });
});
