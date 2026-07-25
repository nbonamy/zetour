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

    expect(document.body.textContent).toContain("Sweat");
    expect(document.body.textContent).toContain("Cash");
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
});
