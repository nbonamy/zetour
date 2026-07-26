import {
  branchUnlockStages,
  type Branch,
  type Currency,
  type UpgradeDefinition,
  upgradeById,
  upgradeCost,
} from "./upgrades";
import { bagRewardForStage } from "./economy";
import {
  domestiqueDraftBonus,
  RANDOM_RIDER_DRAFT_BONUS,
  RANDOM_RIDER_DRAFT_DURATION_SECONDS,
  RANDOM_RIDER_DRAFT_SWEAT_REWARD,
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

// Keep the original key so the Ze Tour rename does not wipe existing careers.
const SAVE_KEY = "biker-inc-save-v1";
const SAVE_INTERVAL_MS = 5_000;
const MAX_OFFLINE_SECONDS = 8 * 60 * 60;
const BASE_FLAT_SPEED_KMH = 18;
const GRADIENT_LINEAR_DRAG = 8.75;
const GRADIENT_QUADRATIC_DRAG = 40.6;
const DESCENT_SPEED_PER_GRADIENT = 16;
const COURSE_RECORD_FLAT_SPEED_KMH = 26;

export type PowerUpType = "super-draft" | "lucky-bidon" | "jump";

export interface PowerUpDefinition {
  label: string;
  icon: string;
  description: string;
  durationSeconds: number;
  speedBonus: number;
  windShelter: number;
  pickupMagnet: boolean;
  potholeImmunity: boolean;
}

export const powerUpDefinitions: Record<PowerUpType, PowerUpDefinition> = {
  "super-draft": {
    label: "Super Draft",
    icon: "»",
    description: "+50% speed · 90% wind shelter",
    durationSeconds: 10,
    speedBonus: 0.5,
    windShelter: 0.9,
    pickupMagnet: false,
    potholeImmunity: false,
  },
  "lucky-bidon": {
    label: "Lucky Bidon",
    icon: "✦",
    description: "Collect every bag across all lanes",
    durationSeconds: 7,
    speedBonus: 0,
    windShelter: 0,
    pickupMagnet: true,
    potholeImmunity: false,
  },
  jump: {
    label: "Jump",
    icon: "↥",
    description: "Clear potholes for 1.2 seconds",
    durationSeconds: 1.2,
    speedBonus: 0,
    windShelter: 0,
    pickupMagnet: false,
    potholeImmunity: true,
  },
};

export const gradientSpeedMultiplier = (
  gradient: number,
  bodyCompositionLevel = 0,
): number => {
  const safeGradient = Math.max(0, gradient);
  const climbingEfficiency =
    1 - Math.min(0.25, Math.max(0, bodyCompositionLevel) * 0.05);
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
  bodyCompositionLevel = 0,
  descentControlLevel = 0,
): number => {
  if (gradient >= 0) {
    return gradientSpeedMultiplier(gradient, bodyCompositionLevel);
  }

  const descent = Math.min(0.08, Math.abs(gradient));
  const controlBonus = Math.max(0, descentControlLevel) * 0.025;
  return 1 + Math.min(1.2, descent * DESCENT_SPEED_PER_GRADIENT + controlBonus);
};

export type StageTerrain = "flat" | "climb" | "descent" | "wind" | "summit";

export interface StageDefinition {
  number: number;
  name: string;
  start: string;
  finish: string;
  landmark: string;
  terrain: StageTerrain;
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
    name: "Massif Central approach",
    start: "Bordeaux",
    finish: "Clermont-Ferrand",
    landmark: "Périgord to Auvergne",
    terrain: "climb",
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

  const record = createCourseRecord(stage.distanceM, (progress) => {
    const terrainMultiplier = terrainSpeedMultiplier(
      gradientAtProgress(stage, progress),
    );
    return (
      COURSE_RECORD_FLAT_SPEED_KMH *
      terrainMultiplier *
      (1 - stage.windPenalty)
    );
  });
  courseRecordCache.set(stage.number, record);
  return record;
};

export interface SaveState {
  version: 1;
  sweat: number;
  cash: number;
  distanceM: number;
  stageDistanceM: number;
  stage: number;
  highestStage: number;
  tourNumber: number;
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
  sweatPerSecond: number;
  sweatMultiplier: number;
  cashPerSecond: number;
  handling: number;
  potholeProtection: number;
  draftMultiplier: number;
  windMitigation: number;
  effectiveWindPenalty: number;
  flowDecayPerSecond: number;
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
}

export interface PurchaseStatus {
  available: boolean;
  reason?: string;
  cost: number;
  currency: Currency;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface GameStoreOptions {
  storage?: StorageLike | null;
  now?: () => number;
  random?: () => number;
}

type Listener = (snapshot: GameSnapshot) => void;
type NoticeListener = (message: string, tone: "good" | "bad" | "neutral") => void;

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
  version: 1,
  sweat: 0,
  cash: 0,
  distanceM: 0,
  stageDistanceM: 0,
  stage: 1,
  highestStage: 1,
  tourNumber: 1,
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
  private listeners = new Set<Listener>();
  private noticeListeners = new Set<NoticeListener>();
  private lastEmitAt = 0;
  private sweatGenerationRemainder = 0;
  private cashGenerationRemainder = 0;
  private temporaryDraftBonus = 0;
  private activePowerUp: PowerUpType | null = null;
  private activePowerUpRemaining = 0;
  private raceRevision = 0;

  constructor(options: GameStoreOptions = {}) {
    this.storage =
      options.storage === undefined
        ? typeof window === "undefined"
          ? null
          : window.localStorage
        : options.storage;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
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
    };
  }

  tick(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    if (this.state.raceFinished) return;

    const safeDelta = Math.min(deltaSeconds, 0.25);
    const stageDefinition = this.currentStage();
    const previousProgress = Math.min(
      1,
      this.state.stageDistanceM / stageDefinition.distanceM,
    );
    const previousElapsedSeconds = this.state.sectorElapsedSeconds;
    const stats = this.computeStats();
    const distance = (stats.speedKmh / 3.6) * safeDelta;
    const sweatGenerated =
      this.sweatGenerationRemainder + stats.sweatPerSecond * safeDelta;
    const cashGenerated =
      this.cashGenerationRemainder + stats.cashPerSecond * safeDelta;
    const wholeSweat = Math.floor(sweatGenerated);
    const wholeCash = Math.floor(cashGenerated);

    this.state.distanceM += distance;
    this.state.stageDistanceM += distance;
    this.state.sectorElapsedSeconds += safeDelta;
    this.state.sweat += wholeSweat;
    this.state.cash += wholeCash;
    this.sweatGenerationRemainder = sweatGenerated - wholeSweat;
    this.cashGenerationRemainder = cashGenerated - wholeCash;
    this.advanceActivePowerUp(safeDelta);
    const progress = Math.min(
      1,
      this.state.stageDistanceM / stageDefinition.distanceM,
    );
    this.state.currentSectorSplits = captureReachedSplits(
      this.state.currentSectorSplits,
      previousProgress,
      progress,
      previousElapsedSeconds,
      this.state.sectorElapsedSeconds,
    );

    if (this.state.stageDistanceM >= stageDefinition.distanceM) {
      this.completeSector(stageDefinition);
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
    const amount = bagRewardForStage(
      type,
      this.state.stage,
      multiplier,
    );
    if (type === "sweat") {
      this.state.sweat += amount;
    } else {
      this.state.cash += amount;
    }
    this.notice(
      type === "sweat" ? `+${amount} Sweat` : `+$${amount}`,
      "good",
    );
    this.emit();
    return amount;
  }

  hitPothole(): number {
    const stats = this.computeStats();
    const rolledLossPercentage = 10 + this.random() * 10;
    const effectiveLossPercentage =
      10 +
      (rolledLossPercentage - 10) * (1 - stats.potholeProtection);
    const lost = Math.min(
      this.state.cash,
      this.state.cash > 0
        ? Math.max(
            1,
            Math.ceil((this.state.cash * effectiveLossPercentage) / 100),
          )
        : 0,
    );
    this.state.cash = Math.max(0, this.state.cash - lost);
    this.notice(
      `Pothole — dropped $${lost} (${Math.round(effectiveLossPercentage)}%)`,
      "bad",
    );
    this.emit();
    return lost;
  }

  resetCareer(): void {
    this.state = initialState(this.now());
    this.raceRevision += 1;
    this.sweatGenerationRemainder = 0;
    this.cashGenerationRemainder = 0;
    this.temporaryDraftBonus = 0;
    this.activePowerUp = null;
    this.activePowerUpRemaining = 0;
    this.save();
    this.notice("Race restarted — Paris, 0 km", "neutral");
    this.emit();
  }

  restartRace(): void {
    if (!this.state.raceFinished) return;

    this.state = initialState(this.now());
    this.raceRevision += 1;
    this.sweatGenerationRemainder = 0;
    this.cashGenerationRemainder = 0;
    this.temporaryDraftBonus = 0;
    this.activePowerUp = null;
    this.activePowerUpRemaining = 0;
    this.save();
    this.notice("Fresh Tour starts in Paris", "good");
    this.emit();
  }

  collectPowerUp(type: PowerUpType): boolean {
    const replaced = this.state.reservedPowerUp;
    this.state.reservedPowerUp = type;
    this.save();
    this.notice(
      replaced
        ? `${powerUpDefinitions[type].label} replaced ${powerUpDefinitions[replaced].label}`
        : `${powerUpDefinitions[type].label} added to reserve`,
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
    this.state.reservedPowerUp = null;
    this.activePowerUp = type;
    this.activePowerUpRemaining = definition.durationSeconds;
    this.save();
    this.notice(`${definition.label} activated!`, "good");
    this.emit();
    return true;
  }

  purchase(upgrade: UpgradeDefinition): boolean {
    const status = this.purchaseStatus(upgrade);
    if (!status.available) return false;

    this.state[status.currency] -= status.cost;
    this.state.upgrades[upgrade.id] =
      (this.state.upgrades[upgrade.id] ?? 0) + 1;
    this.notice(`${upgrade.name} upgraded`, "good");
    this.save();
    this.emit();
    return true;
  }

  purchaseStatus(upgrade: UpgradeDefinition): PurchaseStatus {
    const level = this.state.upgrades[upgrade.id] ?? 0;
    const cost = upgradeCost(upgrade, level);
    const status = {
      cost,
      currency: upgrade.currency,
    };

    if (level >= upgrade.maxLevel) {
      return { ...status, available: false, reason: "Max level" };
    }
    const branchUnlockStage = branchUnlockStages[upgrade.branch];
    if (!this.isBranchUnlocked(upgrade.branch)) {
      return {
        ...status,
        available: false,
        reason: `Branch unlocks in Sector ${branchUnlockStage}`,
      };
    }
    const requiredStage =
      upgrade.requiredStages?.[level] ?? upgrade.requiredStage;
    if (requiredStage && this.state.highestStage < requiredStage) {
      return {
        ...status,
        available: false,
        reason: `Unlocks in Sector ${requiredStage}`,
      };
    }
    if (upgrade.requires && (this.state.upgrades[upgrade.requires] ?? 0) === 0) {
      const parent = upgradeById(upgrade.requires);
      return {
        ...status,
        available: false,
        reason: `Requires ${parent?.name ?? upgrade.requires}`,
      };
    }
    if (this.state[upgrade.currency] < cost) {
      const missing = Math.ceil(cost - this.state[upgrade.currency]);
      return {
        ...status,
        available: false,
        reason:
          upgrade.currency === "cash"
            ? `Need $${missing} more`
            : `Need ${missing} more Sweat`,
      };
    }
    return { ...status, available: true };
  }

  isBranchUnlocked(branch: Branch): boolean {
    return this.state.highestStage >= branchUnlockStages[branch];
  }

  setTemporaryDraftBonus(bonus: number): void {
    this.temporaryDraftBonus = Math.max(
      0,
      Math.min(RANDOM_RIDER_DRAFT_BONUS, bonus),
    );
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
      this.temporaryDraftBonus = 0;
      this.activePowerUp = null;
      this.activePowerUpRemaining = 0;
      this.notice(
        `${timingLabel} · Alpe d'Huez finish!`,
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
    const power = this.level("power");
    const endurance = this.level("endurance");
    const technique = this.level("technique");
    const bodyComposition = this.level("body-composition");
    const hydration = this.level("hydration");
    const fueling = this.level("fueling");
    const roadBike = this.level("road-bike");
    const frame = this.level("frame");
    const tires = this.level("tires");
    const reinforced = Math.min(1, tires);
    const performanceTires = Math.min(1, Math.max(0, tires - 1));
    const tubeless = Math.min(1, Math.max(0, tires - 2));
    const shifting = this.level("shifting");
    const wheels = this.level("wheels");
    const brakes = this.level("brakes");
    const domestiques = this.level("domestique");
    const aeroSocks = this.level("aero-socks");
    const helmet = this.level("helmet");
    const aeroLevels =
      aeroSocks + helmet + this.level("skinsuit");
    const sockWindMitigation =
      aeroSocks >= 3 ? 0.08 + (aeroSocks - 3) * 0.04 : 0;
    const helmetWindMitigation =
      helmet >= 3 ? 0.12 + (helmet - 3) * 0.06 : 0;
    const wheelWindMitigation =
      wheels >= 2 ? 0.1 + (wheels - 2) * 0.06 : 0;
    const windMitigation = Math.min(
      0.5,
      sockWindMitigation + helmetWindMitigation + wheelWindMitigation,
    );
    const activeDefinition = this.activePowerUp
      ? powerUpDefinitions[this.activePowerUp]
      : null;
    const superDraftBonus =
      this.activePowerUp === "super-draft"
        ? (activeDefinition?.speedBonus ?? 0)
        : 0;
    const temporaryDraftBonus = Math.max(
      this.temporaryDraftBonus,
      superDraftBonus,
    );
    const draftWindMitigation =
      this.activePowerUp === "super-draft"
        ? (activeDefinition?.windShelter ?? 0)
        : this.temporaryDraftBonus > 0
          ? 0.45
          : 0;
    const effectiveWindPenalty =
      stage.windPenalty *
      (1 - windMitigation) *
      (1 - draftWindMitigation);

    const flatSpeed =
      BASE_FLAT_SPEED_KMH +
      power * 1.8 +
      endurance * 0.4 +
      fueling * 0.55 +
      roadBike * 4.5 +
      frame * 1.35 +
      performanceTires * 1.2 +
      tubeless * 0.7 +
      shifting * 0.65 +
      wheels * 1.15 +
      aeroLevels * 0.28;
    const terrainMultiplier = terrainSpeedMultiplier(
      currentGradient,
      bodyComposition,
      technique + brakes,
    );
    const windMultiplier = 1 - effectiveWindPenalty;
    const domestiqueBonus = domestiqueDraftBonus(domestiques);
    const draftMultiplier =
      1 + domestiqueBonus + temporaryDraftBonus;
    const speedKmh =
      flatSpeed *
      terrainMultiplier *
      windMultiplier *
      draftMultiplier;
    const baseSweatPerSecond =
      (0.08 + speedKmh / 250) * stage.sweatYield;
    const randomRiderSweatBonusPerSecond =
      this.temporaryDraftBonus > 0
        ? RANDOM_RIDER_DRAFT_SWEAT_REWARD /
          RANDOM_RIDER_DRAFT_DURATION_SECONDS
        : 0;
    const sweatPerSecond =
      baseSweatPerSecond + randomRiderSweatBonusPerSecond;
    const sweatMultiplier = sweatPerSecond / baseSweatPerSecond;

    return {
      speedKmh,
      sweatPerSecond,
      sweatMultiplier,
      cashPerSecond: (speedKmh / 3_600) * stage.cashPerKm,
      handling:
        1 +
        technique * 0.12 +
        reinforced * 0.08 +
        performanceTires * 0.14 +
        tubeless * 0.18 +
        brakes * 0.08,
      potholeProtection: Math.min(
        0.72,
        reinforced * 0.16 + performanceTires * 0.2 + tubeless * 0.28,
      ),
      draftMultiplier,
      windMitigation,
      effectiveWindPenalty,
      flowDecayPerSecond: Math.max(2.5, 5 - hydration * 0.5),
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

  private applyOfflineProgress(): void {
    if (this.state.raceFinished) return;

    const elapsedSeconds = Math.min(
      MAX_OFFLINE_SECONDS,
      Math.max(0, (this.now() - this.state.lastSavedAt) / 1_000),
    );
    if (elapsedSeconds < 10) return;

    const stats = this.computeStats();
    const distance = (stats.speedKmh / 3.6) * elapsedSeconds;
    this.state.distanceM += distance;
    this.state.sweat += Math.floor(
      stats.sweatPerSecond * elapsedSeconds * 0.6,
    );
    this.state.cash += Math.floor(
      stats.cashPerSecond * elapsedSeconds * 0.6,
    );
    this.notice(
      `Offline ride: ${Math.round(elapsedSeconds / 60)} min of safe progress`,
      "neutral",
    );
  }

  private load(): SaveState {
    if (!this.storage) return initialState(this.now());
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return initialState(this.now());
      const parsed = JSON.parse(raw) as Partial<SaveState> & {
        rideCash?: number;
      };
      if (parsed.version !== 1) return initialState(this.now());
      const { rideCash = 0, ...currentState } = parsed;
      const migratedUpgrades = { ...(parsed.upgrades ?? {}) };
      if (migratedUpgrades.frame === undefined) {
        migratedUpgrades.frame = Math.min(
          2,
          (migratedUpgrades["aluminium-frame"] ?? 0) +
            (migratedUpgrades["carbon-frame"] ?? 0),
        );
      }
      if (migratedUpgrades.tires === undefined) {
        migratedUpgrades.tires = Math.min(
          3,
          (migratedUpgrades["reinforced-tires"] ?? 0) +
            (migratedUpgrades["performance-tires"] ?? 0) +
            (migratedUpgrades["tubeless-tires"] ?? 0),
        );
      }
      delete migratedUpgrades["aluminium-frame"];
      delete migratedUpgrades["carbon-frame"];
      delete migratedUpgrades["reinforced-tires"];
      delete migratedUpgrades["performance-tires"];
      delete migratedUpgrades["tubeless-tires"];
      const savedStage = Math.max(
        1,
        Math.min(stages.length, Math.floor(Number(currentState.stage ?? 1))),
      );
      const savedStageDefinition = stages[savedStage - 1];
      const rawStageDistanceM = Math.max(
        0,
        Number(currentState.stageDistanceM ?? 0),
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
        stage,
        highestStage,
        tourNumber,
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
        sweat: Math.max(0, Math.floor(Number(currentState.sweat ?? 0))),
        cash: Math.max(
          0,
          Math.floor(Number(currentState.cash ?? 0) + rideCash),
        ),
        reservedPowerUp:
          currentState.reservedPowerUp === "super-draft" ||
          currentState.reservedPowerUp === "lucky-bidon" ||
          currentState.reservedPowerUp === "jump"
            ? currentState.reservedPowerUp
            : null,
        upgrades: migratedUpgrades,
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

export const gameStore = new GameStore();
