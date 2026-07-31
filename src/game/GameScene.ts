import Phaser from "phaser";
import {
  gameStore,
  powerUpDefinitions,
  stages,
  type GameSnapshot,
  type PowerUpType,
} from "../core/gameStore";
import { RANDOM_RIDER_DRAFT_BONUS } from "../core/drafting";
import { formatCompactNumber } from "../core/format";
import {
  addFlow,
  advanceLoopingRoadMarkerX,
  advanceRoadObjectX,
  decayFlow,
  domestiqueFormationX,
  draftAlignmentGap,
  draftRulesForStage,
  encounterChallengeRules,
  encounterDelayRange,
  encounterLabel,
  encounterStartX,
  fanFrameAt,
  flowMultiplier,
  formatDraftTimer,
  hasPickupPassedRider,
  isRemainingSequencePickup,
  lootSequenceForStage,
  moveLane,
  nextEncounter,
  oncomingTrafficSpeedMultiplier,
  outsideDraftTargetX,
  roadAngleDegrees,
  roadOffsetAtX,
  roadPowerUpChoices,
  roadsideFanClusterGap,
  roadsideFanGroupSize,
  roadScrollDistance,
  roadScrollSpeed,
  roadTileScrollDelta,
  trafficGauntletPattern,
  type RideEncounter,
} from "./rideSystems";
import {
  RIDE_RENDER_SCALE,
  RIDE_WORLD_HEIGHT,
  RIDE_WORLD_WIDTH,
  ROAD_HAZARD_LANE_OFFSET_Y,
  cyclistFrameTexture,
  cyclistLaneY,
  draftStreakStateAt,
  groundedRoadObjectOffsetY,
  jumpHeightAt,
  laneCentersBetween,
  powerUpPulseAt,
  roadHazardLaneY,
  syncRoadBodyPosition,
} from "./rendering";
import { readVisualQaOverrides } from "./visualQa";

type RoadObject = Phaser.Physics.Arcade.Image & {
  eventType?:
    | "sweat"
    | "cash"
    | "pothole"
    | "oncoming-car"
    | "oncoming-van"
    | PowerUpType;
  sequenceId?: number;
  sequenceIndex?: number;
  sequenceFailed?: boolean;
  powerUpChoiceId?: number;
  roadLane?: number;
  roadYOffset?: number;
  roadSpeedMultiplier?: number;
};

interface ChallengeRun {
  encounter: RideEncounter;
  totalPickups: number;
  collectedPickups: number;
  failed: boolean;
}

type RoadsideFan = Phaser.GameObjects.Image & {
  roadsideBaseY: number;
  fanVariant: number;
  frameOffset: number;
};

const WIDTH = RIDE_WORLD_WIDTH;
const HEIGHT = RIDE_WORLD_HEIGHT;
const CANVAS_FONT = "Georgia, 'Times New Roman', serif";
const CYCLIST_WIDTH = 96;
const CYCLIST_HEIGHT = 72;
const ROAD_TOP_Y = 194;
const ROAD_BOTTOM_Y = 310;
const LANE_DIVIDER_Y = [231, 269] as const;
const LANE_Y = laneCentersBetween(
  ROAD_TOP_Y,
  LANE_DIVIDER_Y,
  ROAD_BOTTOM_Y,
);
const SCENERY_OVERDRAW = 36;
const SCENERY_HEIGHT = ROAD_TOP_Y + SCENERY_OVERDRAW;
const SCENERY_TILE_SCALE = 0.36;
const SCENERY_TILE_SCALE_Y = SCENERY_HEIGHT / 512;
const ROADSIDE_TILE_WIDTH = WIDTH + 144;
const ROADSIDE_TILE_SCALE_X = 0.38;
const UPPER_ROADSIDE_HEIGHT = 26;
const UPPER_ROADSIDE_TEXTURE_HEIGHT = 68;
const LOWER_ROADSIDE_HEIGHT = 118;
const ROAD_TILE_SCALE = 0.32;
const BAG_SIZE = 28;
const POWER_UP_SIZE = 34;
const TRAFFIC_WIDTH = 104;
const TRAFFIC_HEIGHT = 78;
const TRAFFIC_GROUND_OFFSET_Y = -23;
const ENCOUNTER_TEXT_Y = 164;
const FAN_WIDTH = 32;
const FAN_HEIGHT = 42;
const FAN_VARIANT_COUNT = 4;
const INITIAL_FAN_SPAWN_DISTANCE = 70;
const MAX_ACTIVE_FANS = 8;
const DRAFT_LABEL_OFFSET_Y = 42;
const ROAD_MARKER_SPACING = 64;
const ROAD_MARKER_MIN_X = -ROAD_MARKER_SPACING;
const ROAD_MARKER_MAX_X =
  Math.ceil((WIDTH + ROAD_MARKER_SPACING) / ROAD_MARKER_SPACING) *
  ROAD_MARKER_SPACING;
const RANDOM_RIDER_DRAFT_PERCENT = Math.round(
  RANDOM_RIDER_DRAFT_BONUS * 100,
);
const POWER_UP_COLORS: Record<PowerUpType, { css: string; hex: number }> = {
  "super-draft": { css: "#71f5cc", hex: 0x71f5cc },
  "lucky-bidon": { css: "#a7e8ff", hex: 0xa7e8ff },
  jump: { css: "#ffe26f", hex: 0xffe26f },
};
const VISUAL_QA = readVisualQaOverrides();
const isPowerUpType = (
  type: RoadObject["eventType"],
): type is PowerUpType =>
  type !== undefined && Object.hasOwn(powerUpDefinitions, type);
const isTrafficHazard = (
  type: RoadObject["eventType"],
): type is "oncoming-car" | "oncoming-van" =>
  type === "oncoming-car" || type === "oncoming-van";

export class GameScene extends Phaser.Scene {
  private rider!: Phaser.Physics.Arcade.Sprite;
  private powerUpAura!: Phaser.GameObjects.Ellipse;
  private powerUpHalo!: Phaser.GameObjects.Ellipse;
  private powerUpSparks: Phaser.GameObjects.Arc[] = [];
  private pickups!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.Group;
  private scenery!: Phaser.GameObjects.TileSprite;
  private upperRoadside!: Phaser.GameObjects.TileSprite;
  private lowerRoadside!: Phaser.GameObjects.TileSprite;
  private roadGraphics!: Phaser.GameObjects.Graphics;
  private roadTexture!: Phaser.GameObjects.TileSprite;
  private encounterText!: Phaser.GameObjects.Text;
  private draftWake!: Phaser.GameObjects.Graphics;
  private draftWindStreaks: Phaser.GameObjects.Rectangle[] = [];
  private windStreaks: Phaser.GameObjects.Rectangle[] = [];
  private roadParticles: Phaser.GameObjects.Rectangle[] = [];
  private laneMarkers: Phaser.GameObjects.Rectangle[] = [];
  private fans: RoadsideFan[] = [];
  private fanSpawnDistance = INITIAL_FAN_SPAWN_DISTANCE;
  private roadGradient = 0;
  private targetLane = 1;
  private riderRoadY = cyclistLaneY(LANE_Y[1]);
  private encounterCountdown = VISUAL_QA.encounter ? 0 : 1_200;
  private encounterCount = 0;
  private pickupSequenceCount = 0;
  private challengeRuns = new Map<number, ChallengeRun>();
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
  private roadSurface: GameSnapshot["stageDefinition"]["surface"] = "road";
  private raceRevision = 0;

  constructor() {
    super("ride");
  }

  preload(): void {
    const pngTextures = [
      "rider-a",
      "rider-b",
      "draft-rider-a",
      "draft-rider-b",
      "domestique-rider-a",
      "domestique-rider-b",
      "bag-sweat",
      "bag-cash",
      "power-super-draft",
      "power-lucky-bidon",
      "power-jump",
      "pothole",
      "oncoming-car-red",
      "oncoming-van-cream",
    ];
    for (let variant = 1; variant <= FAN_VARIANT_COUNT; variant += 1) {
      pngTextures.push(`fan-${variant}-a`, `fan-${variant}-b`);
    }
    pngTextures.forEach((key) =>
      this.load.image(key, `/assets/art/${key}.png`),
    );
    for (let stage = 1; stage <= 5; stage += 1) {
      this.load.image(`stage-${stage}`, `/assets/art/stage-${stage}.jpg`);
    }
    this.load.image("roadside-upper", "/assets/art/roadside-upper.png");
    this.load.image("roadside-lower", "/assets/art/roadside-lower.jpg");
    this.load.image("road-texture", "/assets/art/road-texture.jpg");
    this.load.image(
      "road-texture-gravel",
      "/assets/art/road-texture-gravel.jpg",
    );
  }

  create(): void {
    this.cameras.main
      .setZoom(RIDE_RENDER_SCALE)
      .centerOn(WIDTH / 2, HEIGHT / 2);
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
    this.raceRevision = gameStore.getSnapshot().raceRevision;
  }

  update(_time: number, delta: number): void {
    this.cameras.main.centerOn(WIDTH / 2, HEIGHT / 2);
    const currentSnapshot = gameStore.getSnapshot();
    if (currentSnapshot.raceRevision !== this.raceRevision) {
      this.raceRevision = currentSnapshot.raceRevision;
      this.resetRaceWorld();
      return;
    }
    if (currentSnapshot.raceFinished) return;

    gameStore.tick(delta / 1_000);
    const snapshot = gameStore.getSnapshot();
    if (snapshot.raceFinished) return;
    const scrollSpeed = roadScrollSpeed(snapshot.stats.speedKmh);
    const gradient = VISUAL_QA.gradient ?? snapshot.currentGradient;
    const stageDefinition =
      VISUAL_QA.stage === null
        ? snapshot.stageDefinition
        : stages[VISUAL_QA.stage - 1];
    const windPenalty = stageDefinition.windPenalty;
    this.updateStageScenery(stageDefinition);
    this.scenery.tilePositionX += scrollSpeed * delta * 0.00018;
    this.upperRoadside.tilePositionX += roadTileScrollDelta(
      scrollSpeed,
      delta,
      ROADSIDE_TILE_SCALE_X,
    );
    this.lowerRoadside.tilePositionX += roadTileScrollDelta(
      scrollSpeed,
      delta,
      ROADSIDE_TILE_SCALE_X,
    );
    this.roadTexture.tilePositionX += roadTileScrollDelta(
      scrollSpeed,
      delta,
      ROAD_TILE_SCALE,
    );
    this.updateRoadIncline(gradient);
    this.updateLaneMarkers(scrollSpeed, delta);
    this.updateRoadsideFans(scrollSpeed, delta);
    this.windStreaks.forEach((streak, index) => {
      streak.setVisible(windPenalty > 0);
      streak.setAlpha(Math.min(0.8, 0.2 + windPenalty * 2.5));
      streak.x -= (90 + windPenalty * 850) * (delta / 1_000);
      if (streak.x < -40) {
        streak.x = WIDTH + 30 + index * 13;
      }
    });
    const response = 1 - Math.exp(-delta / (210 / snapshot.stats.handling));
    this.riderRoadY = Phaser.Math.Linear(
      this.riderRoadY,
      cyclistLaneY(LANE_Y[this.targetLane]),
      response,
    );
    this.rider.y = this.riderRoadY;
    this.rider
      .setAngle(roadAngleDegrees(gradient))
      .setDepth(10 + this.riderRoadY / 1_000);
    const visualActivePowerUp: GameSnapshot["activePowerUp"] =
      VISUAL_QA.powerUp
        ? {
            type: VISUAL_QA.powerUp,
            remainingSeconds:
              powerUpDefinitions[VISUAL_QA.powerUp].durationSeconds * 0.6,
          }
        : snapshot.activePowerUp;
    this.updatePowerUpFeedback(visualActivePowerUp);
    syncRoadBodyPosition(this.rider.body);
    this.syncDomestiques(
      VISUAL_QA.domestiques ?? snapshot.upgrades.domestique ?? 0,
    );
    this.updateDomestiques(delta);

    const activePowerUpDefinition = snapshot.activePowerUp
      ? powerUpDefinitions[snapshot.activePowerUp.type]
      : null;
    this.updateRoadObjects(
      this.pickups,
      scrollSpeed,
      delta,
      (activePowerUpDefinition?.pickupMagnet ?? false) ||
        snapshot.stats.pickupMagnet,
    );
    this.updateRoadObjects(this.hazards, scrollSpeed, delta);
    this.updateFlow(delta, snapshot.stats.flowDecayPerSecond);
    this.updateDraft(delta, snapshot.stage);
    const superDraftVisible =
      visualActivePowerUp?.type === "super-draft";
    this.updateDraftWindFeedback(
      this.drafting || VISUAL_QA.drafting || superDraftVisible,
      superDraftVisible ? POWER_UP_COLORS["super-draft"].hex : 0xffe7b6,
    );
    this.updateSpeedFeedback(
      delta,
      scrollSpeed,
      snapshot.stats.speedKmh,
      gradient,
    );
    this.encounterCountdown -= delta;
    if (this.encounterCountdown <= 0 && !this.draftCyclist) {
      const encounter =
        VISUAL_QA.encounter ??
        nextEncounter(
          snapshot.stageDefinition,
          this.encounterCount,
        );
      this.startEncounter(encounter);
      this.encounterCount += 1;
      const [minimumDelay, maximumDelay] = encounterDelayRange(snapshot.stage);
      this.encounterCountdown = Phaser.Math.Between(
        minimumDelay,
        maximumDelay,
      );
    }

    this.animationCountdown -= delta;
    if (this.animationCountdown <= 0) {
      this.riderFrame = !this.riderFrame;
      this.rider.setTexture(
        cyclistFrameTexture("player", this.riderFrame),
      );
      this.draftCyclist?.setTexture(
        cyclistFrameTexture("draft", this.riderFrame),
      );
      this.domestiques.forEach((rider) =>
        rider.setTexture(
          cyclistFrameTexture("domestique", this.riderFrame),
        ),
      );
      this.animationCountdown = Math.max(55, 180 - snapshot.stats.speedKmh * 4);
    }
  }

  private resetRaceWorld(): void {
    const clearRoadObjects = (
      group: Phaser.Physics.Arcade.Group,
    ): void => {
      group.getChildren().forEach((child) => {
        const object = child as RoadObject;
        this.tweens.killTweensOf(object);
      });
      group.clear(true, true);
    };

    clearRoadObjects(this.pickups);
    clearRoadObjects(this.hazards);
    this.fans.forEach((fan) => fan.destroy());
    this.fans = [];
    this.fanSpawnDistance = INITIAL_FAN_SPAWN_DISTANCE;

    this.draftCyclist?.destroy();
    this.draftTimerText?.destroy();
    this.draftCyclist = undefined;
    this.draftTimerText = undefined;
    this.domestiques.forEach((rider) => rider.destroy());
    this.domestiques = [];

    this.targetLane = 1;
    this.riderRoadY = cyclistLaneY(LANE_Y[1]);
    this.rider
      .clearTint()
      .setTexture(cyclistFrameTexture("player", false))
      .setPosition(112, this.riderRoadY)
      .setAngle(0)
      .setDepth(10 + this.riderRoadY / 1_000);
    syncRoadBodyPosition(this.rider.body);
    this.powerUpAura
      .setVisible(false)
      .setPosition(this.rider.x - 2, this.rider.y + 24)
      .setAngle(0)
      .setScale(1);
    this.powerUpHalo
      .setVisible(false)
      .setPosition(this.rider.x, this.rider.y)
      .setAngle(0)
      .setScale(1);
    this.powerUpSparks.forEach((spark) => spark.setVisible(false));
    this.draftWake.clear().setVisible(false);
    this.draftWindStreaks.forEach((streak) => streak.setVisible(false));

    this.encounterCountdown = VISUAL_QA.encounter ? 0 : 1_200;
    this.encounterCount = 0;
    this.pickupSequenceCount = 0;
    this.challengeRuns.clear();
    this.animationCountdown = 120;
    this.riderFrame = false;
    this.lastSteerAt = 0;
    this.flow = 0;
    gameStore.setActiveFlowMultiplier(1);
    this.combo = 0;
    this.lastFlowActionAt = this.time.now;
    this.encounterText.setText("").setAlpha(0);

    this.draftLane = 1;
    this.draftLaneCountdown = 0;
    this.draftGraceRemaining = 0;
    this.draftAcquisitionRemaining = 0;
    this.draftTimeRemaining = 0;
    this.drafting = false;
    this.droppedFromDraft = false;

    this.sceneryStage = 0;
    this.scenery.tilePositionX = 0;
    this.upperRoadside.tilePositionX = 0;
    this.lowerRoadside.tilePositionX = 0;
    this.roadTexture.tilePositionX = 0;
    this.windStreaks.forEach((streak, index) => {
      streak.x = 50 + index * 78;
      streak.setVisible(false);
    });
    this.roadParticles.forEach((particle, index) => {
      particle.x = (index * 53) % WIDTH;
    });
    const markersPerLane = this.laneMarkers.length / 2;
    this.laneMarkers.forEach((marker, index) => {
      marker.x =
        ROAD_MARKER_MIN_X +
        (index % markersPerLane) * ROAD_MARKER_SPACING;
    });
    this.updateRoadIncline(0, true);
  }

  private createWorld(): void {
    this.add.rectangle(
      WIDTH / 2,
      HEIGHT / 2,
      WIDTH,
      HEIGHT,
      0x79695b,
    );
    this.scenery = this.add
      .tileSprite(0, 0, WIDTH, SCENERY_HEIGHT, "stage-1")
      .setOrigin(0)
      .setTileScale(SCENERY_TILE_SCALE, SCENERY_TILE_SCALE_Y)
      .setDepth(1);
    this.upperRoadside = this.add
      .tileSprite(
        WIDTH / 2,
        ROAD_TOP_Y - UPPER_ROADSIDE_HEIGHT / 2,
        ROADSIDE_TILE_WIDTH,
        UPPER_ROADSIDE_HEIGHT,
        "roadside-upper",
      )
      .setTileScale(
        ROADSIDE_TILE_SCALE_X,
        UPPER_ROADSIDE_HEIGHT / UPPER_ROADSIDE_TEXTURE_HEIGHT,
      )
      .setDepth(1.5);
    this.lowerRoadside = this.add
      .tileSprite(
        WIDTH / 2,
        ROAD_BOTTOM_Y + LOWER_ROADSIDE_HEIGHT / 2,
        ROADSIDE_TILE_WIDTH,
        LOWER_ROADSIDE_HEIGHT,
        "roadside-lower",
      )
      .setTileScale(
        ROADSIDE_TILE_SCALE_X,
        LOWER_ROADSIDE_HEIGHT / 256,
      )
      .setDepth(1.5);
    this.windStreaks = Array.from({ length: 9 }, (_, index) =>
      this.add
        .rectangle(
          50 + index * 78,
          32 + (index % 4) * 31,
          18 + (index % 3) * 8,
          2,
          0xfff0ce,
        )
        .setDepth(2)
        .setVisible(false),
    );
    this.draftWake = this.add
      .graphics()
      .setDepth(9.15)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.draftWindStreaks = Array.from({ length: 12 }, () =>
      this.add
        .rectangle(0, 0, 20, 2, 0xffe7b6)
        .setDepth(9.2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false),
    );

    this.roadGraphics = this.add.graphics().setDepth(2);
    this.roadTexture = this.add
      .tileSprite(
        WIDTH / 2,
        (ROAD_TOP_Y + ROAD_BOTTOM_Y) / 2,
        WIDTH + 72,
        ROAD_BOTTOM_Y - ROAD_TOP_Y - 8,
        "road-texture",
      )
      .setTileScale(ROAD_TILE_SCALE)
      .setTint(0xd1b998)
      .setAlpha(0.58)
      .setDepth(2.5);
    this.roadParticles = Array.from({ length: 14 }, (_, index) =>
      this.add
        .rectangle(
          (index * 53) % WIDTH,
          204 + (index % 3) * 38,
          3 + (index % 4),
          2,
          0xf3dfb6,
          0.16,
        )
        .setDepth(5)
        .setData("baseRoadY", 204 + (index % 3) * 38),
    );

    [231, 269].forEach((y) => {
      for (
        let x = ROAD_MARKER_MIN_X;
        x < ROAD_MARKER_MAX_X;
        x += ROAD_MARKER_SPACING
      ) {
        this.laneMarkers.push(
          this.add
            .rectangle(x, y, 30, 3, 0xe5c98e)
            .setDepth(4)
            .setData("baseRoadY", y),
        );
      }
    });
    this.updateRoadIncline(0, true);

    this.encounterText = this.add
      .text(WIDTH / 2, ENCOUNTER_TEXT_Y, "", {
        fontFamily: CANVAS_FONT,
        fontSize: "12px",
        color: "#f5d66f",
        stroke: "#3a241b",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(25);
  }

  private updateStageScenery(stage: GameSnapshot["stageDefinition"]): void {
    if (this.sceneryStage === stage.number) return;
    this.sceneryStage = stage.number;
    this.roadSurface = stage.surface;
    const stageNumber = Phaser.Math.Clamp(stage.number, 1, 5);
    this.scenery.setTexture(`stage-${stageNumber}`);
    this.roadTexture
      .setTexture(
        stage.surface === "gravel"
          ? "road-texture-gravel"
          : "road-texture",
      )
      .setTint(stage.surface === "gravel" ? 0xe5c38f : 0xd1b998)
      .setAlpha(stage.surface === "gravel" ? 0.86 : 0.58);
    this.laneMarkers.forEach((marker) =>
      marker.setFillStyle(
        stage.surface === "gravel" ? 0xf1d7a2 : 0xe5c98e,
        stage.surface === "gravel" ? 0.4 : 1,
      ),
    );
    this.roadParticles.forEach((particle) =>
      particle.setFillStyle(
        stage.surface === "gravel" ? 0xffe3ab : 0xf3dfb6,
        stage.surface === "gravel" ? 0.26 : 0.16,
      ),
    );
    this.updateRoadIncline(this.roadGradient, true);
    this.showEncounter(
      stage.surface === "gravel"
        ? `GRAVEL SECTOR · ${stage.start.toUpperCase()} → ${stage.finish.toUpperCase()}`
        : `${stage.start.toUpperCase()} → ${stage.finish.toUpperCase()}`,
      2_400,
    );
  }

  private createRider(): void {
    this.powerUpAura = this.add
      .ellipse(112, cyclistLaneY(LANE_Y[1]) + 29, 82, 25, 0x71f5cc, 0.1)
      .setStrokeStyle(2, 0x71f5cc, 0.78)
      .setDepth(9.05)
      .setVisible(false);
    this.powerUpHalo = this.add
      .ellipse(112, cyclistLaneY(LANE_Y[1]), 104, 70, 0x71f5cc, 0.035)
      .setStrokeStyle(2, 0x71f5cc, 0.72)
      .setDepth(9.1)
      .setVisible(false);
    this.powerUpSparks = Array.from({ length: 8 }, () =>
      this.add
        .circle(0, 0, 2, 0x71f5cc, 0.8)
        .setDepth(12)
        .setVisible(false),
    );
    this.rider = this.physics.add.sprite(
      112,
      cyclistLaneY(LANE_Y[1]),
      cyclistFrameTexture("player", false),
    );
    this.rider
      .setDisplaySize(CYCLIST_WIDTH, CYCLIST_HEIGHT)
      .setDepth(10 + cyclistLaneY(LANE_Y[1]) / 1_000);
    this.rider.body?.setSize(88, 72, false).setOffset(84, 114);
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
    const gravel = this.roadSurface === "gravel";

    this.roadGraphics
      .clear()
      .fillStyle(gravel ? 0x846a4e : 0x5d5751)
      .fillPoints(
        [
          point(0, ROAD_TOP_Y + leftOffset),
          point(WIDTH, ROAD_TOP_Y + rightOffset),
          point(WIDTH, ROAD_BOTTOM_Y + rightOffset),
          point(0, ROAD_BOTTOM_Y + leftOffset),
        ],
        true,
      )
      .lineStyle(2, gravel ? 0xe4c17f : 0xe1c690)
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
    const centerOffset = roadOffsetAtX(WIDTH / 2, gradient);
    this.upperRoadside
      .setPosition(
        WIDTH / 2,
        ROAD_TOP_Y - UPPER_ROADSIDE_HEIGHT / 2 + centerOffset,
      )
      .setAngle(angle);
    this.lowerRoadside
      .setPosition(
        WIDTH / 2,
        ROAD_BOTTOM_Y + LOWER_ROADSIDE_HEIGHT / 2 + centerOffset,
      )
      .setAngle(angle);
    this.roadTexture
      .setPosition(
        WIDTH / 2,
        (ROAD_TOP_Y + ROAD_BOTTOM_Y) / 2 + centerOffset,
      )
      .setAngle(angle);
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

  private spawnFanCluster(
    groupSize = roadsideFanGroupSize(),
    startX = WIDTH + FAN_WIDTH,
  ): void {
    const availableSlots = Math.max(0, MAX_ACTIVE_FANS - this.fans.length);
    const fanCount = Math.min(groupSize, availableSlots);
    if (fanCount === 0) return;

    const baseY = ROAD_TOP_Y - 4;
    let x = startX;

    for (let index = 0; index < fanCount; index += 1) {
      if (index > 0) {
        x += FAN_WIDTH + Phaser.Math.Between(6, 14);
      }
      const variant = Phaser.Math.Between(1, FAN_VARIANT_COUNT);
      const roadsideBaseY = baseY + Phaser.Math.Between(-2, 2);
      const fan = this.add.image(
        x,
        this.roadY(roadsideBaseY, x),
        `fan-${variant}-a`,
      ) as RoadsideFan;
      fan.roadsideBaseY = roadsideBaseY;
      fan.fanVariant = variant;
      fan.frameOffset = Phaser.Math.Between(0, 520);
      fan
        .setDisplaySize(FAN_WIDTH, FAN_HEIGHT)
        .setOrigin(0.5, 1)
        .setDepth(6);
      this.fans.push(fan);
    }
  }

  private updateRoadsideFans(scrollSpeed: number, delta: number): void {
    const scrollDistance = roadScrollDistance(scrollSpeed, delta);
    this.fans = this.fans.filter((fan) => {
      fan.setX(fan.x - scrollDistance);
      fan.setY(this.roadY(fan.roadsideBaseY, fan.x));
      const frame = fanFrameAt(this.time.now, fan.frameOffset).endsWith("-a")
        ? "a"
        : "b";
      fan.setTexture(`fan-${fan.fanVariant}-${frame}`);
      if (fan.x >= -FAN_WIDTH) return true;
      fan.destroy();
      return false;
    });

    this.fanSpawnDistance -= scrollDistance;
    if (this.fanSpawnDistance <= 0) {
      this.spawnFanCluster();
      this.fanSpawnDistance += roadsideFanClusterGap();
    }
  }

  private spawnPickup(
    type: "sweat" | "cash",
    lane = Phaser.Math.Between(0, 2),
    x = WIDTH + 24,
    sequenceId?: number,
    sequenceIndex?: number,
  ): void {
    const texture = type === "sweat" ? "bag-sweat" : "bag-cash";
    const roadYOffset = groundedRoadObjectOffsetY(BAG_SIZE);
    const object = this.physics.add.image(
      x,
      this.roadY(LANE_Y[lane] + roadYOffset, x),
      texture,
    ) as RoadObject;
    object.eventType = type;
    object.sequenceId = sequenceId;
    object.sequenceIndex = sequenceIndex;
    object.roadLane = lane;
    object.roadYOffset = roadYOffset;
    object.setDisplaySize(BAG_SIZE, BAG_SIZE).setDepth(8);
    object.body?.setSize(24, 24);
    this.pickups.add(object);
  }

  private spawnPowerUp(
    type: PowerUpType,
    lane: number,
    x: number,
    choiceId: number,
  ): void {
    const roadYOffset = groundedRoadObjectOffsetY(POWER_UP_SIZE);
    const object = this.physics.add.image(
      x,
      this.roadY(LANE_Y[lane] + roadYOffset, x),
      `power-${type}`,
    ) as RoadObject;
    object.eventType = type;
    object.powerUpChoiceId = choiceId;
    object.roadLane = lane;
    object.roadYOffset = roadYOffset;
    object
      .setDisplaySize(POWER_UP_SIZE, POWER_UP_SIZE)
      .setDepth(9 + object.y / 1_000);
    object.body?.setSize(26, 26);
    this.pickups.add(object);
    const fittedScaleX = object.scaleX;
    const fittedScaleY = object.scaleY;
    this.tweens.add({
      targets: object,
      scaleX: fittedScaleX * 1.12,
      scaleY: fittedScaleY * 1.12,
      alpha: 0.78,
      duration: 360,
      yoyo: true,
      repeat: -1,
    });
  }

  private spawnPothole(
    lane = Phaser.Math.Between(0, 2),
    x = WIDTH + 24,
    sequenceId?: number,
  ): void {
    const pothole = this.physics.add.image(
      x,
      this.roadY(roadHazardLaneY(LANE_Y[lane]), x),
      "pothole",
    ) as RoadObject;
    pothole.eventType = "pothole";
    pothole.sequenceId = sequenceId;
    pothole.roadLane = lane;
    pothole.roadYOffset = ROAD_HAZARD_LANE_OFFSET_Y;
    pothole
      .setDisplaySize(54, 22)
      .setDepth(9 + pothole.y / 1_000);
    pothole.body?.setSize(46, 14);
    this.hazards.add(pothole);
  }

  private spawnOncomingVehicle(
    lane: number,
    x: number,
    sequenceId: number,
    variant: "car" | "van" = Math.random() < 0.62 ? "car" : "van",
  ): void {
    const texture =
      variant === "car" ? "oncoming-car-red" : "oncoming-van-cream";
    const eventType =
      variant === "car" ? "oncoming-car" : "oncoming-van";
    const roadYOffset = TRAFFIC_GROUND_OFFSET_Y;
    const vehicle = this.physics.add.image(
      x,
      this.roadY(LANE_Y[lane] + roadYOffset, x),
      texture,
    ) as RoadObject;
    vehicle.eventType = eventType;
    vehicle.sequenceId = sequenceId;
    vehicle.roadLane = lane;
    vehicle.roadYOffset = roadYOffset;
    vehicle.roadSpeedMultiplier = oncomingTrafficSpeedMultiplier(
      gameStore.getSnapshot().stage,
    );
    vehicle
      .setDisplaySize(TRAFFIC_WIDTH, TRAFFIC_HEIGHT)
      .setDepth(9 + vehicle.y / 1_000);
    vehicle.body?.setSize(390, 140, false).setOffset(60, 160);
    this.hazards.add(vehicle);
  }

  private updateRoadObjects(
    group: Phaser.Physics.Arcade.Group,
    scrollSpeed: number,
    delta: number,
    pickupMagnet = false,
  ): void {
    [...group.getChildren()].forEach((child) => {
      const object = child as RoadObject;
      if (object.sequenceFailed) return;

      object.setVelocity(0, 0);
      object.setX(
        advanceRoadObjectX(
          object.x,
          scrollSpeed * (object.roadSpeedMultiplier ?? 1),
          delta,
        ),
      );
      if (object.roadLane !== undefined) {
        object.setY(
          this.roadY(
            LANE_Y[object.roadLane] + (object.roadYOffset ?? 0),
            object.x,
          ),
        );
        syncRoadBodyPosition(object.body);
      }
      if (
        object.eventType === "pothole" ||
        isTrafficHazard(object.eventType)
      ) {
        object.setAngle(roadAngleDegrees(this.roadGradient));
      }
      if (
        pickupMagnet &&
        group === this.pickups &&
        (object.eventType === "sweat" || object.eventType === "cash") &&
        Math.abs(object.x - this.rider.x) <= 82
      ) {
        this.collect(object);
        return;
      }
      if (
        (object.eventType === "pothole" ||
          isTrafficHazard(object.eventType)) &&
        !object.getData("passedRider") &&
        object.x <= this.rider.x
      ) {
        object.setData("passedRider", true);
        const gap = Math.abs(object.y - this.rider.y);
        const activelySteering = this.time.now - this.lastSteerAt < 5_000;
        if (activelySteering && gap >= 24 && gap <= 78) {
          this.rewardFlow(
            isTrafficHazard(object.eventType) ? 22 : 15,
            isTrafficHazard(object.eventType)
              ? "TRAFFIC NEAR MISS"
              : "NEAR MISS",
          );
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
        this.destroyRoadObject(object);
      }
    });
  }

  private destroyRoadObject(object: RoadObject): void {
    this.tweens.killTweensOf(object);
    object.destroy();
  }

  private collect(object: RoadObject): void {
    if (
      !object.active ||
      object.sequenceFailed ||
      object.eventType === "pothole" ||
      isTrafficHazard(object.eventType)
    ) {
      return;
    }
    if (isPowerUpType(object.eventType)) {
      const definition = powerUpDefinitions[object.eventType];
      gameStore.collectPowerUp(object.eventType);
      this.rewardFlow(15, "POWER-UP");
      this.floatText(
        object.x,
        object.y - 18,
        `${definition.label.toUpperCase()} RESERVED`,
        POWER_UP_COLORS[object.eventType].css,
      );
      this.clearPowerUpChoice(object.powerUpChoiceId);
      return;
    }
    const bagType = object.eventType === "sweat" ? "sweat" : "cash";
    const sequenceId = object.sequenceId;
    const amount = gameStore.collectBag(bagType);
    this.rewardFlow(10, `COMBO ${this.combo + 1}`);
    this.floatText(
      object.x,
      object.y - 16,
      bagType === "sweat" ? `+${amount}💧` : `+$${amount}`,
      bagType === "sweat" ? "#71f5cc" : "#ffe26f",
    );
    this.destroyRoadObject(object);
    if (sequenceId !== undefined) {
      this.recordChallengePickup(sequenceId);
    }
  }

  private recordChallengePickup(sequenceId: number): void {
    const challenge = this.challengeRuns.get(sequenceId);
    if (!challenge) return;

    challenge.collectedPickups += 1;
    if (challenge.collectedPickups < challenge.totalPickups) return;

    const rules = encounterChallengeRules[challenge.encounter];
    this.challengeRuns.delete(sequenceId);
    if (!rules || challenge.failed) {
      this.showEncounter(
        `${encounterLabel[challenge.encounter]} SURVIVED · CLEAN BONUS LOST`,
        1_600,
      );
      return;
    }

    const reward = gameStore.completeChallenge(
      rules.cleanRewardMultiplier,
    );
    this.rewardFlow(
      rules.flowReward,
      `CLEAN ×${rules.cleanRewardMultiplier}`,
    );
    this.showEncounter(
      `CLEAN ×${rules.cleanRewardMultiplier} · +${formatCompactNumber(reward.sweat)} SWEAT · +$${formatCompactNumber(reward.cash)}`,
      2_200,
    );
  }

  private clearPowerUpChoice(choiceId: number | undefined): void {
    [...this.pickups.getChildren()].forEach((child) => {
      const pickup = child as RoadObject;
      if (
        choiceId !== undefined &&
        pickup.powerUpChoiceId === choiceId
      ) {
        this.destroyRoadObject(pickup);
      }
    });
  }

  private failPickupSequence(missedPickup: RoadObject): void {
    const sequenceId = missedPickup.sequenceId;
    const missedIndex = missedPickup.sequenceIndex;
    if (sequenceId === undefined || missedIndex === undefined) return;

    const challenge = this.challengeRuns.get(sequenceId);
    if (challenge) challenge.failed = true;

    this.destroyRoadObject(missedPickup);

    [...this.pickups.getChildren()].forEach((child) => {
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

      this.tweens.add({
        targets: pickup,
        alpha: 0.15,
        duration: 120,
        yoyo: true,
        repeat: 2,
        onComplete: () => this.destroyRoadObject(pickup),
      });
    });

    const rules = challenge
      ? encounterChallengeRules[challenge.encounter]
      : undefined;
    this.challengeRuns.delete(sequenceId);
    this.showEncounter(
      challenge && rules
        ? `${encounterLabel[challenge.encounter]} MISSED · CLEAN ×${rules.cleanRewardMultiplier} LOST`
        : "SEQUENCE MISSED — BONUSES LOST",
      1_400,
    );
  }

  private hitHazard(object: RoadObject): void {
    if (!object.active) return;

    const trafficCollision = isTrafficHazard(object.eventType);
    const activePowerUp = gameStore.getSnapshot().activePowerUp;
    if (
      object.eventType === "pothole" &&
      activePowerUp &&
      powerUpDefinitions[activePowerUp.type].potholeImmunity
    ) {
      this.rewardFlow(12, "CLEAN JUMP");
      this.floatText(object.x, object.y - 18, "CLEARED!", "#ffe26f");
      this.destroyRoadObject(object);
      return;
    }

    const challenge =
      object.sequenceId === undefined
        ? undefined
        : this.challengeRuns.get(object.sequenceId);
    if (challenge && !challenge.failed) {
      challenge.failed = true;
      const rules = encounterChallengeRules[challenge.encounter];
      if (rules) {
        this.showEncounter(
          `COLLISION · CLEAN ×${rules.cleanRewardMultiplier} LOST`,
          1_500,
        );
      }
    }

    const lost = trafficCollision
      ? gameStore.hitTraffic()
      : gameStore.hitPothole();
    this.flow = 0;
    gameStore.setActiveFlowMultiplier(1);
    this.combo = 0;
    this.lastFlowActionAt = this.time.now;
    this.floatText(
      object.x,
      object.y - 18,
      `-$${formatCompactNumber(lost)}`,
      "#ff8d7d",
    );
    this.cameras.main.shake(
      trafficCollision ? 210 : 120,
      trafficCollision ? 0.014 : 0.008,
    );
    this.rider.setTint(0xff9b91);
    this.time.delayedCall(240, () => this.rider.clearTint());
    this.destroyRoadObject(object);
  }

  private startEncounter(encounter: RideEncounter): void {
    const challengeRules = encounterChallengeRules[encounter];
    this.showEncounter(
      challengeRules
        ? `${encounterLabel[encounter]} · CLEAN ×${challengeRules.cleanRewardMultiplier}`
        : encounterLabel[encounter],
    );
    const startX = encounterStartX(encounter, WIDTH);
    const sequenceId = this.pickupSequenceCount;
    this.pickupSequenceCount += 1;
    const spawnLootSequence = (
      placements: Array<{ lane: number; x: number }>,
    ): void => {
      this.challengeRuns.set(sequenceId, {
        encounter,
        totalPickups: placements.length,
        collectedPickups: 0,
        failed: false,
      });
      const loot = lootSequenceForStage(
        gameStore.getSnapshot().stage,
        placements.length,
      );
      placements.forEach(({ lane, x }, index) => {
        this.spawnPickup(loot[index], lane, x, sequenceId, index);
      });
    };

    switch (encounter) {
      case "bonus-line": {
        const lane = Phaser.Math.Between(0, 2);
        spawnLootSequence(
          Array.from({ length: 4 }, (_, index) => ({
            lane,
            x: startX + index * 92,
          })),
        );
        this.spawnPothole((lane + 1) % 3, startX + 145, sequenceId);
        this.spawnPothole((lane + 2) % 3, startX + 330, sequenceId);
        break;
      }
      case "slalom": {
        const placements = [0, 1, 2, 1, 0].map((lane, index) => {
          this.spawnPothole(lane, startX + index * 82, sequenceId);
          return {
            lane: (lane + 1) % 3,
            x: startX + index * 82 + 40,
          };
        });
        spawnLootSequence(placements);
        break;
      }
      case "feed-zone": {
        const lane = Phaser.Math.Between(0, 2);
        spawnLootSequence(
          Array.from({ length: 6 }, (_, index) => ({
            lane,
            x: startX + index * 72,
          })),
        );
        break;
      }
      case "sprint": {
        const placements = Array.from({ length: 7 }, (_, index) => {
          const lane = index % 2 === 0 ? 1 : Phaser.Math.Between(0, 2);
          if (index === 2 || index === 5) {
            this.spawnPothole(
              (lane + 1) % 3,
              startX + index * 68 + 30,
              sequenceId,
            );
          }
          return { lane, x: startX + index * 68 };
        });
        spawnLootSequence(placements);
        break;
      }
      case "hairpins": {
        const placements = [0, 2, 0, 2, 1].map((lane, index) => {
          this.spawnPothole(lane, startX + index * 84, sequenceId);
          return {
            lane: lane === 0 ? 2 : 0,
            x: startX + index * 84 + 42,
          };
        });
        spawnLootSequence(placements);
        break;
      }
      case "traffic": {
        const placements = trafficGauntletPattern.map((column, index) => {
          const x = startX + index * 132;
          this.spawnOncomingVehicle(
            column.hazardLane,
            x,
            sequenceId,
            index % 3 === 2 ? "van" : "car",
          );
          return { lane: column.rewardLane, x: x + 52 };
        });
        spawnLootSequence(placements);
        break;
      }
      case "power-up":
        roadPowerUpChoices.forEach((type, lane) => {
          this.spawnPowerUp(type, lane, startX, sequenceId);
        });
        break;
      case "draft":
        this.spawnDraftCyclist();
        break;
    }
  }

  private showEncounter(label: string, duration = 2_200): void {
    this.encounterText
      .setPosition(WIDTH / 2, ENCOUNTER_TEXT_Y)
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
    this.floatText(this.rider.x + 18, this.rider.y - 46, label, "#f1cf4b");
  }

  private updateFlow(delta: number, decayPerSecond: number): void {
    if (VISUAL_QA.flow !== null) {
      this.flow = VISUAL_QA.flow;
    } else if (
      this.time.now - this.lastFlowActionAt > 2_500 &&
      !this.drafting
    ) {
      this.flow = decayFlow(this.flow, delta / 1_000, decayPerSecond);
      if (this.flow === 0) this.combo = 0;
    }
    const multiplier = flowMultiplier(this.flow);
    gameStore.setActiveFlowMultiplier(multiplier);
  }

  private spawnDraftCyclist(): void {
    if (this.draftCyclist) return;
    this.draftLane =
      VISUAL_QA.draftLane ?? Phaser.Math.Between(0, 2);
    this.draftCyclist = this.add
      .sprite(
        -42,
        this.roadY(cyclistLaneY(LANE_Y[this.draftLane]), -42),
        cyclistFrameTexture("draft", false),
      )
      .setDisplaySize(CYCLIST_WIDTH, CYCLIST_HEIGHT)
      .setDepth(
        10 +
          this.roadY(
            cyclistLaneY(LANE_Y[this.draftLane]),
            -42,
          ) /
            1_000,
      );
    this.draftTimerText = this.add
      .text(
        -42,
        this.roadY(LANE_Y[this.draftLane], -42) - DRAFT_LABEL_OFFSET_Y,
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
    cyclist.setDepth(10 + cyclist.y / 1_000);
    this.positionDraftTimer(cyclist);

    if (this.droppedFromDraft) {
      cyclist.x += 220 * deltaSeconds;
      this.positionDraftTimer(cyclist);
      if (cyclist.x > WIDTH + 50) {
        cyclist.destroy();
        this.draftTimerText?.destroy();
        this.draftTimerText = undefined;
        this.draftCyclist = undefined;
        const [minimumDelay, maximumDelay] = encounterDelayRange(stage);
        this.encounterCountdown = Phaser.Math.Between(
          minimumDelay,
          maximumDelay,
        );
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
      draftAlignmentGap(
        this.riderRoadY,
        cyclist.y,
        cyclist.x,
        this.roadGradient,
      ) < rules.laneTolerancePx;
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
          `IN THE DRAFT · +${RANDOM_RIDER_DRAFT_PERCENT}% SPEED · ${rules.durationSeconds}s`,
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
    const challengeRules = encounterChallengeRules.draft;
    const reward = gameStore.completeChallenge(
      challengeRules?.cleanRewardMultiplier ?? 6,
    );
    this.rewardFlow(challengeRules?.flowReward ?? 24, "DRAFT CLEAN");
    this.draftTimerText?.setText("0s");
    this.showEncounter(
      `DRAFT CLEAN ×${challengeRules?.cleanRewardMultiplier ?? 6} · +${formatCompactNumber(reward.sweat)} SWEAT · +$${formatCompactNumber(reward.cash)}`,
      2_200,
    );
  }

  private positionDraftTimer(cyclist: Phaser.GameObjects.Sprite): void {
    this.draftTimerText?.setPosition(
      cyclist.x,
      cyclist.y - DRAFT_LABEL_OFFSET_Y,
    );
  }

  private syncDomestiques(level: number): void {
    const targetCount = Math.max(0, Math.min(3, Math.floor(level)));
    const positions = domestiqueFormationX(targetCount);
    while (this.domestiques.length < targetCount) {
      const x = positions[this.domestiques.length];
      const y = this.roadY(
        cyclistLaneY(LANE_Y[this.targetLane]),
        x,
      );
      const rider = this.add
        .sprite(
          x,
          y,
          cyclistFrameTexture("domestique", false),
        )
        .setDisplaySize(CYCLIST_WIDTH, CYCLIST_HEIGHT)
        .setDepth(10 + y / 1_000);
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
      rider
        .setAngle(roadAngleDegrees(this.roadGradient))
        .setDepth(10 + rider.y / 1_000);
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
    if (speedKmh > 32 && Math.random() < delta / 2_000) {
      this.cameras.main.shake(65, 0.0015);
    }
  }

  private updateDraftWindFeedback(active: boolean, color: number): void {
    if (!active) {
      this.draftWake.clear().setVisible(false);
      this.draftWindStreaks.forEach((streak) =>
        streak.setVisible(false),
      );
      return;
    }

    const roadAngle = roadAngleDegrees(this.roadGradient);
    this.draftWindStreaks.forEach((streak, index) => {
      const state = draftStreakStateAt(
        this.time.now,
        index,
        this.draftWindStreaks.length,
      );
      const x = this.rider.x + state.xOffset;
      streak
        .setVisible(true)
        .setPosition(
          x,
          this.roadY(this.riderRoadY + state.yOffset, x),
        )
        .setDisplaySize(state.width, 1.6)
        .setAngle(roadAngle)
        .setFillStyle(color, 1)
        .setAlpha(state.alpha);
    });

    const frontX = this.rider.x + 166;
    const middleX = this.rider.x + 42;
    const rearX = this.rider.x - 72;
    const frontY = this.roadY(this.riderRoadY, frontX);
    const middleY = this.roadY(this.riderRoadY, middleX);
    const rearY = this.roadY(this.riderRoadY, rearX);
    this.draftWake
      .clear()
      .setVisible(true)
      .lineStyle(3, color, 0.08);
    [-1, 1].forEach((direction) => {
      this.draftWake
        .beginPath()
        .moveTo(frontX, frontY + direction * 11)
        .lineTo(middleX, middleY + direction * 18)
        .lineTo(rearX, rearY + direction * 31)
        .strokePath();
    });
    this.draftWake.lineStyle(1, color, 0.32);
    [-1, 1].forEach((direction) => {
      this.draftWake
        .beginPath()
        .moveTo(frontX, frontY + direction * 11)
        .lineTo(middleX, middleY + direction * 18)
        .lineTo(rearX, rearY + direction * 31)
        .strokePath();
    });
  }

  private updatePowerUpFeedback(
    activePowerUp: GameSnapshot["activePowerUp"],
  ): void {
    if (!activePowerUp) {
      this.powerUpAura.setVisible(false);
      this.powerUpHalo.setVisible(false);
      this.powerUpSparks.forEach((spark) => spark.setVisible(false));
      return;
    }

    if (activePowerUp.type === "jump") {
      this.rider.y =
        this.riderRoadY -
        jumpHeightAt(
          activePowerUp.remainingSeconds,
          powerUpDefinitions.jump.durationSeconds,
        );
    }

    const color = POWER_UP_COLORS[activePowerUp.type].hex;
    const pulse = powerUpPulseAt(this.time.now);
    this.powerUpAura
      .setVisible(true)
      .setPosition(this.rider.x - 2, this.riderRoadY + 29)
      .setAngle(this.rider.angle)
      .setFillStyle(color, 0.1)
      .setStrokeStyle(2, color, pulse.strokeAlpha)
      .setScale(pulse.groundScale);
    this.powerUpHalo
      .setVisible(true)
      .setPosition(this.rider.x, this.rider.y)
      .setAngle(this.rider.angle)
      .setFillStyle(color, 0.045)
      .setStrokeStyle(2, color, pulse.strokeAlpha * 0.86)
      .setScale(pulse.haloScale);

    const rotation = this.rider.rotation;
    const cosRotation = Math.cos(rotation);
    const sinRotation = Math.sin(rotation);
    this.powerUpSparks.forEach((spark, index) => {
      const orbit =
        this.time.now / 620 +
        (index / this.powerUpSparks.length) * Math.PI * 2;
      const localX = Math.cos(orbit) * 50;
      const localY = Math.sin(orbit) * 31;
      spark
        .setVisible(true)
        .setPosition(
          this.rider.x +
            localX * cosRotation -
            localY * sinRotation,
          this.rider.y +
            localX * sinRotation +
            localY * cosRotation,
        )
        .setFillStyle(color, 1)
        .setAlpha(
          pulse.sparkAlpha *
            (0.72 + (index % 3) * 0.1),
        )
        .setScale(0.72 + (index % 3) * 0.17);
    });
  }

  private floatText(x: number, y: number, label: string, color: string): void {
    const text = this.add
      .text(x, y, label, {
        fontFamily: CANVAS_FONT,
        fontSize: "14px",
        color,
        stroke: "#3a241b",
        strokeThickness: 4,
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

}
