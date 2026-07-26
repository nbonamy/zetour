import Phaser from "phaser";
import {
  gameStore,
  type GameSnapshot,
  type PowerUpType,
} from "../core/gameStore";
import { RANDOM_RIDER_DRAFT_BONUS } from "../core/drafting";
import {
  addFlow,
  advanceLoopingRoadMarkerX,
  advanceRoadObjectX,
  decayFlow,
  domestiqueFormationX,
  draftRulesForStage,
  encounterLabel,
  encounterStartX,
  fanFrameAt,
  flowMultiplier,
  formatDraftTimer,
  hasPickupPassedRider,
  isRemainingSequencePickup,
  moveLane,
  nextEncounter,
  outsideDraftTargetX,
  roadAngleDegrees,
  roadOffsetAtX,
  roadScrollSpeed,
  type RideEncounter,
} from "./rideSystems";
import {
  RIDE_RENDER_SCALE,
  RIDE_WORLD_HEIGHT,
  RIDE_WORLD_WIDTH,
  ROAD_HAZARD_LANE_OFFSET_Y,
  cyclistLaneY,
  roadHazardLaneY,
  syncRoadBodyPosition,
} from "./rendering";

type RoadObject = Phaser.Physics.Arcade.Image & {
  eventType?: "sweat" | "cash" | "pothole" | PowerUpType;
  companion?: Phaser.GameObjects.Image;
  sequenceId?: number;
  sequenceIndex?: number;
  sequenceFailed?: boolean;
  powerUpChoiceId?: number;
  roadLane?: number;
  roadYOffset?: number;
  companionBaseY?: number;
  companionFrameOffset?: number;
};

const WIDTH = RIDE_WORLD_WIDTH;
const HEIGHT = RIDE_WORLD_HEIGHT;
const LANE_Y = [196, 248, 300];
const CANVAS_FONT = "Inter, Arial, sans-serif";
const CYCLIST_WIDTH = 56;
const CYCLIST_HEIGHT = 48;
const CYCLIST_TEXTURE_SCALE = 3;
const ROAD_TOP_Y = 178;
const ROAD_BOTTOM_Y = 338;
const VERGE_TOP_Y = 164;
const FAN_WIDTH = 16;
const FAN_HEIGHT = 22;
const FAN_TEXTURE_SCALE = 3;
const ROAD_MARKER_SPACING = 64;
const ROAD_MARKER_MIN_X = -ROAD_MARKER_SPACING;
const ROAD_MARKER_MAX_X =
  Math.ceil((WIDTH + ROAD_MARKER_SPACING) / ROAD_MARKER_SPACING) *
  ROAD_MARKER_SPACING;

export class GameScene extends Phaser.Scene {
  private rider!: Phaser.Physics.Arcade.Sprite;
  private powerUpAura!: Phaser.GameObjects.Ellipse;
  private pickups!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.Group;
  private sky!: Phaser.GameObjects.Rectangle;
  private sun!: Phaser.GameObjects.Arc;
  private mountain!: Phaser.GameObjects.TileSprite;
  private fields!: Phaser.GameObjects.TileSprite;
  private roadGraphics!: Phaser.GameObjects.Graphics;
  private encounterText!: Phaser.GameObjects.Text;
  private flowText!: Phaser.GameObjects.Text;
  private flowBar!: Phaser.GameObjects.Rectangle;
  private windStreaks: Phaser.GameObjects.Rectangle[] = [];
  private roadParticles: Phaser.GameObjects.Rectangle[] = [];
  private laneMarkers: Phaser.GameObjects.Rectangle[] = [];
  private roadGradient = 0;
  private targetLane = 1;
  private encounterCountdown = 1_200;
  private encounterCount = 0;
  private pickupSequenceCount = 0;
  private animationCountdown = 120;
  private riderFrame = false;
  private lastSteerAt = 0;
  private flow = 0;
  private combo = 0;
  private lastFlowActionAt = 0;
  private draftCyclist?: Phaser.GameObjects.Sprite;
  private draftTimerText?: Phaser.GameObjects.Text;
  private domestiques: Phaser.GameObjects.Sprite[] = [];
  private draftLane = 1;
  private draftLaneCountdown = 0;
  private draftGraceRemaining = 0;
  private draftAcquisitionRemaining = 0;
  private draftTimeRemaining = 0;
  private drafting = false;
  private droppedFromDraft = false;
  private sceneryStage = 0;

  constructor() {
    super("ride");
  }

  create(): void {
    this.cameras.main
      .setZoom(RIDE_RENDER_SCALE)
      .centerOn(WIDTH / 2, HEIGHT / 2);
    this.createTextures();
    this.createWorld();
    this.createRider();

    this.pickups = this.physics.add.group();
    this.hazards = this.physics.add.group();

    this.physics.add.overlap(
      this.rider,
      this.pickups,
      (_rider, object) => this.collect(object as RoadObject),
    );
    this.physics.add.overlap(
      this.rider,
      this.hazards,
      (_rider, object) => this.hitHazard(object as RoadObject),
    );

    this.input.keyboard?.addCapture(["UP", "DOWN"]);
    this.input.keyboard?.on(
      "keydown-UP",
      (event: KeyboardEvent) => this.steerWithKeyboard(-1, event),
    );
    this.input.keyboard?.on(
      "keydown-DOWN",
      (event: KeyboardEvent) => this.steerWithKeyboard(1, event),
    );
  }

  update(_time: number, delta: number): void {
    this.cameras.main.centerOn(WIDTH / 2, HEIGHT / 2);
    gameStore.tick(delta / 1_000);
    const snapshot = gameStore.getSnapshot();
    const scrollSpeed = roadScrollSpeed(snapshot.stats.speedKmh);
    const windPenalty = snapshot.stageDefinition.windPenalty;
    const gradient = snapshot.currentGradient;

    this.updateStageScenery(snapshot.stageDefinition);
    this.mountain.tilePositionX += scrollSpeed * delta * 0.00014;
    this.fields.tilePositionX += scrollSpeed * delta * 0.00035;
    this.updateRoadIncline(gradient);
    this.updateLaneMarkers(scrollSpeed, delta);
    this.windStreaks.forEach((streak, index) => {
      streak.setVisible(windPenalty > 0);
      streak.setAlpha(Math.min(0.8, 0.2 + windPenalty * 2.5));
      streak.x -= (90 + windPenalty * 850) * (delta / 1_000);
      if (streak.x < -40) {
        streak.x = WIDTH + 30 + index * 13;
      }
    });
    const response = 1 - Math.exp(-delta / (210 / snapshot.stats.handling));
    this.rider.y = Phaser.Math.Linear(
      this.rider.y,
      cyclistLaneY(LANE_Y[this.targetLane]),
      response,
    );
    syncRoadBodyPosition(this.rider.body);
    this.syncDomestiques(snapshot.upgrades.domestique ?? 0);
    this.updateDomestiques(delta);

    this.updateRoadObjects(this.pickups, scrollSpeed, delta);
    this.updateRoadObjects(this.hazards, scrollSpeed, delta);
    this.updateFlow(delta, snapshot.stats.flowDecayPerSecond);
    this.updateDraft(delta, snapshot.stage);
    this.updateSpeedFeedback(
      delta,
      scrollSpeed,
      snapshot.stats.speedKmh,
      gradient,
    );
    this.updatePowerUpFeedback(snapshot.activePowerUp);

    this.encounterCountdown -= delta;
    if (this.encounterCountdown <= 0 && !this.draftCyclist) {
      const encounter = nextEncounter(
        snapshot.stageDefinition,
        this.encounterCount,
      );
      this.startEncounter(encounter);
      this.encounterCount += 1;
      this.encounterCountdown = Phaser.Math.Between(8_500, 12_000);
    }

    this.animationCountdown -= delta;
    if (this.animationCountdown <= 0) {
      this.riderFrame = !this.riderFrame;
      this.rider.setTexture(this.riderFrame ? "rider-b" : "rider-a");
      this.animationCountdown = Math.max(55, 180 - snapshot.stats.speedKmh * 4);
    }
  }

  private createWorld(): void {
    this.sky = this.add.rectangle(
      WIDTH / 2,
      HEIGHT / 2,
      WIDTH,
      HEIGHT,
      0x8ed7e8,
    );
    this.sun = this.add.circle(545, 58, 28, 0xffe390);
    this.windStreaks = Array.from({ length: 9 }, (_, index) =>
      this.add
        .rectangle(
          50 + index * 78,
          32 + (index % 4) * 31,
          18 + (index % 3) * 8,
          2,
          0xe9fbff,
        )
        .setDepth(2)
        .setVisible(false),
    );

    this.mountain = this.add
      .tileSprite(WIDTH / 2, 104, WIDTH, 110, "mountains")
      .setOrigin(0.5);
    this.fields = this.add
      .tileSprite(WIDTH / 2, 147, WIDTH, 56, "fields")
      .setOrigin(0.5);

    this.roadGraphics = this.add.graphics().setDepth(2);
    this.roadParticles = Array.from({ length: 14 }, (_, index) =>
      this.add
        .rectangle(
          (index * 53) % WIDTH,
          188 + (index % 3) * 52,
          3 + (index % 4),
          2,
          0xf5f0df,
          0.2,
        )
        .setDepth(4)
        .setData("baseRoadY", 188 + (index % 3) * 52),
    );

    [222, 274].forEach((y) => {
      for (
        let x = ROAD_MARKER_MIN_X;
        x < ROAD_MARKER_MAX_X;
        x += ROAD_MARKER_SPACING
      ) {
        this.laneMarkers.push(
          this.add
            .rectangle(x, y, 30, 3, 0xe8e0c9)
            .setDepth(3)
            .setData("baseRoadY", y),
        );
      }
    });
    this.updateRoadIncline(0, true);

    this.encounterText = this.add
      .text(WIDTH / 2, 42, "", {
        fontFamily: CANVAS_FONT,
        fontSize: "12px",
        color: "#f1cf4b",
        stroke: "#26323a",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(25);
    this.add
      .rectangle(626, 17, 106, 8, 0x26323a, 0.75)
      .setOrigin(1, 0.5)
      .setDepth(20);
    this.flowBar = this.add
      .rectangle(522, 17, 0, 4, 0xf1cf4b)
      .setOrigin(0, 0.5)
      .setDepth(21);
    this.flowText = this.add
      .text(626, 27, "FLOW x1.0", {
        fontFamily: CANVAS_FONT,
        fontSize: "9px",
        color: "#fff8d8",
        stroke: "#26323a",
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setDepth(21);
  }

  private updateStageScenery(stage: GameSnapshot["stageDefinition"]): void {
    if (this.sceneryStage === stage.number) return;
    this.sceneryStage = stage.number;

    const palettes = {
      1: {
        sky: 0xa5dfeb,
        sun: 0xffe39a,
        mountains: 0xc8ded4,
        mountainAlpha: 0.28,
        fields: 0x8bcf72,
      },
      2: {
        sky: 0x96d4e4,
        sun: 0xffdc83,
        mountains: 0x96b4aa,
        mountainAlpha: 0.68,
        fields: 0x75b65b,
      },
      3: {
        sky: 0xf4c58b,
        sun: 0xffd05d,
        mountains: 0xb79882,
        mountainAlpha: 0.58,
        fields: 0xc29c58,
      },
      4: {
        sky: 0xb9d5dc,
        sun: 0xffe4a6,
        mountains: 0x9fb1ae,
        mountainAlpha: 0.45,
        fields: 0x84ad68,
      },
      5: {
        sky: 0x81c7df,
        sun: 0xffdf7e,
        mountains: 0xffffff,
        mountainAlpha: 1,
        fields: 0x5f9d54,
      },
    } as const;
    const palette = palettes[stage.number as keyof typeof palettes] ?? palettes[1];

    this.sky.setFillStyle(palette.sky);
    this.sun.setFillStyle(palette.sun);
    this.mountain
      .setTint(palette.mountains)
      .setAlpha(palette.mountainAlpha);
    this.fields.setTint(palette.fields);
    this.showEncounter(
      `${stage.start.toUpperCase()} → ${stage.finish.toUpperCase()}`,
      2_400,
    );
  }

  private createRider(): void {
    this.powerUpAura = this.add
      .ellipse(112, cyclistLaneY(LANE_Y[1]), 68, 38, 0x71f5cc, 0.12)
      .setStrokeStyle(3, 0x71f5cc, 0.8)
      .setDepth(9)
      .setVisible(false);
    this.rider = this.physics.add.sprite(
      112,
      cyclistLaneY(LANE_Y[1]),
      "rider-a",
    );
    this.rider.setDisplaySize(CYCLIST_WIDTH, CYCLIST_HEIGHT).setDepth(10);
    this.rider.body?.setSize(
      24 * CYCLIST_TEXTURE_SCALE,
      24 * CYCLIST_TEXTURE_SCALE,
    );
  }

  private steerWithKeyboard(
    direction: -1 | 1,
    event: KeyboardEvent,
  ): void {
    if (event.repeat) return;
    event.preventDefault();
    this.targetLane = moveLane(this.targetLane, direction, LANE_Y.length);
    this.lastSteerAt = this.time.now;
  }

  private updateRoadIncline(gradient: number, force = false): void {
    if (!force && Math.abs(this.roadGradient - gradient) < 0.0001) return;
    this.roadGradient = gradient;

    const leftOffset = roadOffsetAtX(0, gradient);
    const rightOffset = roadOffsetAtX(WIDTH, gradient);
    const point = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

    this.roadGraphics
      .clear()
      .fillStyle(0x3f8b52)
      .fillPoints(
        [
          point(0, VERGE_TOP_Y + leftOffset),
          point(WIDTH, VERGE_TOP_Y + rightOffset),
          point(WIDTH, ROAD_TOP_Y + rightOffset),
          point(0, ROAD_TOP_Y + leftOffset),
        ],
        true,
      )
      .fillStyle(0x59636b)
      .fillPoints(
        [
          point(0, ROAD_TOP_Y + leftOffset),
          point(WIDTH, ROAD_TOP_Y + rightOffset),
          point(WIDTH, ROAD_BOTTOM_Y + rightOffset),
          point(0, ROAD_BOTTOM_Y + leftOffset),
        ],
        true,
      )
      .fillStyle(0x3f8b52)
      .fillPoints(
        [
          point(0, ROAD_BOTTOM_Y + leftOffset),
          point(WIDTH, ROAD_BOTTOM_Y + rightOffset),
          point(WIDTH, HEIGHT),
          point(0, HEIGHT),
        ],
        true,
      )
      .lineStyle(2, 0xd7d2b5)
      .lineBetween(
        0,
        ROAD_TOP_Y + leftOffset,
        WIDTH,
        ROAD_TOP_Y + rightOffset,
      )
      .lineBetween(
        0,
        ROAD_BOTTOM_Y + leftOffset,
        WIDTH,
        ROAD_BOTTOM_Y + rightOffset,
      );

    const angle = roadAngleDegrees(gradient);
    this.laneMarkers.forEach((marker) => {
      marker
        .setY(
          Number(marker.getData("baseRoadY")) +
            roadOffsetAtX(marker.x, gradient),
        )
        .setAngle(angle);
    });
  }

  private updateLaneMarkers(scrollSpeed: number, delta: number): void {
    this.laneMarkers.forEach((marker) => {
      marker.setX(
        advanceLoopingRoadMarkerX(
          marker.x,
          scrollSpeed,
          delta,
          ROAD_MARKER_MIN_X,
          ROAD_MARKER_MAX_X,
        ),
      );
      marker.setY(
        this.roadY(Number(marker.getData("baseRoadY")), marker.x),
      );
    });
  }

  private roadY(baseY: number, x: number): number {
    return baseY + roadOffsetAtX(x, this.roadGradient);
  }

  private spawnPickup(
    type: "sweat" | "cash" = Math.random() < 0.52 ? "sweat" : "cash",
    lane = Phaser.Math.Between(0, 2),
    x = WIDTH + 24,
    sequenceId?: number,
    sequenceIndex?: number,
  ): void {
    const texture = type === "sweat" ? "bag-sweat" : "bag-cash";
    const object = this.physics.add.image(
      x,
      this.roadY(LANE_Y[lane], x),
      texture,
    ) as RoadObject;
    object.eventType = type;
    object.sequenceId = sequenceId;
    object.sequenceIndex = sequenceIndex;
    object.roadLane = lane;
    object.roadYOffset = 0;
    object.setDepth(8);
    this.pickups.add(object);

    const fanAboveRoad = lane === 0;
    const fanY = fanAboveRoad ? ROAD_TOP_Y - 2 : ROAD_BOTTOM_Y + 2;
    const fan = this.add
      .image(x, this.roadY(fanY, x), "fan-a")
      .setDisplaySize(FAN_WIDTH, FAN_HEIGHT)
      .setOrigin(0.5, fanAboveRoad ? 1 : 0)
      .setDepth(6);
    object.companion = fan;
    object.companionBaseY = fanY;
    object.companionFrameOffset = (sequenceIndex ?? lane) * 130;
  }

  private spawnPowerUp(
    type: PowerUpType,
    lane: number,
    x: number,
    choiceId: number,
  ): void {
    const object = this.physics.add.image(
      x,
      this.roadY(LANE_Y[lane], x),
      `power-${type}`,
    ) as RoadObject;
    object.eventType = type;
    object.powerUpChoiceId = choiceId;
    object.roadLane = lane;
    object.roadYOffset = 0;
    object.setDisplaySize(30, 30).setDepth(12);
    object.body?.setSize(26, 26);
    this.pickups.add(object);
    this.tweens.add({
      targets: object,
      scale: 1.16,
      alpha: 0.78,
      duration: 360,
      yoyo: true,
      repeat: -1,
    });
  }

  private spawnPothole(
    lane = Phaser.Math.Between(0, 2),
    x = WIDTH + 24,
  ): void {
    const pothole = this.physics.add.image(
      x,
      this.roadY(roadHazardLaneY(LANE_Y[lane]), x),
      "pothole",
    ) as RoadObject;
    pothole.eventType = "pothole";
    pothole.roadLane = lane;
    pothole.roadYOffset = ROAD_HAZARD_LANE_OFFSET_Y;
    pothole.setDepth(9);
    pothole.body?.setSize(38, 12);
    this.hazards.add(pothole);
  }

  private updateRoadObjects(
    group: Phaser.Physics.Arcade.Group,
    scrollSpeed: number,
    delta: number,
  ): void {
    group.getChildren().forEach((child) => {
      const object = child as RoadObject;
      if (object.sequenceFailed) return;

      object.setVelocity(0, 0);
      object.setX(advanceRoadObjectX(object.x, scrollSpeed, delta));
      if (object.roadLane !== undefined) {
        object.setY(
          this.roadY(
            LANE_Y[object.roadLane] + (object.roadYOffset ?? 0),
            object.x,
          ),
        );
        syncRoadBodyPosition(object.body);
      }
      if (object.eventType === "pothole") {
        object.setAngle(roadAngleDegrees(this.roadGradient));
      }
      if (object.companion) {
        object.companion.x = object.x;
        object.companion.y = this.roadY(
          object.companionBaseY ?? object.companion.y,
          object.x,
        );
        object.companion.setTexture(
          fanFrameAt(this.time.now, object.companionFrameOffset),
        );
      }
      if (
        object.eventType === "pothole" &&
        !object.getData("passedRider") &&
        object.x <= this.rider.x
      ) {
        object.setData("passedRider", true);
        const gap = Math.abs(object.y - this.rider.y);
        const activelySteering = this.time.now - this.lastSteerAt < 5_000;
        if (activelySteering && gap >= 24 && gap <= 78) {
          this.rewardFlow(15, "NEAR MISS");
        }
      }
      if (
        group === this.pickups &&
        object.sequenceId !== undefined &&
        object.sequenceIndex !== undefined &&
        hasPickupPassedRider(object.x, this.rider.x)
      ) {
        this.failPickupSequence(object);
        return;
      }
      if (object.x < -36) {
        object.companion?.destroy();
        object.destroy();
      }
    });
  }

  private collect(object: RoadObject): void {
    if (
      !object.active ||
      object.sequenceFailed ||
      object.eventType === "pothole"
    ) {
      return;
    }
    if (
      object.eventType === "super-draft" ||
      object.eventType === "super-power"
    ) {
      const stored = gameStore.collectPowerUp(object.eventType);
      if (stored) {
        this.rewardFlow(15, "POWER-UP");
        this.floatText(
          object.x,
          object.y - 18,
          object.eventType === "super-draft"
            ? "SUPER DRAFT RESERVED"
            : "SUPER POWER RESERVED",
          object.eventType === "super-draft" ? "#71f5cc" : "#ffe26f",
        );
      } else {
        this.floatText(object.x, object.y - 18, "RESERVE FULL", "#fff8d8");
      }
      this.clearPowerUpChoice(object.powerUpChoiceId);
      return;
    }
    const multiplier = flowMultiplier(this.flow);
    const bagType = object.eventType === "sweat" ? "sweat" : "cash";
    const amount = gameStore.collectBag(
      bagType,
      multiplier,
    );
    this.rewardFlow(10, `COMBO ${this.combo + 1}`);
    this.floatText(
      object.x,
      object.y - 16,
      bagType === "sweat" ? `+${amount}💧` : `+$${amount}`,
      bagType === "sweat" ? "#71f5cc" : "#ffe26f",
    );
    object.companion?.destroy();
    object.destroy();
  }

  private clearPowerUpChoice(choiceId: number | undefined): void {
    this.pickups.getChildren().forEach((child) => {
      const pickup = child as RoadObject;
      if (
        choiceId !== undefined &&
        pickup.powerUpChoiceId === choiceId
      ) {
        pickup.destroy();
      }
    });
  }

  private failPickupSequence(missedPickup: RoadObject): void {
    const sequenceId = missedPickup.sequenceId;
    const missedIndex = missedPickup.sequenceIndex;
    if (sequenceId === undefined || missedIndex === undefined) return;

    missedPickup.companion?.destroy();
    missedPickup.destroy();

    this.pickups.getChildren().forEach((child) => {
      const pickup = child as RoadObject;
      if (
        !isRemainingSequencePickup(
          pickup.sequenceId,
          pickup.sequenceIndex,
          sequenceId,
          missedIndex,
        )
      ) {
        return;
      }

      pickup.sequenceFailed = true;
      pickup.setVelocity(0, 0);
      if (pickup.body) pickup.body.enable = false;
      pickup.setTint(0xff8d7d);
      pickup.companion?.setTint(0xff8d7d);

      this.tweens.add({
        targets: pickup.companion ? [pickup, pickup.companion] : [pickup],
        alpha: 0.15,
        duration: 120,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          pickup.companion?.destroy();
          pickup.destroy();
        },
      });
    });

    this.showEncounter("SEQUENCE MISSED — BONUSES LOST", 1_200);
  }

  private hitHazard(object: RoadObject): void {
    if (!object.active) return;

    const lost = gameStore.hitPothole();
    this.flow = 0;
    this.combo = 0;
    this.lastFlowActionAt = this.time.now;
    this.floatText(object.x, object.y - 18, `-$${lost}`, "#ff8d7d");
    this.cameras.main.shake(120, 0.008);
    this.rider.setTint(0xff9b91);
    this.time.delayedCall(240, () => this.rider.clearTint());
    object.destroy();
  }

  private startEncounter(encounter: RideEncounter): void {
    this.showEncounter(encounterLabel[encounter]);
    const startX = encounterStartX(encounter, WIDTH);
    const sequenceId = this.pickupSequenceCount;
    this.pickupSequenceCount += 1;
    const spawnSequencePickup = (
      type: "sweat" | "cash",
      lane: number,
      x: number,
      index: number,
    ) => this.spawnPickup(type, lane, x, sequenceId, index);

    switch (encounter) {
      case "bonus-line": {
        const lane = Phaser.Math.Between(0, 2);
        for (let index = 0; index < 4; index += 1) {
          spawnSequencePickup(
            index % 2 === 0 ? "cash" : "sweat",
            lane,
            startX + index * 92,
            index,
          );
        }
        this.spawnPothole((lane + 1) % 3, startX + 145);
        this.spawnPothole((lane + 2) % 3, startX + 330);
        break;
      }
      case "slalom": {
        [0, 1, 2, 1, 0].forEach((lane, index) => {
          this.spawnPothole(lane, startX + index * 82);
          spawnSequencePickup(
            "cash",
            (lane + 1) % 3,
            startX + index * 82 + 40,
            index,
          );
        });
        break;
      }
      case "fan-corridor":
        for (let index = 0; index < 6; index += 1) {
          spawnSequencePickup(
            "cash",
            index % 3,
            startX + index * 70,
            index,
          );
        }
        break;
      case "feed-zone": {
        const lane = Phaser.Math.Between(0, 2);
        for (let index = 0; index < 6; index += 1) {
          spawnSequencePickup(
            "sweat",
            lane,
            startX + index * 72,
            index,
          );
        }
        break;
      }
      case "sprint":
        for (let index = 0; index < 7; index += 1) {
          const lane = index % 2 === 0 ? 1 : Phaser.Math.Between(0, 2);
          spawnSequencePickup("cash", lane, startX + index * 68, index);
          if (index === 2 || index === 5) {
            this.spawnPothole((lane + 1) % 3, startX + index * 68 + 30);
          }
        }
        break;
      case "hairpins":
        [0, 2, 0, 2, 1].forEach((lane, index) => {
          this.spawnPothole(lane, startX + index * 84);
          spawnSequencePickup(
            "sweat",
            lane === 0 ? 2 : 0,
            startX + index * 84 + 42,
            index,
          );
        });
        break;
      case "power-up":
        this.spawnPowerUp("super-draft", 0, startX, sequenceId);
        this.spawnPowerUp("super-power", 2, startX, sequenceId);
        break;
      case "draft":
        this.spawnDraftCyclist();
        break;
    }
  }

  private showEncounter(label: string, duration = 2_200): void {
    this.encounterText
      .setPosition(WIDTH / 2, 42)
      .setText(label)
      .setAlpha(1);
    this.time.delayedCall(duration, () => {
      if (this.encounterText.text === label) {
        this.encounterText.setAlpha(0);
      }
    });
  }

  private rewardFlow(amount: number, label: string): void {
    this.flow = addFlow(this.flow, amount);
    this.combo += 1;
    this.lastFlowActionAt = this.time.now;
    this.floatText(this.rider.x + 12, this.rider.y - 24, label, "#f1cf4b");
  }

  private updateFlow(delta: number, decayPerSecond: number): void {
    if (this.time.now - this.lastFlowActionAt > 2_500 && !this.drafting) {
      this.flow = decayFlow(this.flow, delta / 1_000, decayPerSecond);
      if (this.flow === 0) this.combo = 0;
    }
    const multiplier = flowMultiplier(this.flow);
    this.flowBar.width = this.flow;
    const draftTimer = this.drafting
      ? ` · DRAFT ${Math.ceil(this.draftTimeRemaining)}s`
      : "";
    this.flowText.setText(
      `FLOW x${multiplier.toFixed(1)}${this.combo > 1 ? ` · ${this.combo}` : ""}${draftTimer}`,
    );
  }

  private spawnDraftCyclist(): void {
    if (this.draftCyclist) return;
    this.draftLane = Phaser.Math.Between(0, 2);
    this.draftCyclist = this.add
      .sprite(
        -42,
        this.roadY(cyclistLaneY(LANE_Y[this.draftLane]), -42),
        "draft-rider",
      )
      .setDisplaySize(CYCLIST_WIDTH, CYCLIST_HEIGHT)
      .setDepth(11);
    this.draftTimerText = this.add
      .text(
        -42,
        this.roadY(LANE_Y[this.draftLane], -42) - 27,
        "CATCH",
        {
        fontFamily: CANVAS_FONT,
        fontSize: "10px",
        color: "#fff8d8",
        backgroundColor: "#26323a",
        padding: { x: 4, y: 2 },
        },
      )
      .setOrigin(0.5)
      .setDepth(15);
    this.draftLaneCountdown = Phaser.Math.Between(2_700, 4_200);
    this.draftAcquisitionRemaining = 3_200;
    this.draftTimeRemaining = 0;
    this.draftGraceRemaining = 0.9;
    this.drafting = false;
    this.droppedFromDraft = false;
    gameStore.setTemporaryDraftBonus(0);
  }

  private updateDraft(delta: number, stage: number): void {
    const cyclist = this.draftCyclist;
    if (!cyclist) {
      gameStore.setTemporaryDraftBonus(0);
      return;
    }

    const deltaSeconds = delta / 1_000;
    const rules = draftRulesForStage(stage);
    cyclist.y = Phaser.Math.Linear(
      cyclist.y,
      this.roadY(cyclistLaneY(LANE_Y[this.draftLane]), cyclist.x),
      1 - Math.exp(-delta / 180),
    );
    cyclist.setAngle(roadAngleDegrees(this.roadGradient));
    this.positionDraftTimer(cyclist);

    if (this.droppedFromDraft) {
      cyclist.x += 220 * deltaSeconds;
      this.positionDraftTimer(cyclist);
      if (cyclist.x > WIDTH + 50) {
        cyclist.destroy();
        this.draftTimerText?.destroy();
        this.draftTimerText = undefined;
        this.draftCyclist = undefined;
        this.encounterCountdown = Phaser.Math.Between(4_000, 6_500);
      }
      return;
    }

    const targetX = outsideDraftTargetX(this.domestiques.length);
    if (cyclist.x < targetX) {
      cyclist.x += 72 * deltaSeconds;
    } else {
      cyclist.x = Math.min(targetX, cyclist.x + 3 * deltaSeconds);
    }
    this.positionDraftTimer(cyclist);
    if (cyclist.x < targetX - 12) return;

    const aligned =
      Math.abs(this.rider.y - cyclist.y) < rules.laneTolerancePx;
    if (!this.drafting) {
      this.draftAcquisitionRemaining -= delta;
      if (aligned) {
        this.drafting = true;
        this.draftGraceRemaining = rules.reactionSeconds;
        this.draftTimeRemaining = rules.durationSeconds;
        gameStore.setTemporaryDraftBonus(RANDOM_RIDER_DRAFT_BONUS);
        this.draftTimerText?.setText(
          formatDraftTimer(this.draftTimeRemaining),
        );
        this.showEncounter(
          `IN THE DRAFT · +50% SPEED · ${rules.durationSeconds}s`,
          1_600,
        );
        this.rewardFlow(12, "DRAFT");
      } else if (this.draftAcquisitionRemaining <= 0) {
        this.dropDraft();
      }
      return;
    }

    this.draftTimeRemaining -= deltaSeconds;
    this.draftTimerText?.setText(formatDraftTimer(this.draftTimeRemaining));
    if (this.draftTimeRemaining <= 0) {
      this.finishDraft();
      return;
    }

    this.draftLaneCountdown -= delta;
    if (this.draftLaneCountdown <= 0) {
      const direction =
        this.draftLane === 0
          ? 1
          : this.draftLane === 2
            ? -1
            : Math.random() < 0.5
              ? -1
              : 1;
      this.draftLane += direction;
      this.draftLaneCountdown = Phaser.Math.Between(2_500, 4_000);
      this.draftGraceRemaining = rules.reactionSeconds;
      this.showEncounter("FOLLOW THE WHEEL!", 900);
    }

    if (aligned) {
      this.draftGraceRemaining = rules.reactionSeconds;
      gameStore.setTemporaryDraftBonus(RANDOM_RIDER_DRAFT_BONUS);
      this.flow = addFlow(this.flow, deltaSeconds * 2.5);
      this.lastFlowActionAt = this.time.now;
    } else {
      this.draftGraceRemaining -= deltaSeconds;
      if (this.draftGraceRemaining <= 0) {
        this.dropDraft();
      }
    }
  }

  private dropDraft(): void {
    this.drafting = false;
    this.droppedFromDraft = true;
    gameStore.setTemporaryDraftBonus(0);
    this.draftTimerText?.setText("DROPPED");
    this.showEncounter("DROPPED!", 1_300);
  }

  private finishDraft(): void {
    this.drafting = false;
    this.droppedFromDraft = true;
    gameStore.setTemporaryDraftBonus(0);
    this.draftTimerText?.setText("0s");
    this.showEncounter("RIDER ACCELERATES AWAY", 1_500);
  }

  private positionDraftTimer(cyclist: Phaser.GameObjects.Sprite): void {
    this.draftTimerText?.setPosition(cyclist.x, cyclist.y - 27);
  }

  private syncDomestiques(level: number): void {
    const targetCount = Math.max(0, Math.min(3, Math.floor(level)));
    while (this.domestiques.length < targetCount) {
      const rider = this.add
        .sprite(
          domestiqueFormationX(targetCount)[this.domestiques.length],
          this.roadY(
            this.rider.y,
            domestiqueFormationX(targetCount)[this.domestiques.length],
          ),
          "domestique-rider",
        )
        .setDisplaySize(CYCLIST_WIDTH, CYCLIST_HEIGHT)
        .setDepth(10);
      this.domestiques.push(rider);
    }
    while (this.domestiques.length > targetCount) {
      this.domestiques.pop()?.destroy();
    }
  }

  private updateDomestiques(delta: number): void {
    const positions = domestiqueFormationX(this.domestiques.length);
    const response = 1 - Math.exp(-delta / 165);
    this.domestiques.forEach((rider, index) => {
      rider.x = positions[index];
      rider.y = Phaser.Math.Linear(
        rider.y,
        this.roadY(cyclistLaneY(LANE_Y[this.targetLane]), rider.x),
        response,
      );
      rider.setAngle(roadAngleDegrees(this.roadGradient));
    });
  }

  private updateSpeedFeedback(
    delta: number,
    scrollSpeed: number,
    speedKmh: number,
    gradient: number,
  ): void {
    const intensity = Phaser.Math.Clamp((speedKmh - 8) / 30, 0.12, 1);
    this.roadParticles.forEach((particle, index) => {
      particle.x -= scrollSpeed * (1.3 + intensity) * (delta / 1_000);
      particle.setAlpha(0.08 + intensity * 0.38);
      if (particle.x < -10) {
        particle.x = WIDTH + index * 7;
      }
      particle.y = this.roadY(
        Number(particle.getData("baseRoadY")),
        particle.x,
      );
      particle.setAngle(roadAngleDegrees(gradient));
    });
    this.rider.setAngle(roadAngleDegrees(gradient));
    if (speedKmh > 32 && Math.random() < delta / 2_000) {
      this.cameras.main.shake(65, 0.0015);
    }
  }

  private updatePowerUpFeedback(
    activePowerUp: GameSnapshot["activePowerUp"],
  ): void {
    if (!activePowerUp) {
      this.powerUpAura.setVisible(false);
      return;
    }

    const color =
      activePowerUp.type === "super-draft" ? 0x71f5cc : 0xf1cf4b;
    this.powerUpAura
      .setVisible(true)
      .setPosition(this.rider.x - 2, this.rider.y)
      .setAngle(this.rider.angle)
      .setFillStyle(color, 0.1)
      .setStrokeStyle(3, color, 0.65 + Math.sin(this.time.now / 90) * 0.2)
      .setScale(1 + Math.sin(this.time.now / 120) * 0.06);
  }

  private floatText(x: number, y: number, label: string, color: string): void {
    const text = this.add
      .text(x, y, label, {
        fontFamily: CANVAS_FONT,
        fontSize: "14px",
        color,
        stroke: "#26323a",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({
      targets: text,
      y: y - 28,
      alpha: 0,
      duration: 700,
      onComplete: () => text.destroy(),
    });
  }

  private createCyclistTexture(
    key: string,
    jerseyColor: string,
    bikeColor: string,
    alternatePedal = false,
  ): void {
    if (this.textures.exists(key)) return;

    const texture = this.textures.createCanvas(
      key,
      CYCLIST_WIDTH * CYCLIST_TEXTURE_SCALE,
      CYCLIST_HEIGHT * CYCLIST_TEXTURE_SCALE,
    );
    if (!texture) {
      throw new Error(`Unable to create cyclist texture: ${key}`);
    }
    const context = texture.context;
    context.scale(CYCLIST_TEXTURE_SCALE, CYCLIST_TEXTURE_SCALE);
    context.lineCap = "round";
    context.lineJoin = "round";

    const line = (
      color: string,
      width: number,
      points: Array<[number, number]>,
    ): void => {
      context.beginPath();
      context.strokeStyle = color;
      context.lineWidth = width;
      context.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => context.lineTo(x, y));
      context.stroke();
    };

    const wheel = (x: number): void => {
      context.beginPath();
      context.strokeStyle = "#17232a";
      context.lineWidth = 3;
      context.arc(x, 37, 10, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.strokeStyle = "#dce9e8";
      context.lineWidth = 1.25;
      context.arc(x, 37, 7, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = "rgba(220, 233, 232, 0.58)";
      context.lineWidth = 0.75;
      for (let spoke = 0; spoke < 8; spoke += 1) {
        const angle = (spoke * Math.PI) / 4;
        line("rgba(220, 233, 232, 0.58)", 0.75, [
          [x, 37],
          [x + Math.cos(angle) * 6.5, 37 + Math.sin(angle) * 6.5],
        ]);
      }
    };

    context.fillStyle = "rgba(16, 27, 32, 0.22)";
    context.beginPath();
    context.ellipse(28, 46, 25, 2, 0, 0, Math.PI * 2);
    context.fill();
    wheel(12);
    wheel(44);

    line(bikeColor, 2.7, [
      [12, 37],
      [25, 23],
      [29, 37],
      [12, 37],
      [31, 37],
      [40, 22],
      [44, 37],
      [29, 37],
      [25, 23],
      [39, 23],
    ]);
    line("#17232a", 1.8, [
      [22, 21],
      [28, 21],
    ]);
    line("#17232a", 1.8, [
      [38, 21],
      [43, 19],
    ]);
    context.beginPath();
    context.fillStyle = "#f4d35e";
    context.arc(29, 37, 2.8, 0, Math.PI * 2);
    context.fill();

    const frontKnee: [number, number] = alternatePedal ? [20, 30] : [33, 29];
    const frontFoot: [number, number] = alternatePedal ? [24, 38] : [36, 37];
    const rearKnee: [number, number] = alternatePedal ? [33, 29] : [20, 30];
    const rearFoot: [number, number] = alternatePedal ? [36, 37] : [24, 38];
    line("#26323a", 3.2, [
      [26, 21],
      rearKnee,
      rearFoot,
    ]);
    line("#f1a27d", 2.6, [
      [26, 20],
      frontKnee,
      frontFoot,
    ]);

    context.beginPath();
    context.fillStyle = "#26323a";
    context.moveTo(23, 18);
    context.lineTo(31, 17);
    context.lineTo(30, 24);
    context.lineTo(24, 24);
    context.closePath();
    context.fill();

    context.beginPath();
    context.fillStyle = jerseyColor;
    context.moveTo(24, 10);
    context.quadraticCurveTo(31, 10, 36, 16);
    context.lineTo(31, 22);
    context.lineTo(24, 19);
    context.closePath();
    context.fill();
    line("#f1a27d", 2.8, [
      [32, 13],
      [38, 17],
      [41, 22],
    ]);

    context.beginPath();
    context.fillStyle = "#f2b28c";
    context.arc(30, 7, 4.3, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.fillStyle = "#26323a";
    context.moveTo(25, 6);
    context.quadraticCurveTo(29, 0.5, 36, 5);
    context.lineTo(35, 7);
    context.lineTo(26, 7);
    context.closePath();
    context.fill();
    line("#f5f0df", 1.1, [
      [27, 5],
      [33, 5],
    ]);

    texture.refresh();
  }

  private createFanTexture(key: string, raisedArm: boolean): void {
    if (this.textures.exists(key)) return;

    const texture = this.textures.createCanvas(
      key,
      FAN_WIDTH * FAN_TEXTURE_SCALE,
      FAN_HEIGHT * FAN_TEXTURE_SCALE,
    );
    if (!texture) {
      throw new Error(`Unable to create fan texture: ${key}`);
    }

    const context = texture.context;
    context.scale(FAN_TEXTURE_SCALE, FAN_TEXTURE_SCALE);
    context.lineCap = "round";
    context.lineJoin = "round";

    context.fillStyle = "rgba(19, 31, 36, 0.3)";
    context.beginPath();
    context.ellipse(8, 20.5, 7, 1.3, 0, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "#26323a";
    context.lineWidth = 2.4;
    context.beginPath();
    context.moveTo(6, 14);
    context.lineTo(5, 20);
    context.moveTo(10, 14);
    context.lineTo(11, 20);
    context.stroke();

    context.fillStyle = "#4f7cac";
    context.beginPath();
    context.roundRect(4, 7, 8, 9, 2);
    context.fill();

    context.strokeStyle = "#f2b28c";
    context.lineWidth = 2.2;
    context.beginPath();
    context.moveTo(5, 9);
    context.lineTo(raisedArm ? 1.5 : 0.5, raisedArm ? 3 : 10);
    context.moveTo(11, 9);
    context.lineTo(raisedArm ? 15 : 15.5, raisedArm ? 1.5 : 10);
    context.stroke();

    context.fillStyle = "#f2b28c";
    context.beginPath();
    context.arc(8, 4, 3.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#26323a";
    context.beginPath();
    context.arc(8, 3, 3.5, Math.PI, Math.PI * 2);
    context.fill();

    texture.refresh();
  }

  private createTextures(): void {
    const texture = (
      key: string,
      width: number,
      height: number,
      draw: (graphics: Phaser.GameObjects.Graphics) => void,
    ) => {
      if (this.textures.exists(key)) return;
      const graphics = this.add.graphics({ x: 0, y: 0 });
      draw(graphics);
      graphics.generateTexture(key, width, height);
      graphics.destroy();
    };

    this.createCyclistTexture("rider-a", "#ef6f51", "#f1cf4b");
    this.createCyclistTexture("rider-b", "#ef6f51", "#f1cf4b", true);
    this.createCyclistTexture("draft-rider", "#4f7cac", "#71f5cc");
    this.createCyclistTexture(
      "domestique-rider",
      "#8ee36b",
      "#f1cf4b",
      true,
    );
    this.createFanTexture("fan-a", false);
    this.createFanTexture("fan-b", true);
    texture("bag-sweat", 18, 18, (g) => {
      g.fillStyle(0x26323a, 0.24).fillEllipse(9, 16, 14, 3);
      g.fillStyle(0x6fe3cb).fillRect(2, 4, 14, 12);
      g.fillStyle(0xe9fff8)
        .fillTriangle(9, 5, 5.5, 10, 12.5, 10)
        .fillCircle(9, 10, 3.5);
      g.fillStyle(0x26323a).fillRect(6, 1, 6, 4);
    });
    texture("bag-cash", 18, 18, (g) => {
      g.fillStyle(0x26323a, 0.24).fillEllipse(9, 16, 14, 3);
      g.fillStyle(0xf1cf4b).fillRect(2, 4, 14, 12);
      g.fillStyle(0x26323a).fillRect(8, 7, 2, 6);
      g.fillStyle(0x26323a).fillRect(6, 9, 6, 2);
      g.fillStyle(0x26323a).fillRect(6, 1, 6, 4);
    });
    texture("power-super-draft", 32, 32, (g) => {
      g.fillStyle(0x162b32, 0.92).fillCircle(16, 16, 15);
      g.lineStyle(2, 0x71f5cc, 1).strokeCircle(16, 16, 13);
      g.lineStyle(3, 0x71f5cc, 1)
        .lineBetween(6, 10, 21, 10)
        .lineBetween(18, 6, 23, 10)
        .lineBetween(18, 14, 23, 10)
        .lineBetween(9, 21, 24, 21)
        .lineBetween(21, 17, 26, 21)
        .lineBetween(21, 25, 26, 21);
    });
    texture("power-super-power", 32, 32, (g) => {
      g.fillStyle(0x3a3117, 0.95).fillCircle(16, 16, 15);
      g.lineStyle(2, 0xf1cf4b, 1).strokeCircle(16, 16, 13);
      g.fillStyle(0xffe26f)
        .fillTriangle(17, 4, 8, 18, 16, 17)
        .fillTriangle(15, 15, 24, 14, 12, 28);
    });
    texture("pothole", 44, 20, (g) => {
      g.fillStyle(0xe7d8b5).fillEllipse(22, 10, 43, 18);
      g.fillStyle(0x39434a).fillEllipse(22, 10, 38, 14);
      g.fillStyle(0x171d21).fillEllipse(22, 11, 28, 9);
      g.lineStyle(2, 0xf19b58, 0.95)
        .lineBetween(3, 5, 10, 8)
        .lineBetween(35, 4, 30, 8)
        .lineBetween(39, 14, 33, 12);
    });
    texture("mountains", 128, 110, (g) => {
      g.fillStyle(0x7099a1)
        .fillTriangle(0, 110, 38, 28, 78, 110)
        .fillTriangle(48, 110, 92, 12, 128, 110);
      g.fillStyle(0xdbe9df)
        .fillTriangle(27, 51, 38, 28, 49, 51)
        .fillTriangle(80, 39, 92, 12, 103, 39);
      g.fillStyle(0x50777d).fillTriangle(0, 110, 18, 63, 48, 110);
    });
    texture("fields", 128, 56, (g) => {
      g.fillStyle(0x69a84f).fillRect(0, 0, 128, 56);
      g.fillStyle(0x4a8b46)
        .fillTriangle(0, 56, 24, 6, 42, 56)
        .fillTriangle(45, 56, 78, 12, 104, 56)
        .fillTriangle(92, 56, 116, 2, 128, 56);
    });
  }
}
