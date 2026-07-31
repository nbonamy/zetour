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

  it("preloads the complete painted ride asset pack", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const image = vi.fn();
    scene.load = { image };

    (scene.preload as () => void)();

    expect(image).toHaveBeenCalledTimes(29);
    expect(image).toHaveBeenCalledWith(
      "rider-a",
      "/assets/art/rider-a.png",
    );
    expect(image).toHaveBeenCalledWith(
      "fan-4-b",
      "/assets/art/fan-4-b.png",
    );
    expect(image).toHaveBeenCalledWith(
      "stage-5",
      "/assets/art/stage-5.jpg",
    );
    expect(image).toHaveBeenCalledWith(
      "roadside-upper",
      "/assets/art/roadside-upper.png",
    );
    expect(image).toHaveBeenCalledWith(
      "roadside-lower",
      "/assets/art/roadside-lower.jpg",
    );
    expect(image).toHaveBeenCalledWith(
      "road-texture",
      "/assets/art/road-texture.jpg",
    );
    expect(image).toHaveBeenCalledWith(
      "road-texture-gravel",
      "/assets/art/road-texture-gravel.jpg",
    );
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
    rider.setDepth = vi.fn(() => rider);
    const powerUpAura: Record<string, any> = {};
    powerUpAura.setVisible = vi.fn(() => powerUpAura);
    powerUpAura.setPosition = vi.fn(() => powerUpAura);
    powerUpAura.setAngle = vi.fn(() => powerUpAura);
    powerUpAura.setScale = vi.fn(() => powerUpAura);
    const powerUpHalo: Record<string, any> = {};
    powerUpHalo.setVisible = vi.fn(() => powerUpHalo);
    powerUpHalo.setPosition = vi.fn(() => powerUpHalo);
    powerUpHalo.setAngle = vi.fn(() => powerUpHalo);
    powerUpHalo.setScale = vi.fn(() => powerUpHalo);
    const powerUpSpark = { setVisible: vi.fn() };
    const draftWake: Record<string, any> = {};
    draftWake.clear = vi.fn(() => draftWake);
    draftWake.setVisible = vi.fn(() => draftWake);
    const draftWindStreak = { setVisible: vi.fn() };
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
      powerUpHalo,
      powerUpSparks: [powerUpSpark],
      draftWake,
      draftWindStreaks: [draftWindStreak],
      time: { now: 500 },
      flowBar: { width: 72 },
      flowText: { setText: vi.fn() },
      encounterText,
      scenery: { tilePositionX: 99 },
      upperRoadside: { tilePositionX: 66 },
      lowerRoadside: { tilePositionX: 77 },
      roadTexture: { tilePositionX: 88 },
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
    expect(scene.scenery.tilePositionX).toBe(0);
    expect(scene.upperRoadside.tilePositionX).toBe(0);
    expect(scene.lowerRoadside.tilePositionX).toBe(0);
    expect(scene.roadTexture.tilePositionX).toBe(0);
    expect(powerUpAura.setVisible).toHaveBeenCalledWith(false);
    expect(powerUpHalo.setVisible).toHaveBeenCalledWith(false);
    expect(powerUpSpark.setVisible).toHaveBeenCalledWith(false);
    expect(draftWake.setVisible).toHaveBeenCalledWith(false);
    expect(draftWindStreak.setVisible).toHaveBeenCalledWith(false);
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

  it("destroys every power-up choice and cancels its visual tweens", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const children: Record<string, any>[] = [];
    const makePickup = (choiceId: number, withCompanion = false) => {
      const companion = withCompanion ? { destroy: vi.fn() } : undefined;
      const pickup: Record<string, any> = {
        powerUpChoiceId: choiceId,
        companion,
      };
      pickup.destroy = vi.fn(() => {
        children.splice(children.indexOf(pickup), 1);
      });
      children.push(pickup);
      return pickup;
    };
    const first = makePickup(7, true);
    const firstCompanion = first.companion;
    const second = makePickup(7);
    const unrelated = makePickup(8);
    const killTweensOf = vi.fn();
    Object.assign(scene, {
      pickups: { getChildren: () => children },
      tweens: { killTweensOf },
    });

    (scene.clearPowerUpChoice as (choiceId: number) => void)(7);

    expect(first.destroy).toHaveBeenCalledOnce();
    expect(second.destroy).toHaveBeenCalledOnce();
    expect(unrelated.destroy).not.toHaveBeenCalled();
    expect(firstCompanion.destroy).toHaveBeenCalledOnce();
    expect(killTweensOf).toHaveBeenCalledWith(first);
    expect(killTweensOf).toHaveBeenCalledWith(second);
    expect(killTweensOf).toHaveBeenCalledWith(firstCompanion);
    expect(children).toEqual([unrelated]);
  });
});
