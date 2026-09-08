import { createApp, nextTick } from "vue";
import { expect, it, vi } from "vitest";

const ride = vi.hoisted(() => ({ announce: (_value: { message: string; tone: string; until: number }) => {} }));
vi.mock("../../src/game/ThreeRide", () => ({
  ThreeRide: class {
    constructor(_host: HTMLElement, callbacks: { onAnnouncement: typeof ride.announce }) { ride.announce = callbacks.onAnnouncement; }
    setPaused() {}
    cycleCamera() {}
    dispose() {}
  },
}));
vi.mock("../../src/components/GameCanvas.vue", () => ({ default: { render: () => null } }));
vi.mock("../../src/components/UpgradeGraph.vue", () => ({ default: { render: () => null } }));

import App from "../../src/App.vue";
import { gameStore } from "../../src/core/gameStore";

it("shows a collected 3D bonus once when both the store and ride report it", async () => {
  gameStore.resetCareer();
  window.localStorage.setItem("ze-tour-workshop-invitation-seen-v1", "1");
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp(App);
  app.mount(host);
  host.querySelector<HTMLButtonElement>(".mode-card-3d")!.click();
  await nextTick();
  gameStore.collectPowerUp("lucky-bidon");
  ride.announce({ message: "ACCELERATION RESERVED", tone: "good", until: 900 });
  await nextTick();
  try {
    expect(host.querySelectorAll(".notice, .three-announcement")).toHaveLength(1);
    expect(host.querySelector(".notice")?.textContent).toContain("ACCELERATION RESERVED");
  } finally {
    app.unmount();
    host.remove();
  }
});
