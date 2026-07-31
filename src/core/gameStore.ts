import {
  affordableUpgradeLevels,
  branchUnlockLevels,
  type Branch,
  type Currency,
  type PurchaseQuantity,
  type UpgradeDefinition,
  upgradeById,
  upgradeBulkCost,
  upgradeCost,
  upgradeGainTotal,
  upgradePercentMultiplier,
  upgrades,
} from "./upgrades";
import { bagRewardForRate, stageProductionMultiplier } from "./economy";
import { economyBalance, rangedValue } from "./economyBalance";
import {
  offlineProductionEfficiency,
  palmaresProductionMultiplier,
  palmaresUpgradeById,
  palmaresUpgradeCost,
  pendingPalmaresForDistance,
  seasonStartingResources,
  type PalmaresUpgradeId,
} from "./palmares";
import {
  RANDOM_RIDER_DRAFT_BONUS,
  RANDOM_RIDER_DRAFT_WIND_SHELTER,
} from "./drafting";
import {
  captureReachedSplits,
  completeTimeRecord,
  createCourseRecord,
  fastestRecord,
  formatRaceTime,
  recordDeltaStatus,
  recordSecondsAtProgress,
  TIME_TRIAL_SPLIT_COUNT,
  type RecordDeltaStatus,
  type SectorTimeRecord,
} from "./timeTrial";
import { formatCompactNumber, formatMultiplier } from "./format";
import {
  cleanChallengeXp,
  PICKUP_XP,
  POWER_UP_USE_XP,
  riderProgressForXp,
  riderXpMultiplierForStage,
  RIDING_XP_PER_SECOND,
  TOUR_COMPLETION_XP,
  type RiderProgress,
} from "./riderProgression";

// Keep the original key so the Ze Tour rename does not wipe existing careers.
const SAVE_KEY = "biker-inc-save-v1";
const SAVE_INTERVAL_MS = 5_000;
const MAX_OFFLINE_SECONDS = 8 * 60 * 60;
export const BASE_FLAT_SPEED_KMH =
  economyBalance.speed.neutralFlatMinKmh;
export const FULLY_UPGRADED_FLAT_SPEED_KMH =
  economyBalance.speed.neutralFlatMaxKmh;
const GRADIENT_LINEAR_DRAG = 8.75;
const GRADIENT_QUADRATIC_DRAG = 40.6;
const DESCENT_SPEED_PER_GRADIENT = 16;
const COURSE_RECORD_FLAT_SPEED_KMH = 26;
const BASE_SWEAT_PER_SECOND =
  economyBalance.production.baseSweatPerSecond;
const BASE_CASH_PER_SECOND =
  economyBalance.production.baseCashPerSecond;
export const CHALLENGE_BASE_PRODUCTION_SECONDS = 1.5;
export const TOTAL_TOUR_DISTANCE_KM = 1_615;
export const TOUR_DURATION_MULTIPLIER =
  economyBalance.pacing.routeDurationMultiplier;
export const KONAMI_RESOURCE_BALANCE = 5_000_000_000;
export const tourProgressPaceKmh = (effectivePaceKmh: number): number => {
  return Math.max(
    0,
    Number.isFinite(effectivePaceKmh) ? effectivePaceKmh : 0,
  );
};

export const permanentFlatSpeedKmh = (
  levels: Readonly<Record<string, number>>,
): number =>
  BASE_FLAT_SPEED_KMH +
  upgrades.reduce(
    (total, upgrade) =>
      total +
      upgradeGainTotal(
        upgrade,
        levels[upgrade.id] ?? 0,
        "flatSpeed",
      ),
    0,
  );

export interface ChallengeReward {
  sweat: number;
  cash: number;
  productionSeconds: number;
}

export type PowerUpType = "super-draft" | "lucky-bidon" | "jump";

export interface PowerUpDefinition {
  label: string;
  icon: string;
  assetKey: string;
  description: string;
  durationSeconds: number;
  speedMultiplier: number;
  productionMultiplier: number;
  windShelter: number;
  requiresDraft: boolean;
  hazardImmunity: boolean;
}

export const powerUpDefinitions: Record<PowerUpType, PowerUpDefinition> = {
  "super-draft": {
    label: "Super Draft",
    icon: "»",
    assetKey: "power-super-draft",
    description: "4× speed + income · live draft required",
    durationSeconds: 8,
    speedMultiplier: 4,
    productionMultiplier: 4,
    windShelter: 0.9,
    requiresDraft: true,
    hazardImmunity: false,
  },
  "lucky-bidon": {
    label: "Acceleration",
    icon: "»",
    assetKey: "power-acceleration",
    description: "2.5× speed + income",
    durationSeconds: 10,
    speedMultiplier: 2.5,
    productionMultiplier: 2.5,
    windShelter: 0,
    requiresDraft: false,
    hazardImmunity: false,
  },
  jump: {
    label: "Invincibility",
    icon: "✦",
    assetKey: "power-invincibility",
    description: "Potholes + traffic do no damage",
    durationSeconds: 8,
    speedMultiplier: 1,
    productionMultiplier: 1,
    windShelter: 0,
    requiresDraft: false,
    hazardImmunity: true,
  },
};

export const gradientSpeedMultiplier = (
  gradient: number,
  climbingMitigation = 0,
): number => {
  const safeGradient = Math.max(0, gradient);
  const normalizedMitigation =
    climbingMitigation <= 1
      ? climbingMitigation
      : climbingMitigation * 0.05;
  const climbingEfficiency =
    1 - Math.min(0.25, Math.max(0, normalizedMitigation));
  const effectiveGradient = safeGradient * climbingEfficiency;

  return Math.max(
    0.18,
    Math.exp(
      -(
        GRADIENT_LINEAR_DRAG * effectiveGradient +
        GRADIENT_QUADRATIC_DRAG * effectiveGradient ** 2
      ),
    ),
  );
};

export const terrainSpeedMultiplier = (
  gradient: number,
  climbingMitigation = 0,
  descentSpeedBonus = 0,
): number => {
  if (gradient >= 0) {
    return gradientSpeedMultiplier(gradient, climbingMitigation);
  }

  const descent = Math.min(0.08, Math.abs(gradient));
  const controlBonus = Math.max(
    0,
    descentSpeedBonus <= 1
      ? descentSpeedBonus
      : descentSpeedBonus * 0.025,
  );
  return 1 + Math.min(1.2, descent * DESCENT_SPEED_PER_GRADIENT + controlBonus);
};

export type StageTerrain = "flat" | "climb" | "descent" | "wind" | "summit";
export type RoadSurface = "road" | "gravel";

export interface StageDefinition {
  number: number;
  name: string;
  start: string;
  finish: string;
  landmark: string;
  terrain: StageTerrain;
  surface: RoadSurface;
  gradientRange: readonly [number, number];
  gradientProfile: readonly number[];
  windPenalty: number;
  distanceM: number;
  routeDistanceKm: number;
  sweatYield: number;
  cashPerKm: number;
}

export const stages: StageDefinition[] = [
  {
    number: 1,
    name: "Atlantic run",
    start: "Paris",
    finish: "Bordeaux",
    landmark: "Scandibérique · Atlantic plains",
    terrain: "flat",
    surface: "road",
    gradientRange: [-0.02, 0.02],
    gradientProfile: [0, 0.012, -0.018, 0.006, -0.008, 0.018, 0],
    windPenalty: 0,
    distanceM: 800,
    routeDistanceKm: 580,
    sweatYield: 1,
    cashPerKm: 36,
  },
  {
    number: 2,
    name: "Périgord gravel approach",
    start: "Bordeaux",
    finish: "Clermont-Ferrand",
    landmark: "Périgord farm tracks · Auvergne",
    terrain: "climb",
    surface: "gravel",
    gradientRange: [0, 0.05],
    gradientProfile: [0, 0.018, 0.035, 0.012, 0.048, 0.028, 0],
    windPenalty: 0,
    distanceM: 1_050,
    routeDistanceKm: 370,
    sweatYield: 1.55,
    cashPerKm: 42,
  },
  {
    number: 3,
    name: "Provence descent",
    start: "Clermont-Ferrand",
    finish: "Avignon",
    landmark: "Massif Central to Rhône valley",
    terrain: "descent",
    surface: "road",
    gradientRange: [-0.05, 0],
    gradientProfile: [0, -0.035, -0.05, -0.022, -0.045, -0.012, 0],
    windPenalty: 0,
    distanceM: 1_050,
    routeDistanceKm: 380,
    sweatYield: 1.1,
    cashPerKm: 55,
  },
  {
    number: 4,
    name: "Mistral corridor",
    start: "Avignon",
    finish: "Grenoble",
    landmark: "Northbound through the Rhône valley",
    terrain: "wind",
    surface: "road",
    gradientRange: [-0.02, 0.02],
    gradientProfile: [0, -0.012, 0.018, -0.02, 0.01, 0.004, 0],
    windPenalty: 0.28,
    distanceM: 1_250,
    routeDistanceKm: 220,
    sweatYield: 1.75,
    cashPerKm: 48,
  },
  {
    number: 5,
    name: "21 bends finale",
    start: "Grenoble",
    finish: "Alpe d'Huez",
    landmark: "via Bourg-d'Oisans · 21 bends",
    terrain: "summit",
    surface: "road",
    gradientRange: [0, 0.12],
    gradientProfile: [0, 0.07, 0.078, 0.095, 0.07, 0.12, 0.07, 0.0895, 0.079],
    windPenalty: 0,
    distanceM: 1_800,
    routeDistanceKm: 65,
    sweatYield: 4,
    cashPerKm: 85,
  },
];

export const displayStageDistanceKm = (
  stage: StageDefinition,
  stageDistanceM: number,
): number =>
  Math.max(
    0,
    Math.min(1, stageDistanceM / stage.distanceM),
  ) * stage.routeDistanceKm;

export const displayTourDistanceKm = (
  stageNumber: number,
  stageDistanceM: number,
): number => {
  const stageIndex = Math.max(
    0,
    Math.min(stages.length - 1, Math.round(stageNumber) - 1),
  );
  const completedDistance = stages
    .slice(0, stageIndex)
    .reduce((total, stage) => total + stage.routeDistanceKm, 0);
  return (
    completedDistance +
    displayStageDistanceKm(stages[stageIndex], stageDistanceM)
  );
};

export const gradientAtProgress = (
  stage: StageDefinition,
  progress: number,
): number => {
  const profile = stage.gradientProfile;
  if (profile.length === 0) return 0;
  if (profile.length === 1) return profile[0];

  const safeProgress = Math.max(0, Math.min(1, progress));
  const position = safeProgress * (profile.length - 1);
  const index = Math.min(profile.length - 2, Math.floor(position));
  const localProgress = position - index;
  const smoothedProgress =
    localProgress * localProgress * (3 - 2 * localProgress);

  return (
    profile[index] +
    (profile[index + 1] - profile[index]) * smoothedProgress
  );
};

export interface ElevationPoint {
  progress: number;
  elevationM: number;
}

export const buildElevationProfile = (
  stage: StageDefinition,
  segmentCount = 60,
): ElevationPoint[] => {
  const segments = Math.max(1, Math.floor(segmentCount));
  const points: ElevationPoint[] = [{ progress: 0, elevationM: 0 }];
  let elevationM = 0;
  let previousGradient = gradientAtProgress(stage, 0);

  for (let index = 1; index <= segments; index += 1) {
    const progress = index / segments;
    const gradient = gradientAtProgress(stage, progress);
    const segmentDistanceM = stage.distanceM / segments;
    elevationM +=
      ((previousGradient + gradient) / 2) * segmentDistanceM;
    points.push({ progress, elevationM });
    previousGradient = gradient;
  }

  return points;
};

export const elevationAtProgress = (
  stage: StageDefinition,
  progress: number,
): number => {
  const safeProgress = Math.max(0, Math.min(1, progress));
  if (safeProgress === 0) return 0;

  const segments = 120;
  const segmentProgress = safeProgress / segments;
  const segmentDistanceM = stage.distanceM * segmentProgress;
  let elevationM = 0;
  let previousGradient = gradientAtProgress(stage, 0);

  for (let index = 1; index <= segments; index += 1) {
    const currentProgress = index * segmentProgress;
    const gradient = gradientAtProgress(stage, currentProgress);
    elevationM +=
      ((previousGradient + gradient) / 2) * segmentDistanceM;
    previousGradient = gradient;
  }

  return elevationM;
};

const courseRecordCache = new Map<number, SectorTimeRecord>();

export const courseRecordForStage = (
  stage: StageDefinition,
): SectorTimeRecord => {
  const cached = courseRecordCache.get(stage.number);
  if (cached) return cached;

  const record = createCourseRecord(
    stage.distanceM * TOUR_DURATION_MULTIPLIER,
    (progress) => {
      const terrainMultiplier = terrainSpeedMultiplier(
        gradientAtProgress(stage, progress),
      );
      return (
        COURSE_RECORD_FLAT_SPEED_KMH *
        terrainMultiplier *
        (1 - stage.windPenalty)
      );
    },
  );
  courseRecordCache.set(stage.number, record);
  return record;
};

export interface SaveState {
  version: 4;
  sweat: number;
  cash: number;
  riderXp: number;
  distanceM: number;
  lifetimeDistanceKm: number;
  seasonDistanceKm: number;
  stageDistanceM: number;
  stage: number;
  highestStage: number;
  season: number;
  tourNumber: number;
  toursCompleted: number;
  toursThisSeason: number;
  palmares: number;
  totalPalmares: number;
  palmaresUpgrades: Partial<Record<PalmaresUpgradeId, number>>;
  automationEnabled: boolean;
  raceFinished: boolean;
  raceStageTimes: Record<string, number>;
  sectorElapsedSeconds: number;
  currentSectorSplits: number[];
  sectorRecords: Record<string, SectorTimeRecord>;
  reservedPowerUp: PowerUpType | null;
  upgrades: Record<string, number>;
  lastSavedAt: number;
}

export interface RaceResultRow {
  stage: number;
  route: string;
  timeSeconds: number;
  recordSeconds: number;
  deltaSeconds: number;
}

export interface RaceResults {
  totalSeconds: number;
  recordTotalSeconds: number;
  deltaSeconds: number;
  rows: RaceResultRow[];
}

export interface ComputedStats {
  speedKmh: number;
  effectivePaceKmh: number;
  upgradeOutputMultiplier: number;
  palmaresMultiplier: number;
  riderLevelMultiplier: number;
  flowMultiplier: number;
  sweatPerSecond: number;
  sweatMultiplier: number;
  cashPerSecond: number;
  cashMultiplier: number;
  handling: number;
  potholeProtection: number;
  draftMultiplier: number;
  windMitigation: number;
  effectiveWindPenalty: number;
  flowDecayPerSecond: number;
  gravelMitigation: number;
  surfaceMultiplier: number;
  pickupMagnet: boolean;
  automationUnlocked: boolean;
}

export interface GameSnapshot extends SaveState {
  raceRevision: number;
  stats: ComputedStats;
  stageDefinition: StageDefinition;
  stageProgress: number;
  currentGradient: number;
  activePowerUp: {
    type: PowerUpType;
    remainingSeconds: number;
  } | null;
  leaderboard: {
    elapsedSeconds: number;
    recordTotalSeconds: number;
    recordAtProgressSeconds: number;
    deltaSeconds: number;
    status: RecordDeltaStatus;
    recordSource: "course" | "personal";
  };
  raceResults: RaceResults | null;
  pendingPalmares: number;
  riderProgress: RiderProgress;
}

export interface PurchaseStatus {
  available: boolean;
  reason?: string;
  cost: number;
  currency: Currency;
  levels: number;
}

export interface PalmaresPurchaseStatus {
  available: boolean;
  reason?: string;
  cost: number;
  level: number;
  maxLevel: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface GameStoreOptions {
  storage?: StorageLike | null;
  now?: () => number;
  random?: () => number;
  riderProgressionEnabled?: boolean;
}

type Listener = (snapshot: GameSnapshot) => void;
type NoticeListener = (message: string, tone: "good" | "bad" | "neutral") => void;

const finiteNumber = (value: unknown, fallback = 0): number => {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
};

const clampedInteger = (
  value: unknown,
  minimum: number,
  maximum: number,
  fallback = minimum,
): number =>
  Math.max(
    minimum,
    Math.min(maximum, Math.floor(finiteNumber(value, fallback))),
  );

const nonNegativeInteger = (value: unknown, fallback = 0): number =>
  Math.max(0, Math.floor(finiteNumber(value, fallback)));

const normalizedSectorRecords = (
  value: unknown,
): Record<string, SectorTimeRecord> => {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, candidate]) => {
      if (!candidate || typeof candidate !== "object") return [];
      const record = candidate as Partial<SectorTimeRecord>;
      const totalSeconds = Number(record.totalSeconds);
      const splits = Array.isArray(record.splits)
        ? record.splits.map(Number)
        : [];
      if (
        !Number.isFinite(totalSeconds) ||
        totalSeconds <= 0 ||
        splits.length < 2 ||
        splits.some((split) => !Number.isFinite(split))
      ) {
        return [];
      }
      return [[key, completeTimeRecord(splits, totalSeconds)]];
    }),
  );
};

const normalizedRaceStageTimes = (
  value: unknown,
): Record<string, number> => {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, candidate]) => {
      const stageNumber = Number(key);
      const seconds = Number(candidate);
      return Number.isInteger(stageNumber) &&
        stageNumber >= 1 &&
        stageNumber <= stages.length &&
        Number.isFinite(seconds) &&
        seconds > 0
        ? [[String(stageNumber), seconds]]
        : [];
    }),
  );
};

const migratedCurrentSplits = (
  value: unknown,
  progress: number,
  elapsedSeconds: number,
): number[] => {
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((split) => Number.isFinite(Number(split)))
  ) {
    return value
      .slice(0, TIME_TRIAL_SPLIT_COUNT + 1)
      .map((split) => Math.max(0, Number(split)));
  }

  const reachedSplits = Math.floor(
    Math.max(0, Math.min(1, progress)) * TIME_TRIAL_SPLIT_COUNT,
  );
  if (reachedSplits === 0) return [0];
  return Array.from({ length: reachedSplits + 1 }, (_, index) =>
    index === 0
      ? 0
      : elapsedSeconds * ((index / TIME_TRIAL_SPLIT_COUNT) / progress),
  );
};

const initialState = (now: number): SaveState => ({
  version: 4,
  sweat: 0,
  cash: 0,
  riderXp: 0,
  distanceM: 0,
  lifetimeDistanceKm: 0,
  seasonDistanceKm: 0,
  stageDistanceM: 0,
  stage: 1,
  highestStage: 1,
  season: 1,
  tourNumber: 1,
  toursCompleted: 0,
  toursThisSeason: 0,
  palmares: 0,
  totalPalmares: 0,
  palmaresUpgrades: {},
  automationEnabled: false,
  raceFinished: false,
  raceStageTimes: {},
  sectorElapsedSeconds: 0,
  currentSectorSplits: [0],
  sectorRecords: {},
  reservedPowerUp: null,
  upgrades: {},
  lastSavedAt: now,
});

export class GameStore {
  private state: SaveState;
  private readonly storage: StorageLike | null;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly riderProgressionEnabled: boolean;
  private listeners = new Set<Listener>();
  private noticeListeners = new Set<NoticeListener>();
  private lastEmitAt = 0;
  private sweatGenerationRemainder = 0;
  private cashGenerationRemainder = 0;
  private temporaryDraftBonus = 0;
  private activePowerUp: PowerUpType | null = null;
  private activePowerUpRemaining = 0;
  private raceRevision = 0;
  private activeFlowMultiplier = 1;
  private automationAccumulator = 0;

  constructor(options: GameStoreOptions = {}) {
    this.storage =
      options.storage === undefined
        ? typeof window === "undefined"
          ? null
          : window.localStorage
        : options.storage;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.riderProgressionEnabled = options.riderProgressionEnabled ?? true;
    this.state = this.load();
    this.applyOfflineProgress();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  subscribeToNotices(listener: NoticeListener): () => void {
    this.noticeListeners.add(listener);
    return () => this.noticeListeners.delete(listener);
  }

  getSnapshot(): GameSnapshot {
    const stageDefinition = this.currentStage();
    const stageProgress = Math.min(
      1,
      this.state.stageDistanceM / stageDefinition.distanceM,
    );
    const currentGradient = gradientAtProgress(
      stageDefinition,
      stageProgress,
    );
    const personalRecord =
      this.state.sectorRecords[String(stageDefinition.number)];
    const fastest = fastestRecord(
      courseRecordForStage(stageDefinition),
      personalRecord,
    );
    const recordAtProgressSeconds = recordSecondsAtProgress(
      fastest.record,
      stageProgress,
    );
    const deltaSeconds =
      this.state.sectorElapsedSeconds - recordAtProgressSeconds;
    const raceResults = this.buildRaceResults();
    return {
      ...this.state,
      raceRevision: this.raceRevision,
      upgrades: { ...this.state.upgrades },
      palmaresUpgrades: { ...this.state.palmaresUpgrades },
      raceStageTimes: { ...this.state.raceStageTimes },
      currentSectorSplits: [...this.state.currentSectorSplits],
      sectorRecords: Object.fromEntries(
        Object.entries(this.state.sectorRecords).map(([key, record]) => [
          key,
          { ...record, splits: [...record.splits] },
        ]),
      ),
      stats: this.computeStats(currentGradient),
      stageDefinition,
      stageProgress,
      currentGradient,
      activePowerUp: this.activePowerUp
        ? {
            type: this.activePowerUp,
            remainingSeconds: this.activePowerUpRemaining,
          }
        : null,
      leaderboard: {
        elapsedSeconds: this.state.sectorElapsedSeconds,
        recordTotalSeconds: fastest.record.totalSeconds,
        recordAtProgressSeconds,
        deltaSeconds,
        status: recordDeltaStatus(deltaSeconds),
        recordSource: fastest.source,
      },
      raceResults,
      pendingPalmares: pendingPalmaresForDistance(
        this.state.seasonDistanceKm,
        TOTAL_TOUR_DISTANCE_KM,
      ),
      riderProgress: riderProgressForXp(this.state.riderXp),
    };
  }

  activateKonamiCheat(): void {
    this.state.sweat = Math.max(
      this.state.sweat,
      KONAMI_RESOURCE_BALANCE,
    );
    this.state.cash = Math.max(
      this.state.cash,
      KONAMI_RESOURCE_BALANCE,
    );
    this.save();
    this.notice("Konami code — 5B Sweat and $5B Cash restored", "good");
    this.emit();
  }

  tick(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    if (this.state.raceFinished) return;

    const safeDelta = Math.min(deltaSeconds, 0.25);
    this.awardRiderXp(
      RIDING_XP_PER_SECOND *
        safeDelta *
        riderXpMultiplierForStage(this.state.stage),
    );
    const stats = this.computeStats();
    const distance =
      ((tourProgressPaceKmh(stats.effectivePaceKmh) / 3.6) * safeDelta) /
      TOUR_DURATION_MULTIPLIER;
    const sweatGenerated =
      this.sweatGenerationRemainder + stats.sweatPerSecond * safeDelta;
    const cashGenerated =
      this.cashGenerationRemainder + stats.cashPerSecond * safeDelta;
    const wholeSweat = Math.floor(sweatGenerated);
    const wholeCash = Math.floor(cashGenerated);

    this.advanceRideDistance(distance, safeDelta);
    this.state.sweat += wholeSweat;
    this.state.cash += wholeCash;
    this.sweatGenerationRemainder = sweatGenerated - wholeSweat;
    this.cashGenerationRemainder = cashGenerated - wholeCash;
    this.advanceActivePowerUp(safeDelta);
    if (this.state.automationEnabled && this.isAutomationUnlocked()) {
      this.automationAccumulator += safeDelta;
      const intervalSeconds = Math.max(
        0.65,
        2.5 -
          Math.max(0, (this.state.palmaresUpgrades["race-radio"] ?? 0) - 1) *
            0.75,
      );
      if (this.automationAccumulator >= intervalSeconds) {
        this.automationAccumulator %= intervalSeconds;
        this.autoPurchaseCheapest();
      }
    } else {
      this.automationAccumulator = 0;
    }

    const now = this.now();
    if (now - this.state.lastSavedAt >= SAVE_INTERVAL_MS) {
      this.save();
    }
    if (now - this.lastEmitAt >= 100) {
      this.emit();
      this.lastEmitAt = now;
    }
  }

  collectBag(type: "sweat" | "cash", multiplier = 1): number {
    const stats = this.computeStats();
    const amount = bagRewardForRate(
      type,
      type === "sweat"
        ? stats.sweatPerSecond
        : stats.cashPerSecond,
      multiplier,
      this.random(),
    );
    if (type === "sweat") {
      this.state.sweat += amount;
    } else {
      this.state.cash += amount;
    }
    this.awardRiderXp(
      PICKUP_XP * riderXpMultiplierForStage(this.state.stage),
    );
    this.notice(
      type === "sweat" ? `+${amount} Sweat` : `+$${amount}`,
      "good",
    );
    this.emit();
    return amount;
  }

  completeChallenge(multiplier: number, difficulty = 1): ChallengeReward {
    const stats = this.computeStats();
    const productionSeconds =
      rangedValue(
        economyBalance.production.challengeProductionSeconds,
        this.random(),
      ) *
      Math.max(0, multiplier);
    const sweat = Math.max(
      1,
      Math.round(stats.sweatPerSecond * productionSeconds),
    );
    const cash = Math.max(
      1,
      Math.round(stats.cashPerSecond * productionSeconds),
    );
    this.state.sweat += sweat;
    this.state.cash += cash;
    this.awardRiderXp(cleanChallengeXp(difficulty, this.state.stage));
    this.notice(
      `Clean challenge — +${formatCompactNumber(sweat)} Sweat · +$${formatCompactNumber(cash)}`,
      "good",
    );
    this.emit();
    return { sweat, cash, productionSeconds };
  }

  hitPothole(): number {
    const stats = this.computeStats();
    const rolledProductionSeconds = 4 + this.random() * 4;
    const effectiveProductionSeconds =
      rolledProductionSeconds * (1 - stats.potholeProtection);
    const lost = Math.min(
      this.state.cash,
      this.state.cash > 0
        ? Math.max(
            1,
            Math.ceil(
              stats.cashPerSecond * effectiveProductionSeconds,
            ),
          )
        : 0,
    );
    this.state.cash = Math.max(0, this.state.cash - lost);
    this.notice(
      `Pothole — lost $${lost} and all Flow`,
      "bad",
    );
    this.emit();
    return lost;
  }

  hitTraffic(): number {
    const stats = this.computeStats();
    const rolledProductionSeconds = 14 + this.random() * 8;
    const effectiveProductionSeconds =
      rolledProductionSeconds * (1 - stats.potholeProtection * 0.35);
    const lost = Math.min(
      this.state.cash,
      this.state.cash > 0
        ? Math.max(
            1,
            Math.ceil(
              stats.cashPerSecond * effectiveProductionSeconds,
            ),
          )
        : 0,
    );
    this.state.cash = Math.max(0, this.state.cash - lost);
    this.notice(
      `Traffic collision — lost $${formatCompactNumber(lost)} and all Flow`,
      "bad",
    );
    this.emit();
    return lost;
  }

  resetCareer(): void {
    this.state = initialState(this.now());
    this.resetTransientRideState();
    this.save();
    this.notice("Race restarted — Paris, 0 km", "neutral");
    this.emit();
  }

  restartRace(): void {
    this.continueTour();
  }

  continueTour(): boolean {
    if (!this.state.raceFinished) return false;

    this.state.stage = 1;
    this.state.stageDistanceM = 0;
    this.state.highestStage = Math.max(this.state.highestStage, 1);
    this.state.tourNumber += 1;
    this.state.raceFinished = false;
    this.state.raceStageTimes = {};
    this.state.sectorElapsedSeconds = 0;
    this.state.currentSectorSplits = [0];
    this.state.reservedPowerUp = null;
    this.resetTransientRideState();
    this.save();
    this.notice(
      `Tour ${this.state.tourNumber} starts — Rider Level progress carries on`,
      "good",
    );
    this.emit();
    return true;
  }

  startNextSeason(): boolean {
    if (!this.state.raceFinished) return false;
    const reward = pendingPalmaresForDistance(
      this.state.seasonDistanceKm,
      TOTAL_TOUR_DISTANCE_KM,
    );
    if (reward <= 0) return false;

    const records = { ...this.state.sectorRecords };
    const palmaresUpgrades = { ...this.state.palmaresUpgrades };
    const nextSeason = this.state.season + 1;
    const nextPalmares = this.state.palmares + reward;
    const nextTotalPalmares = this.state.totalPalmares + reward;
    const toursCompleted = this.state.toursCompleted;
    const lifetimeDistanceKm = this.state.lifetimeDistanceKm;
    const riderXp = this.state.riderXp;
    const automationEnabled =
      this.state.automationEnabled &&
      (palmaresUpgrades["race-radio"] ?? 0) > 0;
    const startingResources = seasonStartingResources(palmaresUpgrades);

    this.state = {
      ...initialState(this.now()),
      sweat: startingResources,
      cash: startingResources,
      riderXp,
      season: nextSeason,
      palmares: nextPalmares,
      totalPalmares: nextTotalPalmares,
      palmaresUpgrades,
      automationEnabled,
      toursCompleted,
      lifetimeDistanceKm,
      sectorRecords: records,
    };
    this.resetTransientRideState();
    this.save();
    this.notice(
      `Season ${nextSeason}! +${reward} Palmarès · early roads will melt`,
      "good",
    );
    this.emit();
    return true;
  }

  collectPowerUp(type: PowerUpType): boolean {
    const replaced = this.state.reservedPowerUp;
    this.state.reservedPowerUp = type;
    this.save();
    this.notice(
      replaced
        ? `${powerUpDefinitions[type].label} replaced ${powerUpDefinitions[replaced].label}`
        : `${powerUpDefinitions[type].label} ready in the power-up slot`,
      "good",
    );
    this.emit();
    return true;
  }

  activateReservedPowerUp(): boolean {
    const type = this.state.reservedPowerUp;
    if (!type) return false;
    if (this.activePowerUp) {
      this.notice("A power-up is already active", "neutral");
      return false;
    }

    const definition = powerUpDefinitions[type];
    if (definition.requiresDraft && this.temporaryDraftBonus <= 0) {
      this.notice(
        "Super Draft needs a rider ahead — enter their draft first",
        "neutral",
      );
      return false;
    }
    this.state.reservedPowerUp = null;
    this.activePowerUp = type;
    this.activePowerUpRemaining = definition.durationSeconds;
    this.awardRiderXp(
      POWER_UP_USE_XP * riderXpMultiplierForStage(this.state.stage),
    );
    this.save();
    this.notice(`${definition.label} activated!`, "good");
    this.emit();
    return true;
  }

  purchase(
    upgrade: UpgradeDefinition,
    quantity: PurchaseQuantity = 1,
  ): boolean {
    const status = this.purchaseStatus(upgrade, quantity);
    if (!status.available) return false;

    this.state[status.currency] -= status.cost;
    const previousLevel = this.state.upgrades[upgrade.id] ?? 0;
    const nextLevel = previousLevel + status.levels;
    this.state.upgrades[upgrade.id] = nextLevel;
    const crossedMilestone = upgrade.milestones?.find(
      (milestone) =>
        milestone.level > previousLevel &&
        milestone.level <= nextLevel,
    );
    this.notice(
      crossedMilestone
        ? `${upgrade.name}: ${crossedMilestone.label} installed!`
        : `${upgrade.name} +${status.levels} · Step ${nextLevel}/${upgrade.maxLevel}`,
      "good",
    );
    this.save();
    this.emit();
    return true;
  }

  purchaseStatus(
    upgrade: UpgradeDefinition,
    quantity: PurchaseQuantity = 1,
  ): PurchaseStatus {
    const level = this.state.upgrades[upgrade.id] ?? 0;
    const nextCost = upgradeCost(upgrade, level);
    const status = {
      cost: nextCost,
      currency: upgrade.currency,
      levels: 0,
    };

    if (level >= upgrade.maxLevel) {
      return { ...status, available: false, reason: "Max level" };
    }
    const branchUnlockLevel = branchUnlockLevels[upgrade.branch];
    if (!this.isBranchUnlocked(upgrade.branch)) {
      return {
        ...status,
        available: false,
        reason: `Branch unlocks at Rider Level ${branchUnlockLevel}`,
      };
    }
    const missingDependency = [upgrade.parent, ...upgrade.dependencies]
      .filter(
        (dependency): dependency is NonNullable<typeof dependency> =>
          Boolean(dependency),
      )
      .find(
        (dependency) =>
          (this.state.upgrades[dependency.id] ?? 0) <
          dependency.requiredTier,
      );
    if (missingDependency) {
      const parent = upgradeById(missingDependency.id);
      return {
        ...status,
        available: false,
        reason: `Requires ${parent?.name ?? missingDependency.id} tier ${missingDependency.requiredTier}`,
      };
    }
    const affordableLevels = affordableUpgradeLevels(
      upgrade,
      level,
      this.state[upgrade.currency],
      quantity,
    );
    if (affordableLevels <= 0) {
      const missing = Math.ceil(nextCost - this.state[upgrade.currency]);
      return {
        ...status,
        available: false,
        reason:
          upgrade.currency === "cash"
            ? `Need $${formatCompactNumber(missing)} more`
            : `Need ${formatCompactNumber(missing)} more Sweat`,
      };
    }
    return {
      ...status,
      available: true,
      levels: affordableLevels,
      cost: upgradeBulkCost(upgrade, level, affordableLevels),
    };
  }

  purchasePalmares(id: PalmaresUpgradeId): boolean {
    const status = this.palmaresPurchaseStatus(id);
    if (!status.available) return false;

    this.state.palmares -= status.cost;
    this.state.palmaresUpgrades[id] = status.level + 1;
    if (id === "race-radio" && status.level === 0) {
      this.state.automationEnabled = true;
    }
    const upgrade = palmaresUpgradeById(id);
    this.notice(`${upgrade.name} is now Level ${status.level + 1}`, "good");
    this.save();
    this.emit();
    return true;
  }

  palmaresPurchaseStatus(id: PalmaresUpgradeId): PalmaresPurchaseStatus {
    const upgrade = palmaresUpgradeById(id);
    const level = Math.max(0, this.state.palmaresUpgrades[id] ?? 0);
    const cost = palmaresUpgradeCost(upgrade, level);
    if (level >= upgrade.maxLevel) {
      return {
        available: false,
        reason: "Max level",
        cost,
        level,
        maxLevel: upgrade.maxLevel,
      };
    }
    if (this.state.palmares < cost) {
      return {
        available: false,
        reason: `Need ${Math.ceil(cost - this.state.palmares)} more`,
        cost,
        level,
        maxLevel: upgrade.maxLevel,
      };
    }
    return {
      available: true,
      cost,
      level,
      maxLevel: upgrade.maxLevel,
    };
  }

  setAutomationEnabled(enabled: boolean): boolean {
    if (enabled && !this.isAutomationUnlocked()) return false;
    this.state.automationEnabled = enabled;
    this.automationAccumulator = 0;
    this.save();
    this.emit();
    return true;
  }

  setActiveFlowMultiplier(multiplier: number): void {
    this.activeFlowMultiplier = Math.max(
      1,
      Math.min(5, Number.isFinite(multiplier) ? multiplier : 1),
    );
  }

  isBranchUnlocked(branch: Branch): boolean {
    return (
      riderProgressForXp(this.state.riderXp).level >=
      branchUnlockLevels[branch]
    );
  }

  setTemporaryDraftBonus(bonus: number): void {
    const previousBonus = this.temporaryDraftBonus;
    this.temporaryDraftBonus = Math.max(
      0,
      Math.min(RANDOM_RIDER_DRAFT_BONUS, bonus),
    );
    if (
      previousBonus > 0 &&
      this.temporaryDraftBonus === 0 &&
      this.activePowerUp === "super-draft"
    ) {
      this.activePowerUp = null;
      this.activePowerUpRemaining = 0;
      this.notice("Super Draft ended — the wheel got away", "neutral");
      this.emit();
    }
  }

  private advanceRideDistance(
    distanceM: number,
    elapsedSeconds: number,
  ): void {
    const safeDistance = Math.max(0, distanceM);
    if (safeDistance <= 0) {
      this.state.sectorElapsedSeconds += Math.max(0, elapsedSeconds);
      return;
    }

    let remainingDistance = safeDistance;
    let remainingSeconds = Math.max(0, elapsedSeconds);
    while (remainingDistance > 0 && !this.state.raceFinished) {
      const stage = this.currentStage();
      const distanceToFinish = Math.max(
        0,
        stage.distanceM - this.state.stageDistanceM,
      );
      if (distanceToFinish <= 0) {
        this.completeSector(stage);
        continue;
      }

      const chunk = Math.min(remainingDistance, distanceToFinish);
      const chunkSeconds =
        remainingDistance > 0
          ? remainingSeconds * (chunk / remainingDistance)
          : 0;
      const previousProgress = Math.min(
        1,
        this.state.stageDistanceM / stage.distanceM,
      );
      const previousElapsedSeconds = this.state.sectorElapsedSeconds;
      const routeDistanceKm =
        (chunk / stage.distanceM) * stage.routeDistanceKm;

      this.state.distanceM += chunk;
      this.state.stageDistanceM += chunk;
      this.state.seasonDistanceKm += routeDistanceKm;
      this.state.lifetimeDistanceKm += routeDistanceKm;
      this.state.sectorElapsedSeconds += chunkSeconds;
      remainingDistance -= chunk;
      remainingSeconds = Math.max(0, remainingSeconds - chunkSeconds);

      const progress = Math.min(
        1,
        this.state.stageDistanceM / stage.distanceM,
      );
      this.state.currentSectorSplits = captureReachedSplits(
        this.state.currentSectorSplits,
        previousProgress,
        progress,
        previousElapsedSeconds,
        this.state.sectorElapsedSeconds,
      );

      if (this.state.stageDistanceM >= stage.distanceM) {
        this.completeSector(stage);
      }
    }
  }

  private isAutomationUnlocked(): boolean {
    return (this.state.palmaresUpgrades["race-radio"] ?? 0) > 0;
  }

  private autoPurchaseCheapest(): void {
    const candidate = upgrades
      .map((upgrade) => ({
        upgrade,
        status: this.purchaseStatus(upgrade),
      }))
      .filter(({ status }) => status.available)
      .sort((left, right) => left.status.cost - right.status.cost)[0];
    if (!candidate) return;
    this.purchase(candidate.upgrade);
  }

  private resetTransientRideState(): void {
    this.raceRevision += 1;
    this.sweatGenerationRemainder = 0;
    this.cashGenerationRemainder = 0;
    this.temporaryDraftBonus = 0;
    this.activePowerUp = null;
    this.activePowerUpRemaining = 0;
    this.activeFlowMultiplier = 1;
    this.automationAccumulator = 0;
  }

  private completeSector(stage: StageDefinition): void {
    const attempt = completeTimeRecord(
      this.state.currentSectorSplits,
      this.state.sectorElapsedSeconds,
    );
    const recordKey = String(stage.number);
    const previousPersonalRecord = this.state.sectorRecords[recordKey];
    const isPersonalBest =
      !previousPersonalRecord ||
      attempt.totalSeconds < previousPersonalRecord.totalSeconds;
    if (isPersonalBest && attempt.totalSeconds > 0) {
      this.state.sectorRecords[recordKey] = attempt;
    }
    this.state.raceStageTimes[recordKey] = attempt.totalSeconds;

    const beatCourseRecord =
      attempt.totalSeconds < courseRecordForStage(stage).totalSeconds;
    const timingLabel = beatCourseRecord
      ? `NEW RECORD ${formatRaceTime(attempt.totalSeconds)}`
      : isPersonalBest
        ? `PERSONAL BEST ${formatRaceTime(attempt.totalSeconds)}`
        : formatRaceTime(attempt.totalSeconds);

    if (this.state.stage < stages.length) {
      this.state.stageDistanceM = 0;
      this.state.sectorElapsedSeconds = 0;
      this.state.currentSectorSplits = [0];
      this.state.stage += 1;
      this.state.highestStage = Math.max(
        this.state.highestStage,
        this.state.stage,
      );
      const nextStage = this.currentStage();
      this.notice(
        `${timingLabel} · ${nextStage.start} → ${nextStage.finish}`,
        "good",
      );
    } else {
      this.state.stageDistanceM = stage.distanceM;
      this.state.sectorElapsedSeconds = attempt.totalSeconds;
      this.state.currentSectorSplits = [...attempt.splits];
      this.state.raceFinished = true;
      this.state.toursCompleted += 1;
      this.state.toursThisSeason += 1;
      const firstTourXp =
        this.state.toursCompleted === 1 ? TOUR_COMPLETION_XP : 0;
      this.awardRiderXp(firstTourXp);
      this.temporaryDraftBonus = 0;
      this.activePowerUp = null;
      this.activePowerUpRemaining = 0;
      const progress = riderProgressForXp(this.state.riderXp);
      this.notice(
        `${timingLabel} · Tour ${this.state.tourNumber} complete${
          firstTourXp > 0 ? ` · +${firstTourXp} Rider XP` : ""
        } · Level ${progress.level}`,
        "good",
      );
    }
    this.save();
    this.emit();
  }

  private buildRaceResults(): RaceResults | null {
    if (!this.state.raceFinished) return null;

    const rows = stages.flatMap((stage) => {
      const timeSeconds = this.state.raceStageTimes[String(stage.number)];
      if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) return [];
      const fastest = fastestRecord(
        courseRecordForStage(stage),
        this.state.sectorRecords[String(stage.number)],
      );
      return [
        {
          stage: stage.number,
          route: `${stage.start} → ${stage.finish}`,
          timeSeconds,
          recordSeconds: fastest.record.totalSeconds,
          deltaSeconds: timeSeconds - fastest.record.totalSeconds,
        },
      ];
    });
    const totalSeconds = rows.reduce(
      (total, row) => total + row.timeSeconds,
      0,
    );
    const recordTotalSeconds = rows.reduce(
      (total, row) => total + row.recordSeconds,
      0,
    );

    return {
      totalSeconds,
      recordTotalSeconds,
      deltaSeconds: totalSeconds - recordTotalSeconds,
      rows,
    };
  }

  private currentStage(): StageDefinition {
    const index = Math.max(0, Math.min(this.state.stage, stages.length) - 1);
    return stages[index];
  }

  private level(id: string): number {
    return this.state.upgrades[id] ?? 0;
  }

  private computeStats(currentGradient = this.currentGradient()): ComputedStats {
    const stage = this.currentStage();
    const gainTotal = (
      stat:
        | "handling"
        | "flowRetention"
        | "windMitigation"
        | "gravelMitigation"
        | "potholeProtection"
        | "climbing"
        | "descending"
        | "draft",
    ): number =>
      upgrades.reduce(
        (total, upgrade) =>
          total + upgradeGainTotal(upgrade, this.level(upgrade.id), stat),
        0,
      );
    const multiplicativeEffect = (
      stat: "output" | "sweat" | "cash",
    ): number =>
      upgrades.reduce(
        (multiplier, upgrade) =>
          multiplier *
          upgradePercentMultiplier(upgrade, this.level(upgrade.id), stat),
        1,
      );

    const climbingMitigation = Math.min(0.25, gainTotal("climbing") / 100);
    const descentSpeedBonus = gainTotal("descending") / 100;
    const windMitigation = Math.min(
      0.68,
      gainTotal("windMitigation") / 100,
    );
    const gravelMitigation = Math.min(
      0.94,
      gainTotal("gravelMitigation") / 100,
    );
    const activeDefinition = this.activePowerUp
      ? powerUpDefinitions[this.activePowerUp]
      : null;
    const activePowerUpApplies = Boolean(
      activeDefinition &&
        (!activeDefinition.requiresDraft || this.temporaryDraftBonus > 0),
    );
    const temporaryDraftBonus = Math.max(
      this.temporaryDraftBonus,
      0,
    );
    const draftWindMitigation =
      activePowerUpApplies && this.activePowerUp === "super-draft"
        ? (activeDefinition?.windShelter ?? 0)
        : this.temporaryDraftBonus > 0
          ? RANDOM_RIDER_DRAFT_WIND_SHELTER
          : 0;
    const effectiveWindPenalty =
      stage.windPenalty *
      (1 - windMitigation) *
      (1 - draftWindMitigation);

    const flatSpeed = permanentFlatSpeedKmh(this.state.upgrades);
    const terrainMultiplier = terrainSpeedMultiplier(
      currentGradient,
      climbingMitigation,
      descentSpeedBonus,
    );
    const windMultiplier = 1 - effectiveWindPenalty;
    const domestiqueBonus = gainTotal("draft") / 100;
    const draftMultiplier =
      1 + domestiqueBonus + temporaryDraftBonus;
    const powerUpSpeedMultiplier = activePowerUpApplies
      ? (activeDefinition?.speedMultiplier ?? 1)
      : 1;
    const rideSpeedMultiplier = Math.max(
      draftMultiplier,
      powerUpSpeedMultiplier,
    );
    const surfaceMultiplier =
      stage.surface === "gravel"
        ? 1 - 0.34 * (1 - gravelMitigation)
        : 1;
    const speedKmh =
      flatSpeed *
      terrainMultiplier *
      windMultiplier *
      surfaceMultiplier *
      rideSpeedMultiplier;
    const upgradeOutputMultiplier = multiplicativeEffect("output");
    const palmaresMultiplier =
      palmaresProductionMultiplier(this.state.palmaresUpgrades) *
      (1 + this.state.totalPalmares * 0.1);
    const riderLevelMultiplier = this.riderProgressionEnabled
      ? riderProgressForXp(this.state.riderXp).productionMultiplier
      : 1;
    const flowMultiplier = this.activeFlowMultiplier;
    const effectivePaceKmh = speedKmh;
    const stageMultiplier = stageProductionMultiplier(stage.number);
    const baseSweatPerSecond =
      (BASE_SWEAT_PER_SECOND + speedKmh / 60) *
      stage.sweatYield *
      stageMultiplier;
    const upgradeSweatMultiplier = multiplicativeEffect("sweat");
    const draftProductionMultiplier =
      temporaryDraftBonus > 0
        ? 1 + temporaryDraftBonus * 2
        : 1;
    const powerUpProductionMultiplier = activePowerUpApplies
      ? (activeDefinition?.productionMultiplier ?? 1)
      : 1;
    const productionMultiplier = Math.max(
      draftProductionMultiplier,
      powerUpProductionMultiplier,
    );
    const sweatPerSecond =
      baseSweatPerSecond *
      upgradeOutputMultiplier *
      upgradeSweatMultiplier *
      palmaresMultiplier *
      riderLevelMultiplier *
      flowMultiplier *
      productionMultiplier;
    const sweatMultiplier = sweatPerSecond / baseSweatPerSecond;
    const cashMultiplier = multiplicativeEffect("cash");

    return {
      speedKmh,
      effectivePaceKmh,
      upgradeOutputMultiplier,
      palmaresMultiplier,
      riderLevelMultiplier,
      flowMultiplier,
      sweatPerSecond,
      sweatMultiplier,
      cashPerSecond:
        (BASE_CASH_PER_SECOND +
          (speedKmh / 3_600) * stage.cashPerKm) *
        stageMultiplier *
        upgradeOutputMultiplier *
        cashMultiplier *
        palmaresMultiplier *
        riderLevelMultiplier *
        flowMultiplier *
        productionMultiplier,
      cashMultiplier,
      handling: 1 + gainTotal("handling") / 100,
      potholeProtection: Math.min(
        0.9,
        gainTotal("potholeProtection") / 100,
      ),
      draftMultiplier,
      windMitigation,
      effectiveWindPenalty,
      flowDecayPerSecond: Math.max(
        0.65,
        5 - gainTotal("flowRetention"),
      ),
      gravelMitigation,
      surfaceMultiplier,
      pickupMagnet:
        (this.state.palmaresUpgrades["sticky-bidons"] ?? 0) > 0,
      automationUnlocked: this.isAutomationUnlocked(),
    };
  }

  private currentGradient(): number {
    const stage = this.currentStage();
    return gradientAtProgress(
      stage,
      Math.min(1, this.state.stageDistanceM / stage.distanceM),
    );
  }

  private advanceActivePowerUp(deltaSeconds: number): void {
    if (!this.activePowerUp) return;

    this.activePowerUpRemaining = Math.max(
      0,
      this.activePowerUpRemaining - deltaSeconds,
    );
    if (this.activePowerUpRemaining > 0) return;

    const label = powerUpDefinitions[this.activePowerUp].label;
    this.activePowerUp = null;
    this.notice(`${label} ended`, "neutral");
  }

  private awardRiderXp(amount: number): void {
    if (
      !this.riderProgressionEnabled ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return;
    }

    const previous = riderProgressForXp(this.state.riderXp);
    this.state.riderXp += amount;
    const next = riderProgressForXp(this.state.riderXp);
    if (next.level > previous.level) {
      this.notice(
        `Rider Level ${next.level} — production ${formatMultiplier(next.productionMultiplier)}`,
        "good",
      );
    }
  }

  private applyOfflineProgress(): void {
    if (this.state.raceFinished) return;

    const elapsedSeconds = Math.min(
      MAX_OFFLINE_SECONDS,
      Math.max(0, (this.now() - this.state.lastSavedAt) / 1_000),
    );
    if (elapsedSeconds < 10) return;

    const stats = this.computeStats();
    const efficiency = offlineProductionEfficiency(
      this.state.palmaresUpgrades,
    );
    const distance =
      ((tourProgressPaceKmh(stats.effectivePaceKmh) / 3.6) *
        elapsedSeconds *
        efficiency) /
      TOUR_DURATION_MULTIPLIER;
    this.advanceRideDistance(distance, elapsedSeconds);
    this.state.sweat += Math.floor(
      stats.sweatPerSecond * elapsedSeconds * efficiency,
    );
    this.state.cash += Math.floor(
      stats.cashPerSecond * elapsedSeconds * efficiency,
    );
    this.awardRiderXp(
      RIDING_XP_PER_SECOND *
        elapsedSeconds *
        efficiency *
        riderXpMultiplierForStage(this.state.stage),
    );
    this.notice(
      `Offline ride: ${Math.round(elapsedSeconds / 60)} min at ${Math.round(
        efficiency * 100,
      )}% production`,
      "neutral",
    );
    this.save();
  }

  private load(): SaveState {
    if (!this.storage) return initialState(this.now());
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return initialState(this.now());
      const parsed = JSON.parse(raw) as Partial<
        Omit<SaveState, "version">
      > & {
        version?: number;
        rideCash?: number;
      };
      const saveVersion = parsed.version;
      if (
        saveVersion !== 1 &&
        saveVersion !== 2 &&
        saveVersion !== 3 &&
        saveVersion !== 4
      ) {
        return initialState(this.now());
      }
      const { rideCash = 0, ...currentState } = parsed;
      const migratedUpgrades = { ...(parsed.upgrades ?? {}) };
      if (migratedUpgrades.frame === undefined) {
        migratedUpgrades.frame = Math.min(
          2,
          (migratedUpgrades["aluminium-frame"] ?? 0) +
            (migratedUpgrades["carbon-frame"] ?? 0),
        ) * 25;
      }
      if (migratedUpgrades.tires === undefined) {
        migratedUpgrades.tires = Math.min(
          3,
          (migratedUpgrades["reinforced-tires"] ?? 0) +
            (migratedUpgrades["performance-tires"] ?? 0) +
            (migratedUpgrades["tubeless-tires"] ?? 0),
        ) * 25;
      }
      delete migratedUpgrades["aluminium-frame"];
      delete migratedUpgrades["carbon-frame"];
      delete migratedUpgrades["reinforced-tires"];
      delete migratedUpgrades["performance-tires"];
      delete migratedUpgrades["tubeless-tires"];
      const normalizedUpgrades = Object.fromEntries(
        upgrades.flatMap((upgrade) => {
          const candidate = Number(migratedUpgrades[upgrade.id] ?? 0);
          const migratedLevel =
            saveVersion < 3
              ? Math.ceil(candidate / (upgrade.progressionStep ?? 1))
              : candidate;
          const level = Number.isFinite(migratedLevel)
            ? Math.max(
                0,
                Math.min(upgrade.maxLevel, Math.floor(migratedLevel)),
              )
            : 0;
          return level > 0 ? [[upgrade.id, level]] : [];
        }),
      );
      const savedStage = clampedInteger(
        currentState.stage,
        1,
        stages.length,
        1,
      );
      const savedStageDefinition = stages[savedStage - 1];
      const rawStageDistanceM = Math.max(
        0,
        finiteNumber(currentState.stageDistanceM),
      );
      const completedLegacyFinale =
        savedStage === stages.length &&
        rawStageDistanceM >= savedStageDefinition.distanceM;
      const stage = savedStage;
      const stageDefinition = stages[stage - 1];
      const stageDistanceM = Math.min(
        rawStageDistanceM,
        stageDefinition.distanceM,
      );
      const stageProgress = stageDistanceM / stageDefinition.distanceM;
      const savedElapsedSeconds = Number(
        currentState.sectorElapsedSeconds,
      );
      const persistedSectorElapsedSeconds =
        Number.isFinite(savedElapsedSeconds) && savedElapsedSeconds >= 0
          ? savedElapsedSeconds
          : stageDistanceM / (BASE_FLAT_SPEED_KMH / 3.6);
      const sectorElapsedSeconds = persistedSectorElapsedSeconds;
      const savedHighestStage = Number(currentState.highestStage);
      const highestStage = Number.isFinite(savedHighestStage)
        ? Math.max(
            savedStage,
            stage,
            Math.min(stages.length, Math.floor(savedHighestStage)),
          )
        : Math.max(savedStage, stage);
      const savedTourNumber = Number(currentState.tourNumber);
      const tourNumber =
        Number.isFinite(savedTourNumber)
          ? Math.max(1, Math.floor(savedTourNumber))
          : 1;
      const raceFinished =
        Boolean(currentState.raceFinished) || completedLegacyFinale;
      const season = Math.max(1, nonNegativeInteger(currentState.season, 1));
      const toursCompleted = Math.max(
        raceFinished ? 1 : 0,
        nonNegativeInteger(currentState.toursCompleted),
      );
      const toursThisSeason = Math.max(
        raceFinished ? 1 : 0,
        nonNegativeInteger(currentState.toursThisSeason),
      );
      const palmares = nonNegativeInteger(currentState.palmares);
      const totalPalmares = Math.max(
        palmares,
        nonNegativeInteger(currentState.totalPalmares, palmares),
      );
      const rawPalmaresUpgrades =
        currentState.palmaresUpgrades &&
        typeof currentState.palmaresUpgrades === "object"
          ? currentState.palmaresUpgrades
          : {};
      const palmaresUpgrades = Object.fromEntries(
        (
          [
            "tour-legend",
            "head-start",
            "soigneur",
            "race-radio",
            "sticky-bidons",
          ] as PalmaresUpgradeId[]
        ).map((id) => {
          const definition = palmaresUpgradeById(id);
          return [
            id,
            clampedInteger(
              rawPalmaresUpgrades[id],
              0,
              definition.maxLevel,
            ),
          ];
        }),
      ) as Partial<Record<PalmaresUpgradeId, number>>;
      const inferredSeasonDistanceKm =
        toursThisSeason * TOTAL_TOUR_DISTANCE_KM +
        (raceFinished
          ? 0
          : displayTourDistanceKm(stage, stageDistanceM));
      const seasonDistanceKm = Math.max(
        inferredSeasonDistanceKm,
        finiteNumber(currentState.seasonDistanceKm),
      );
      const lifetimeDistanceKm = Math.max(
        seasonDistanceKm,
        finiteNumber(currentState.lifetimeDistanceKm, seasonDistanceKm),
      );
      const raceStageTimes = normalizedRaceStageTimes(
        currentState.raceStageTimes,
      );
      if (
        raceFinished &&
        !raceStageTimes[String(stages.length)] &&
        sectorElapsedSeconds > 0
      ) {
        raceStageTimes[String(stages.length)] = sectorElapsedSeconds;
      }
      return {
        ...initialState(this.now()),
        ...currentState,
        version: 4,
        stage,
        highestStage,
        season,
        tourNumber,
        toursCompleted,
        toursThisSeason,
        palmares,
        totalPalmares,
        riderXp: Math.max(
          0,
          saveVersion < 4
            ? totalPalmares * 100 + Math.min(4, toursCompleted) * 250
            : finiteNumber(currentState.riderXp),
        ),
        palmaresUpgrades,
        automationEnabled:
          Boolean(currentState.automationEnabled) &&
          (palmaresUpgrades["race-radio"] ?? 0) > 0,
        distanceM: Math.max(0, finiteNumber(currentState.distanceM)),
        seasonDistanceKm,
        lifetimeDistanceKm,
        raceFinished,
        raceStageTimes,
        stageDistanceM,
        sectorElapsedSeconds,
        currentSectorSplits: migratedCurrentSplits(
          currentState.currentSectorSplits,
          stageProgress,
          sectorElapsedSeconds,
        ),
        sectorRecords: normalizedSectorRecords(
          currentState.sectorRecords,
        ),
        sweat: nonNegativeInteger(currentState.sweat),
        cash: nonNegativeInteger(
          finiteNumber(currentState.cash) + finiteNumber(rideCash),
        ),
        reservedPowerUp:
          currentState.reservedPowerUp === "super-draft" ||
          currentState.reservedPowerUp === "lucky-bidon" ||
          currentState.reservedPowerUp === "jump"
            ? currentState.reservedPowerUp
            : null,
        upgrades: normalizedUpgrades,
        lastSavedAt: Math.min(
          this.now(),
          finiteNumber(currentState.lastSavedAt, this.now()),
        ),
      };
    } catch {
      return initialState(this.now());
    }
  }

  private save(): void {
    this.state.lastSavedAt = this.now();
    this.storage?.setItem(SAVE_KEY, JSON.stringify(this.state));
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private notice(
    message: string,
    tone: "good" | "bad" | "neutral",
  ): void {
    this.noticeListeners.forEach((listener) => listener(message, tone));
  }
}

const usesFreshVisualQaCareer =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("qaFresh") === "1";

export const gameStore = new GameStore({
  storage: usesFreshVisualQaCareer ? null : undefined,
});
