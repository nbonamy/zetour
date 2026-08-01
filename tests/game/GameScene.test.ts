import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createdKeys: [] as string[],
  between: vi.fn((minimum: number) => minimum),
}));

vi.mock("phaser", () => ({
  default: {
    Scene: class Scene {
      constructor(key: string) {
        mocks.createdKeys.push(key);
      }
    },
    Math: {
      Between: mocks.between,
      Clamp: (value: number, minimum: number, maximum: number) =>
        Math.min(maximum, Math.max(minimum, value)),
      Linear: (start: number, end: number, amount: number) =>
        start + (end - start) * amount,
    },
  },
}));

import { gameAudio } from "../../src/audio/gameAudio";
import { GameScene } from "../../src/game/GameScene";
import { gameStore } from "../../src/core/gameStore";

describe("GameScene", () => {
  it("registers itself as the ride scene", () => {
    mocks.createdKeys.length = 0;
    new GameScene();

    expect(mocks.createdKeys).toEqual(["ride"]);
  });

  it("rests bag artwork on the selected lane baseline", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const body = { setSize: vi.fn() };
    const bag: Record<string, any> = { body };
    bag.setDisplaySize = vi.fn(() => bag);
    bag.setDepth = vi.fn(() => bag);
    const image = vi.fn(() => bag);
    const ambientImage = vi.fn();
    const addToPickups = vi.fn();
    scene.physics = { add: { image } };
    scene.add = { image: ambientImage };
    scene.pickups = { add: addToPickups };
    scene.roadGradient = 0;

    (scene.spawnPickup as (
      type: "sweat" | "cash",
      lane: number,
      x: number,
    ) => void)("cash", 1, 400);

    expect(image).toHaveBeenCalledWith(400, 236, "bag-cash");
    expect(bag.roadLane).toBe(1);
    expect(bag.roadYOffset).toBe(-14);
    expect(bag.setDisplaySize).toHaveBeenCalledWith(28, 28);
    expect(addToPickups).toHaveBeenCalledWith(bag);
    expect(ambientImage).not.toHaveBeenCalled();
  });

  it("spawns ambient fans as an independent roadside group", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const spawnedFans: Record<string, any>[] = [];
    const image = vi.fn((x: number, y: number, texture: string) => {
      const fan: Record<string, any> = { x, y, texture };
      fan.setDisplaySize = vi.fn(() => fan);
      fan.setOrigin = vi.fn(() => fan);
      fan.setDepth = vi.fn(() => fan);
      spawnedFans.push(fan);
      return fan;
    });
    scene.add = { image };
    scene.fans = [];
    scene.roadGradient = 0;

    (scene.spawnFanCluster as (size: number, x: number) => void)(3, 700);

    expect(spawnedFans).toHaveLength(3);
    expect(scene.fans).toEqual(spawnedFans);
    expect(image.mock.calls.map((call) => call[2])).toEqual([
      "fan-1-a",
      "fan-1-a",
      "fan-1-a",
    ]);
    expect(image.mock.calls.map((call) => call[0])).toEqual([700, 746, 792]);
    expect(spawnedFans[0].setDisplaySize).toHaveBeenCalledWith(40, 53);
  });

  it("keeps ambient fans alive until the road scrolls them off-screen", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const fan: Record<string, any> = {
      x: 45,
      roadsideBaseY: 190,
      fanVariant: 1,
      frameOffset: 0,
    };
    fan.setX = vi.fn((x: number) => {
      fan.x = x;
      return fan;
    });
    fan.setY = vi.fn(() => fan);
    fan.setTexture = vi.fn(() => fan);
    fan.destroy = vi.fn();
    Object.assign(scene, {
      fans: [fan],
      fanSpawnDistance: 1_000,
      roadGradient: 0,
      time: { now: 0 },
    });

    (scene.updateRoadsideFans as (speed: number, delta: number) => void)(
      10,
      1_000,
    );
    expect(fan.x).toBe(35);
    expect(fan.destroy).not.toHaveBeenCalled();
    expect(scene.fans).toEqual([fan]);

    (scene.updateRoadsideFans as (speed: number, delta: number) => void)(
      100,
      1_000,
    );
    expect(fan.destroy).toHaveBeenCalledOnce();
    expect(scene.fans).toEqual([]);
  });

  it("preloads the complete painted ride asset pack", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const image = vi.fn();
    scene.load = { image };

    (scene.preload as () => void)();

    expect(image).toHaveBeenCalledTimes(39);
    expect(image).toHaveBeenCalledWith(
      "rider-a",
      "/assets/art/rider-a.png",
    );
    expect(image).toHaveBeenCalledWith(
      "fan-8-b",
      "/assets/art/fan-8-b.png",
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
    expect(image).toHaveBeenCalledWith(
      "oncoming-car-red-profile",
      "/assets/art/oncoming-car-red-profile.png",
    );
    expect(image).toHaveBeenCalledWith(
      "oncoming-van-cream-profile",
      "/assets/art/oncoming-van-cream-profile.png",
    );
    expect(image).toHaveBeenCalledWith(
      "power-acceleration",
      "/assets/art/power-acceleration.png",
    );
    expect(image).toHaveBeenCalledWith(
      "power-invincibility",
      "/assets/art/power-invincibility.png",
    );
  });

  it("places oncoming traffic on a lane-sized collision body", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const body = {
      setSize: vi.fn(),
      setOffset: vi.fn(),
    };
    body.setSize.mockReturnValue(body);
    body.setOffset.mockReturnValue(body);
    const vehicle: Record<string, any> = { body, y: 227 };
    vehicle.setDisplaySize = vi.fn(() => vehicle);
    vehicle.setDepth = vi.fn(() => vehicle);
    const image = vi.fn(() => vehicle);
    const addToHazards = vi.fn();
    scene.physics = { add: { image } };
    scene.hazards = { add: addToHazards };
    scene.roadGradient = 0;

    (scene.spawnOncomingVehicle as (
      lane: number,
      x: number,
      sequenceId: number,
      variant: "car" | "van",
    ) => void)(1, 700, 12, "car");

    expect(image).toHaveBeenCalledWith(
      700,
      222,
      "oncoming-car-red-profile",
    );
    expect(vehicle.eventType).toBe("oncoming-car");
    expect(vehicle.sequenceId).toBe(12);
    expect(vehicle.roadLane).toBe(1);
    expect(vehicle.roadYOffset).toBe(-28);
    expect(vehicle.roadSpeedMultiplier).toBeCloseTo(1.42);
    expect(vehicle.setDisplaySize).toHaveBeenCalledWith(112, 56);
    expect(body.setSize).toHaveBeenCalledWith(430, 120, false);
    expect(body.setOffset).toHaveBeenCalledWith(41, 115);
    expect(addToHazards).toHaveBeenCalledWith(vehicle);
  });

  it("maps legacy save keys to the new Acceleration and Invincibility art", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const spawned: Record<string, any>[] = [];
    const image = vi.fn((x: number, y: number, texture: string) => {
      const object: Record<string, any> = {
        x,
        y,
        texture,
        scaleX: 1,
        scaleY: 1,
        body: { setSize: vi.fn() },
      };
      object.setDisplaySize = vi.fn(() => object);
      object.setDepth = vi.fn(() => object);
      spawned.push(object);
      return object;
    });
    scene.physics = { add: { image } };
    scene.pickups = { add: vi.fn() };
    scene.tweens = { add: vi.fn() };
    scene.roadGradient = 0;

    (scene.spawnPowerUp as (
      type: "lucky-bidon" | "jump",
      lane: number,
      x: number,
      choiceId: number,
    ) => void)("lucky-bidon", 1, 400, 7);
    (scene.spawnPowerUp as (
      type: "lucky-bidon" | "jump",
      lane: number,
      x: number,
      choiceId: number,
    ) => void)("jump", 2, 500, 8);

    expect(image.mock.calls[0]?.[2]).toBe("power-acceleration");
    expect(image.mock.calls[1]?.[2]).toBe("power-invincibility");
    expect(spawned[0]?.eventType).toBe("lucky-bidon");
    expect(spawned[1]?.eventType).toBe("jump");
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
    const pickup = {};
    const hazard = {};
    const ambientFan = { destroy: vi.fn() };
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
      fans: [ambientFan],
      fanSpawnDistance: 1,
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

    expect(pickups.clear).toHaveBeenCalledWith(true, true);
    expect(hazards.clear).toHaveBeenCalledWith(true, true);
    expect(ambientFan.destroy).toHaveBeenCalledOnce();
    expect(scene.fans).toEqual([]);
    expect(scene.fanSpawnDistance).toBe(25);
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

  it("waits for every active road object to clear before the next encounter", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const pickup = { active: true };
    const hazard = { active: true };
    scene.pickups = { getChildren: () => [pickup] };
    scene.hazards = { getChildren: () => [hazard] };

    expect(scene.isEncounterRoadClear()).toBe(false);
    pickup.active = false;
    expect(scene.isEncounterRoadClear()).toBe(false);
    hazard.active = false;
    expect(scene.isEncounterRoadClear()).toBe(true);
  });

  it("does not shake the whole camera as ambient high-speed feedback", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const shake = vi.fn();
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    Object.assign(scene, {
      cameras: { main: { shake } },
      roadParticles: [],
    });

    try {
      (scene.updateSpeedFeedback as (
        delta: number,
        scrollSpeed: number,
        speedKmh: number,
        gradient: number,
      ) => void)(16, 220, 80, 0);

      expect(shake).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });

  it("lets Invincibility absorb potholes and traffic without breaking challenges", () => {
    gameStore.resetCareer();
    gameStore.collectPowerUp("jump");
    expect(gameStore.activateReservedPowerUp()).toBe(true);

    const scene = new GameScene() as unknown as Record<string, any>;
    const rewardFlow = vi.fn();
    const floatText = vi.fn();
    const destroyRoadObject = vi.fn();
    const trafficRun = {
      encounter: "traffic",
      totalPickups: 5,
      collectedPickups: 0,
      failed: false,
    };
    const potholeRun = {
      encounter: "slalom",
      totalPickups: 5,
      collectedPickups: 0,
      failed: false,
    };
    Object.assign(scene, {
      rewardFlow,
      floatText,
      destroyRoadObject,
      challengeRuns: new Map([
        [1, trafficRun],
        [2, potholeRun],
      ]),
    });
    const hitTraffic = vi.spyOn(gameStore, "hitTraffic");
    const hitPothole = vi.spyOn(gameStore, "hitPothole");
    const playEffect = vi.spyOn(gameAudio, "playEffect").mockImplementation(
      () => undefined,
    );
    const traffic = {
      active: true,
      eventType: "oncoming-car",
      sequenceId: 1,
      x: 120,
      y: 230,
    };
    const pothole = {
      active: true,
      eventType: "pothole",
      sequenceId: 2,
      x: 120,
      y: 270,
    };

    try {
      (scene.hitHazard as (object: unknown) => void)(traffic);
      (scene.hitHazard as (object: unknown) => void)(pothole);

      expect(hitTraffic).not.toHaveBeenCalled();
      expect(hitPothole).not.toHaveBeenCalled();
      expect(rewardFlow).toHaveBeenNthCalledWith(1, 20, "TRAFFIC SHIELD");
      expect(rewardFlow).toHaveBeenNthCalledWith(2, 12, "POTHOLE SHIELD");
      expect(floatText).toHaveBeenCalledTimes(2);
      expect(floatText).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        "INVINCIBLE!",
        "#ffe26f",
      );
      expect(destroyRoadObject).toHaveBeenCalledWith(traffic);
      expect(destroyRoadObject).toHaveBeenCalledWith(pothole);
      expect(trafficRun.failed).toBe(false);
      expect(potholeRun.failed).toBe(false);
      expect(playEffect.mock.calls.map(([effect]) => effect)).toEqual([
        "shield-hit",
        "shield-hit",
      ]);
    } finally {
      hitTraffic.mockRestore();
      hitPothole.mockRestore();
      playEffect.mockRestore();
      gameStore.resetCareer();
    }
  });

  it("plays distinct sounds for both resources and both crash types", () => {
    gameStore.resetCareer();
    const playEffect = vi.spyOn(gameAudio, "playEffect").mockImplementation(
      () => undefined,
    );
    const scene = new GameScene() as unknown as Record<string, any>;
    const rider: Record<string, any> = {};
    rider.setTint = vi.fn(() => rider);
    rider.clearTint = vi.fn(() => rider);
    Object.assign(scene, {
      rewardFlow: vi.fn(),
      floatText: vi.fn(),
      destroyRoadObject: vi.fn(),
      challengeRuns: new Map(),
      combo: 0,
      flow: 0,
      time: { now: 100, delayedCall: vi.fn() },
      cameras: { main: { shake: vi.fn() } },
      rider,
    });

    try {
      (scene.collect as (object: unknown) => void)({
        active: true,
        eventType: "sweat",
        x: 180,
        y: 220,
      });
      (scene.collect as (object: unknown) => void)({
        active: true,
        eventType: "cash",
        x: 180,
        y: 260,
      });
      (scene.hitHazard as (object: unknown) => void)({
        active: true,
        eventType: "pothole",
        x: 180,
        y: 220,
      });
      (scene.hitHazard as (object: unknown) => void)({
        active: true,
        eventType: "oncoming-car",
        x: 180,
        y: 260,
      });

      expect(playEffect.mock.calls.map(([effect]) => effect)).toEqual([
        "sweat-pickup",
        "cash-pickup",
        "pothole-crash",
        "car-crash",
      ]);
    } finally {
      playEffect.mockRestore();
      gameStore.resetCareer();
    }
  });

  it("sounds a power-up reservation without treating it like a resource bag", () => {
    gameStore.resetCareer();
    const playEffect = vi.spyOn(gameAudio, "playEffect").mockImplementation(
      () => undefined,
    );
    const scene = new GameScene() as unknown as Record<string, any>;
    const powerUp = {
      active: true,
      eventType: "jump",
      powerUpChoiceId: 9,
      x: 180,
      y: 220,
    };
    Object.assign(scene, {
      pickups: { getChildren: () => [powerUp] },
      rewardFlow: vi.fn(),
      floatText: vi.fn(),
      destroyRoadObject: vi.fn(),
    });

    try {
      (scene.collect as (object: unknown) => void)(powerUp);

      expect(gameStore.getSnapshot().reservedPowerUp).toBe("jump");
      expect(playEffect.mock.calls.map(([effect]) => effect)).toEqual([
        "power-up-pickup",
      ]);
      expect(scene.rewardFlow).toHaveBeenCalledWith(15, "POWER-UP");
    } finally {
      playEffect.mockRestore();
      gameStore.resetCareer();
    }
  });

  it("distinguishes a clean challenge from a missed sequence", () => {
    gameStore.resetCareer();
    const playEffect = vi.spyOn(gameAudio, "playEffect").mockImplementation(
      () => undefined,
    );
    const scene = new GameScene() as unknown as Record<string, any>;
    Object.assign(scene, {
      challengeRuns: new Map([
        [
          4,
          {
            encounter: "feed-zone",
            totalPickups: 1,
            collectedPickups: 0,
            failed: false,
          },
        ],
      ]),
      pickups: { getChildren: () => [] },
      rewardFlow: vi.fn(),
      showEncounter: vi.fn(),
      destroyRoadObject: vi.fn(),
      tweens: { add: vi.fn() },
    });

    try {
      (scene.recordChallengePickup as (sequenceId: number) => void)(4);
      expect(playEffect).toHaveBeenLastCalledWith("challenge-clean");

      scene.challengeRuns.set(5, {
        encounter: "sprint",
        totalPickups: 4,
        collectedPickups: 1,
        failed: false,
      });
      (scene.failPickupSequence as (pickup: unknown) => void)({
        sequenceId: 5,
        sequenceIndex: 1,
      });

      expect(playEffect.mock.calls.map(([effect]) => effect)).toEqual([
        "challenge-clean",
        "challenge-missed",
      ]);
      expect(scene.challengeRuns.has(4)).toBe(false);
      expect(scene.challengeRuns.has(5)).toBe(false);
    } finally {
      playEffect.mockRestore();
      gameStore.resetCareer();
    }
  });

  it("marks draft acquisition and release with start and end sounds", () => {
    gameStore.resetCareer();
    const playEffect = vi.spyOn(gameAudio, "playEffect").mockImplementation(
      () => undefined,
    );
    const scene = new GameScene() as unknown as Record<string, any>;
    const cyclist: Record<string, any> = { x: 190, y: 220 };
    cyclist.setAngle = vi.fn(() => cyclist);
    cyclist.setDepth = vi.fn(() => cyclist);
    const draftTimerText = {
      setPosition: vi.fn(),
      setText: vi.fn(),
    };
    Object.assign(scene, {
      draftCyclist: cyclist,
      draftTimerText,
      domestiques: [],
      draftLane: 1,
      draftLaneCountdown: 2_000,
      draftAcquisitionRemaining: 3_200,
      draftGraceRemaining: 0.9,
      draftTimeRemaining: 0,
      drafting: false,
      droppedFromDraft: false,
      riderRoadY: 220,
      roadGradient: 0,
      showEncounter: vi.fn(),
      rewardFlow: vi.fn(),
      lastFlowActionAt: 0,
      time: { now: 100 },
    });

    try {
      (scene.updateDraft as (delta: number, stage: number) => void)(16, 1);
      expect(scene.drafting).toBe(true);
      expect(playEffect).toHaveBeenLastCalledWith("draft-start");

      (scene.dropDraft as () => void)();
      expect(scene.drafting).toBe(false);
      expect(playEffect.mock.calls.map(([effect]) => effect)).toEqual([
        "draft-start",
        "draft-end",
      ]);

      playEffect.mockClear();
      scene.drafting = false;
      (scene.dropDraft as () => void)();
      expect(playEffect).not.toHaveBeenCalled();
    } finally {
      playEffect.mockRestore();
      gameStore.resetCareer();
    }
  });

  it("destroys every power-up choice and cancels its visual tweens", () => {
    const scene = new GameScene() as unknown as Record<string, any>;
    const children: Record<string, any>[] = [];
    const makePickup = (choiceId: number) => {
      const pickup: Record<string, any> = {
        powerUpChoiceId: choiceId,
      };
      pickup.destroy = vi.fn(() => {
        children.splice(children.indexOf(pickup), 1);
      });
      children.push(pickup);
      return pickup;
    };
    const first = makePickup(7);
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
    expect(killTweensOf).toHaveBeenCalledWith(first);
    expect(killTweensOf).toHaveBeenCalledWith(second);
    expect(children).toEqual([unrelated]);
  });
});
