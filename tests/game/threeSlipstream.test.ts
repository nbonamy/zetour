import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { ThreeSlipstream } from "../../src/game/threeSlipstream";

describe("3D drafting airflow", () => {
  const leader = new Vector3(0, 0, -6.5);
  const follower = new Vector3(0, 0, 1.1);

  it("only appears with a moving follower behind a drafting leader", () => {
    const air = new ThreeSlipstream();
    air.update(0.1, 20, null, follower, 1);
    expect(air.mesh.visible).toBe(false);
    air.update(0.1, 0, leader, follower, 1);
    expect(air.mesh.visible).toBe(false);
    air.update(0.1, 20, follower, leader, 1);
    expect(air.mesh.visible).toBe(false);
    air.update(0.1, 20, leader, follower, 0);
    expect(air.mesh.visible).toBe(false);
    air.update(0.1, 20, leader, follower, 1);
    expect(air.mesh.visible).toBe(true);
    air.dispose();
  });

  it("fades after losing the wheel and clears immediately for a new race", () => {
    const air = new ThreeSlipstream();
    air.update(0.5, 20, leader, follower, 1);
    air.update(0.05, 20, null, follower, 0);
    expect(air.mesh.visible).toBe(true);
    for (let frame = 0; frame < 60; frame += 1) {
      air.update(1 / 60, 20, null, follower, 0);
    }
    expect(air.mesh.visible).toBe(false);
    air.update(0.5, 20, leader, follower, 1);
    air.reset();
    expect(air.mesh.visible).toBe(false);
    air.dispose();
  });
});
