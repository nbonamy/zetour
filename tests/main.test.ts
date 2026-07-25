import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createApp: vi.fn(),
  mount: vi.fn(),
}));

vi.mock("vue", () => ({
  createApp: mocks.createApp,
}));
vi.mock("../src/App.vue", () => ({
  default: {},
}));

describe("main", () => {
  it("mounts the application on the root element", async () => {
    mocks.createApp.mockReturnValue({ mount: mocks.mount });

    await import("../src/main");

    expect(mocks.createApp).toHaveBeenCalledOnce();
    expect(mocks.mount).toHaveBeenCalledWith("#app");
  });
});
