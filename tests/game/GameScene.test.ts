import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createdKeys: [] as string[],
}));

vi.mock("phaser", () => ({
  default: {
    Scene: class Scene {
      constructor(key: string) {
        mocks.createdKeys.push(key);
      }
    },
  },
}));

import { GameScene } from "../../src/game/GameScene";
import { gameStore } from "../../src/core/gameStore";

describe("GameScene", () => {
  it("registers itself as the ride scene", () => {
    mocks.createdKeys.length = 0;
    new GameScene();

    expect(mocks.createdKeys).toEqual(["ride"]);
  });

  it("reacts to a store race reset before advancing another frame", () => {
    const scene = new GameScene() as unknown as Record<string, unknown>;
    const resetRaceWorld = vi.fn();
    scene.cameras = { main: { centerOn: vi.fn() } };
    scene.raceRevision = gameStore.getSnapshot().raceRevision;
    scene.resetRaceWorld = resetRaceWorld;

    gameStore.resetCareer();
    (scene.update as (time: number, delta: number) => void)(0, 16);

    expect(resetRaceWorld).toHaveBeenCalledOnce();
    expect(scene.raceRevision).toBe(gameStore.getSnapshot().raceRevision);
    expect(gameStore.getSnapshot().distanceM).toBe(0);
  });

  it("clears every spawned road object and temporary rider on reset", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const pickupCompanion = { destroy: vi.fn() };
    const pickup = { companion: pickupCompanion };
    const hazard = {};
    const pickups = {
      getChildren: vi.fn(() => [pickup]),
      clear: vi.fn(),
    };
    const hazards = {
      getChildren: vi.fn(() => [hazard]),
      clear: vi.fn(),
    };
    const draftCyclist = { destroy: vi.fn() };
    const draftTimerText = { destroy: vi.fn() };
    const domestique = { destroy: vi.fn() };
    const rider: Record<string, any> = {
      x: 112,
      y: 0,
      body: undefined,
    };
    rider.clearTint = vi.fn(() => rider);
    rider.setTexture = vi.fn(() => rider);
    rider.setPosition = vi.fn((x: number, y: number) => {
      rider.x = x;
      rider.y = y;
      return rider;
    });
    rider.setAngle = vi.fn(() => rider);
    const powerUpAura: Record<string, any> = {};
    powerUpAura.setVisible = vi.fn(() => powerUpAura);
    powerUpAura.setPosition = vi.fn(() => powerUpAura);
    powerUpAura.setAngle = vi.fn(() => powerUpAura);
    const encounterText: Record<string, any> = {};
    encounterText.setText = vi.fn(() => encounterText);
    encounterText.setAlpha = vi.fn(() => encounterText);

    Object.assign(scene, {
      pickups,
      hazards,
      tweens: { killTweensOf: vi.fn() },
      draftCyclist,
      draftTimerText,
      domestiques: [domestique],
      rider,
      powerUpAura,
      time: { now: 500 },
      flowBar: { width: 72 },
      flowText: { setText: vi.fn() },
      encounterText,
      mountain: { tilePositionX: 99 },
      fields: { tilePositionX: 88 },
      windStreaks: [],
      roadParticles: [],
      laneMarkers: [],
      updateRoadIncline: vi.fn(),
      encounterCount: 7,
      pickupSequenceCount: 9,
      flow: 82,
      combo: 5,
      drafting: true,
    });

    (scene.resetRaceWorld as () => void)();

    expect(pickupCompanion.destroy).toHaveBeenCalledOnce();
    expect(pickups.clear).toHaveBeenCalledWith(true, true);
    expect(hazards.clear).toHaveBeenCalledWith(true, true);
    expect(draftCyclist.destroy).toHaveBeenCalledOnce();
    expect(draftTimerText.destroy).toHaveBeenCalledOnce();
    expect(domestique.destroy).toHaveBeenCalledOnce();
    expect(scene.draftCyclist).toBeUndefined();
    expect(scene.domestiques).toEqual([]);
    expect(scene.encounterCount).toBe(0);
    expect(scene.pickupSequenceCount).toBe(0);
    expect(scene.flow).toBe(0);
    expect(scene.combo).toBe(0);
    expect(scene.drafting).toBe(false);
    expect(scene.targetLane).toBe(1);
    expect(scene.mountain.tilePositionX).toBe(0);
    expect(scene.fields.tilePositionX).toBe(0);
    expect(powerUpAura.setVisible).toHaveBeenCalledWith(false);
  });

  it("magnet-collects loot near the rider without checking its lane", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const loot: Record<string, any> = {
      x: 150,
      y: 999,
      active: true,
      eventType: "cash",
      sequenceFailed: false,
      setVelocity: vi.fn(() => loot),
      setX: vi.fn((x: number) => {
        loot.x = x;
        return loot;
      }),
    };
    const pickups = {
      getChildren: vi.fn(() => [loot]),
    };
    const collect = vi.fn();
    Object.assign(scene, {
      rider: { x: 112, y: 196 },
      pickups,
      collect,
    });

    (
      scene.updateRoadObjects as (
        group: unknown,
        scrollSpeed: number,
        delta: number,
        pickupMagnet: boolean,
      ) => void
    )(pickups, 0, 16, true);

    expect(collect).toHaveBeenCalledWith(loot);
  });
});
