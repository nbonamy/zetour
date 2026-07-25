import Phaser from "phaser";
import { gameStore } from "../core/gameStore";
import { RANDOM_RIDER_DRAFT_BONUS } from "../core/drafting";
import {
  addFlow,
  chooseEncounter,
  decayFlow,
  domestiqueFormationX,
  draftRulesForStage,
  encounterLabel,
  flowMultiplier,
  formatDraftTimer,
  hasPickupPassedRider,
  isRemainingSequencePickup,
  outsideDraftTargetX,
  type RideEncounter,
} from "./rideSystems";

type RoadObject = Phaser.Physics.Arcade.Image & {
  eventType?: "sweat" | "cash" | "pothole";
  companion?: Phaser.GameObjects.Image;
  sequenceId?: number;
  sequenceIndex?: number;
  sequenceFailed?: boolean;
};

const WIDTH = 640;
const HEIGHT = 360;
const LANE_Y = [196, 248, 300];

export class GameScene extends Phaser.Scene {
  private rider!: Phaser.Physics.Arcade.Sprite;
  private pickups!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.Group;
  private mountain!: Phaser.GameObjects.TileSprite;
  private fields!: Phaser.GameObjects.TileSprite;
  private gradeMarkers!: Phaser.GameObjects.TileSprite;
  private conditionText!: Phaser.GameObjects.Text;
  private encounterText!: Phaser.GameObjects.Text;
  private flowText!: Phaser.GameObjects.Text;
  private flowBar!: Phaser.GameObjects.Rectangle;
  private windStreaks: Phaser.GameObjects.Rectangle[] = [];
  private roadParticles: Phaser.GameObjects.Rectangle[] = [];
  private laneMarkers: Phaser.GameObjects.TileSprite[] = [];
  private targetLane = 1;
  private encounterCountdown = 1_200;
  private encounterCount = 0;
  private pickupSequenceCount = 0;
  private animationCountdown = 120;
  private riderFrame = false;
  private lastPointerMoveAt = 0;
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

  constructor() {
    super("ride");
  }

  create(): void {
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

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const y = Phaser.Math.Clamp(pointer.y, LANE_Y[0], LANE_Y[2]);
      this.targetLane = LANE_Y.reduce(
        (best, laneY, index) =>
          Math.abs(laneY - y) < Math.abs(LANE_Y[best] - y) ? index : best,
        0,
      );
      this.lastPointerMoveAt = this.time.now;
    });
  }

  update(_time: number, delta: number): void {
    gameStore.tick(delta / 1_000);
    const snapshot = gameStore.getSnapshot();
    const scrollSpeed = 58 + snapshot.stats.speedKmh * 1.9;
    const isActive = this.time.now - this.lastPointerMoveAt < 5_000;
    const windPenalty = snapshot.stageDefinition.windPenalty;
    const gradient = snapshot.stageDefinition.gradient;

    this.mountain.tilePositionX += scrollSpeed * delta * 0.00014;
    this.fields.tilePositionX += scrollSpeed * delta * 0.00035;
    this.gradeMarkers.tilePositionX += scrollSpeed * delta * 0.001;
    this.gradeMarkers.setAlpha(
      gradient > 0 ? Math.min(0.75, 0.15 + gradient * 7) : 0,
    );
    this.laneMarkers.forEach((marker) => {
      marker.tilePositionX += scrollSpeed * delta * 0.001;
    });
    this.windStreaks.forEach((streak, index) => {
      streak.setVisible(windPenalty > 0);
      streak.setAlpha(Math.min(0.8, 0.2 + windPenalty * 2.5));
      streak.x -= (90 + windPenalty * 850) * (delta / 1_000);
      if (streak.x < -40) {
        streak.x = WIDTH + 30 + index * 13;
      }
    });
    this.conditionText.setText(
      `${
    windPenalty > 0
      ? snapshot.stats.windMitigation > 0
        ? `HEADWIND ${Math.round(windPenalty * 100)}% · AFTER AERO ${Math.round(snapshot.stats.effectiveWindPenalty * 100)}%`
        : `HEADWIND ${Math.round(windPenalty * 100)}%`
      : "CALM"
      }  |  ${
        gradient > 0
          ? `CLIMB ↗ ${(gradient * 100).toFixed(1)}%`
          : "FLAT"
      }`,
    );

    const response = 1 - Math.exp(-delta / (210 / snapshot.stats.handling));
    this.rider.y = Phaser.Math.Linear(
      this.rider.y,
      LANE_Y[this.targetLane],
      response,
    );
    this.rider.setVelocityY(0);
    this.syncDomestiques(snapshot.upgrades.domestique ?? 0);
    this.updateDomestiques(delta);

    this.updateRoadObjects(this.pickups, scrollSpeed);
    this.updateRoadObjects(this.hazards, scrollSpeed);
    this.updateFlow(delta, snapshot.stats.flowDecayPerSecond);
    this.updateDraft(delta, snapshot.stage);
    this.updateSpeedFeedback(
      delta,
      scrollSpeed,
      snapshot.stats.speedKmh,
      gradient,
    );

    this.encounterCountdown -= delta;
    if (this.encounterCountdown <= 0 && !this.draftCyclist) {
      const encounter =
        this.encounterCount === 1
          ? "draft"
          : chooseEncounter(snapshot.stageDefinition);
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

    this.rider.setData("safeCruise", !isActive);
  }

  private createWorld(): void {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x8ed7e8);
    this.add.circle(545, 58, 28, 0xffe390);
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

    this.add.rectangle(WIDTH / 2, 258, WIDTH, 186, 0x59636b);
    this.add.rectangle(WIDTH / 2, 166, WIDTH, 12, 0x3f8b52);
    this.add.rectangle(WIDTH / 2, 348, WIDTH, 24, 0x3f8b52);
    this.add.rectangle(WIDTH / 2, 176, WIDTH, 2, 0xd7d2b5);
    this.add.rectangle(WIDTH / 2, 338, WIDTH, 2, 0xd7d2b5);
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
        .setDepth(3),
    );

    [222, 274].forEach((y) => {
      this.laneMarkers.push(
        this.add.tileSprite(WIDTH / 2, y, WIDTH, 3, "lane-dash"),
      );
    });
    this.gradeMarkers = this.add
      .tileSprite(WIDTH / 2, 248, WIDTH, 16, "climb-chevron")
      .setDepth(3)
      .setAlpha(0);

    this.add
      .text(12, 338, "MOVE THE MOUSE UP / DOWN — NO CLICKING", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#fff8d8",
      })
      .setDepth(20);
    this.conditionText = this.add
      .text(12, 12, "CALM  |  FLAT", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#fff8d8",
        stroke: "#26323a",
        strokeThickness: 3,
      })
      .setDepth(20);
    this.encounterText = this.add
      .text(WIDTH / 2, 42, "", {
        fontFamily: "monospace",
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
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#fff8d8",
        stroke: "#26323a",
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setDepth(21);
  }

  private createRider(): void {
    this.rider = this.physics.add.sprite(112, LANE_Y[1], "rider-a");
    this.rider.setDepth(10);
    this.rider.body?.setSize(24, 24);
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
      LANE_Y[lane],
      texture,
    ) as RoadObject;
    object.eventType = type;
    object.sequenceId = sequenceId;
    object.sequenceIndex = sequenceIndex;
    object.setDepth(8);
    this.pickups.add(object);

    const fanY = lane === 0 ? 164 : 346;
    const fan = this.add.image(x, fanY, "fan").setDepth(6);
    object.companion = fan;
  }

  private spawnPothole(
    lane = Phaser.Math.Between(0, 2),
    x = WIDTH + 24,
  ): void {
    const pothole = this.physics.add.image(
      x,
      LANE_Y[lane] + 8,
      "pothole",
    ) as RoadObject;
    pothole.eventType = "pothole";
    pothole.setDepth(4);
    pothole.body?.setSize(28, 10);
    this.hazards.add(pothole);
  }

  private updateRoadObjects(
    group: Phaser.Physics.Arcade.Group,
    scrollSpeed: number,
  ): void {
    group.getChildren().forEach((child) => {
      const object = child as RoadObject;
      if (object.sequenceFailed) return;

      object.setVelocityX(-scrollSpeed);
      if (object.companion) {
        object.companion.x = object.x;
      }
      if (
        object.eventType === "pothole" &&
        !object.getData("passedRider") &&
        object.x <= this.rider.x
      ) {
        object.setData("passedRider", true);
        const gap = Math.abs(object.y - this.rider.y);
        const activelySteering = this.time.now - this.lastPointerMoveAt < 5_000;
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
    const multiplier = flowMultiplier(this.flow);
    const amount = gameStore.collectBag(
      object.eventType ?? "cash",
      multiplier,
    );
    this.rewardFlow(10, `COMBO ${this.combo + 1}`);
    this.floatText(
      object.x,
      object.y - 16,
      `+${amount}${object.eventType === "sweat" ? "S" : "$"}`,
      object.eventType === "sweat" ? "#71f5cc" : "#ffe26f",
    );
    object.companion?.destroy();
    object.destroy();
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
      pickup.setVelocityX(0);
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
    const safeCruise = Boolean(this.rider.getData("safeCruise"));
    if (safeCruise) {
      object.destroy();
      return;
    }

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
    const startX = WIDTH + 60;
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
      case "draft":
        this.spawnDraftCyclist();
        break;
    }
  }

  private showEncounter(label: string, duration = 2_200): void {
    this.encounterText.setText(label).setAlpha(1);
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
      .sprite(-42, LANE_Y[this.draftLane], "draft-rider")
      .setDepth(11);
    this.draftTimerText = this.add
      .text(-42, LANE_Y[this.draftLane] - 27, "CATCH", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#fff8d8",
        backgroundColor: "#26323a",
        padding: { x: 4, y: 2 },
      })
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
      LANE_Y[this.draftLane],
      1 - Math.exp(-delta / 180),
    );
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
          this.rider.y,
          "domestique-rider",
        )
        .setDepth(10);
      this.domestiques.push(rider);
    }
    while (this.domestiques.length > targetCount) {
      this.domestiques.pop()?.destroy();
    }
  }

  private updateDomestiques(delta: number): void {
    const positions = domestiqueFormationX(this.domestiques.length);
    const targetY = LANE_Y[this.targetLane];
    const response = 1 - Math.exp(-delta / 165);
    this.domestiques.forEach((rider, index) => {
      rider.x = positions[index];
      rider.y = Phaser.Math.Linear(rider.y, targetY, response);
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
    });
    this.rider.setAngle(-gradient * 75);
    if (speedKmh > 32 && Math.random() < delta / 2_000) {
      this.cameras.main.shake(65, 0.0015);
    }
  }

  private floatText(x: number, y: number, label: string, color: string): void {
    const text = this.add
      .text(x, y, label, {
        fontFamily: "monospace",
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

    texture("rider-a", 38, 34, (g) => {
      g.fillStyle(0x26323a).fillCircle(9, 25, 8).fillCircle(29, 25, 8);
      g.fillStyle(0x8ed7e8).fillCircle(9, 25, 5).fillCircle(29, 25, 5);
      g.lineStyle(3, 0xf1cf4b)
        .lineBetween(9, 25, 19, 16)
        .lineBetween(19, 16, 29, 25)
        .lineBetween(9, 25, 23, 25)
        .lineBetween(19, 16, 23, 25);
      g.fillStyle(0xef6f51).fillRect(17, 7, 7, 10);
      g.fillStyle(0xf2b28c).fillCircle(21, 5, 4);
      g.fillStyle(0x26323a).fillRect(16, 1, 10, 3);
      g.lineStyle(3, 0x26323a).lineBetween(20, 16, 14, 23);
    });
    texture("rider-b", 38, 34, (g) => {
      g.fillStyle(0x26323a).fillCircle(9, 25, 8).fillCircle(29, 25, 8);
      g.fillStyle(0x8ed7e8).fillCircle(9, 25, 5).fillCircle(29, 25, 5);
      g.lineStyle(3, 0xf1cf4b)
        .lineBetween(9, 25, 19, 16)
        .lineBetween(19, 16, 29, 25)
        .lineBetween(9, 25, 23, 25)
        .lineBetween(19, 16, 23, 25);
      g.fillStyle(0xef6f51).fillRect(17, 7, 7, 10);
      g.fillStyle(0xf2b28c).fillCircle(21, 5, 4);
      g.fillStyle(0x26323a).fillRect(16, 1, 10, 3);
      g.lineStyle(3, 0x26323a).lineBetween(20, 16, 27, 22);
    });
    texture("draft-rider", 38, 34, (g) => {
      g.fillStyle(0x26323a).fillCircle(9, 25, 8).fillCircle(29, 25, 8);
      g.fillStyle(0x8ed7e8).fillCircle(9, 25, 5).fillCircle(29, 25, 5);
      g.lineStyle(3, 0x71f5cc)
        .lineBetween(9, 25, 19, 16)
        .lineBetween(19, 16, 29, 25)
        .lineBetween(9, 25, 23, 25)
        .lineBetween(19, 16, 23, 25);
      g.fillStyle(0x4f7cac).fillRect(17, 7, 7, 10);
      g.fillStyle(0xf2b28c).fillCircle(21, 5, 4);
      g.fillStyle(0xf5f0df).fillRect(16, 1, 10, 3);
      g.lineStyle(3, 0x26323a).lineBetween(20, 16, 14, 23);
    });
    texture("domestique-rider", 38, 34, (g) => {
      g.fillStyle(0x26323a).fillCircle(9, 25, 8).fillCircle(29, 25, 8);
      g.fillStyle(0x8ed7e8).fillCircle(9, 25, 5).fillCircle(29, 25, 5);
      g.lineStyle(3, 0xf1cf4b)
        .lineBetween(9, 25, 19, 16)
        .lineBetween(19, 16, 29, 25)
        .lineBetween(9, 25, 23, 25)
        .lineBetween(19, 16, 23, 25);
      g.fillStyle(0x8ee36b).fillRect(17, 7, 7, 10);
      g.fillStyle(0xf2b28c).fillCircle(21, 5, 4);
      g.fillStyle(0xf5f0df).fillRect(16, 1, 10, 3);
      g.lineStyle(3, 0x26323a).lineBetween(20, 16, 27, 22);
    });
    texture("bag-sweat", 18, 18, (g) => {
      g.fillStyle(0x6fe3cb).fillRect(2, 4, 14, 12);
      g.fillStyle(0xe9fff8).fillRect(7, 7, 4, 6);
      g.fillStyle(0x26323a).fillRect(6, 1, 6, 4);
    });
    texture("bag-cash", 18, 18, (g) => {
      g.fillStyle(0xf1cf4b).fillRect(2, 4, 14, 12);
      g.fillStyle(0x26323a).fillRect(8, 7, 2, 6);
      g.fillStyle(0x26323a).fillRect(6, 9, 6, 2);
      g.fillStyle(0x26323a).fillRect(6, 1, 6, 4);
    });
    texture("pothole", 32, 14, (g) => {
      g.fillStyle(0x30383d).fillEllipse(16, 8, 30, 11);
      g.fillStyle(0x1c2226).fillEllipse(16, 8, 21, 6);
      g.fillStyle(0x7d8588).fillRect(4, 3, 4, 2).fillRect(23, 10, 5, 2);
    });
    texture("fan", 16, 24, (g) => {
      g.fillStyle(0xf2b28c).fillCircle(8, 4, 4);
      g.fillStyle(0x4f7cac).fillRect(4, 8, 8, 10);
      g.fillStyle(0x26323a).fillRect(4, 18, 3, 6).fillRect(10, 18, 3, 6);
      g.fillStyle(0xf2b28c).fillRect(12, 9, 4, 3);
    });
    texture("lane-dash", 64, 3, (g) => {
      g.fillStyle(0xe8e0c9).fillRect(0, 0, 30, 3);
    });
    texture("climb-chevron", 64, 16, (g) => {
      g.lineStyle(3, 0xf1cf4b, 0.9)
        .lineBetween(5, 12, 13, 4)
        .lineBetween(13, 4, 21, 12)
        .lineBetween(37, 12, 45, 4)
        .lineBetween(45, 4, 53, 12);
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
