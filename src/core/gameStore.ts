import {
  type Branch,
  type Currency,
  type UpgradeDefinition,
  upgradeById,
  upgradeCost,
} from "./upgrades";

const SAVE_KEY = "biker-inc-save-v1";
const SAVE_INTERVAL_MS = 5_000;
const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

export interface StageDefinition {
  number: number;
  name: string;
  gradient: number;
  windPenalty: number;
  distanceM: number;
  sweatYield: number;
  cashPerKm: number;
}

export const stages: StageDefinition[] = [
  {
    number: 1,
    name: "Local circuit",
    gradient: 0,
    windPenalty: 0,
    distanceM: 600,
    sweatYield: 1,
    cashPerKm: 34,
  },
  {
    number: 2,
    name: "Windy open road",
    gradient: 0,
    windPenalty: 0.25,
    distanceM: 900,
    sweatYield: 1.25,
    cashPerKm: 40,
  },
  {
    number: 3,
    name: "Rolling countryside",
    gradient: 0.02,
    windPenalty: 0,
    distanceM: 1_200,
    sweatYield: 1.65,
    cashPerKm: 45,
  },
  {
    number: 4,
    name: "First categorized climb",
    gradient: 0.045,
    windPenalty: 0,
    distanceM: 1_600,
    sweatYield: 2.2,
    cashPerKm: 52,
  },
  {
    number: 5,
    name: "Mountain pass",
    gradient: 0.05,
    windPenalty: 0.15,
    distanceM: 2_200,
    sweatYield: 3,
    cashPerKm: 62,
  },
  {
    number: 6,
    name: "Alpe d'Huez",
    gradient: 0.081,
    windPenalty: 0.1,
    distanceM: 3_000,
    sweatYield: 4,
    cashPerKm: 80,
  },
];

export interface SaveState {
  version: 1;
  sweat: number;
  cash: number;
  distanceM: number;
  stageDistanceM: number;
  stage: number;
  upgrades: Record<string, number>;
  lastSavedAt: number;
}

export interface ComputedStats {
  speedKmh: number;
  sweatPerSecond: number;
  cashPerSecond: number;
  handling: number;
  potholeProtection: number;
  draftMultiplier: number;
  windMitigation: number;
  effectiveWindPenalty: number;
}

export interface GameSnapshot extends SaveState {
  stats: ComputedStats;
  stageDefinition: StageDefinition;
  stageProgress: number;
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

const initialState = (now: number): SaveState => ({
  version: 1,
  sweat: 0,
  cash: 0,
  distanceM: 0,
  stageDistanceM: 0,
  stage: 1,
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
    return {
      ...this.state,
      upgrades: { ...this.state.upgrades },
      stats: this.computeStats(),
      stageDefinition,
      stageProgress: Math.min(
        1,
        this.state.stageDistanceM / stageDefinition.distanceM,
      ),
    };
  }

  tick(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;

    const safeDelta = Math.min(deltaSeconds, 0.25);
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
    this.state.sweat += wholeSweat;
    this.state.cash += wholeCash;
    this.sweatGenerationRemainder = sweatGenerated - wholeSweat;
    this.cashGenerationRemainder = cashGenerated - wholeCash;

    const stageDefinition = this.currentStage();
    if (
      this.state.stageDistanceM >= stageDefinition.distanceM &&
      this.state.stage < stages.length
    ) {
      this.state.stage += 1;
      this.state.stageDistanceM = 0;
      this.notice(`Stage ${this.state.stage} unlocked`, "good");
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
    const baseAmount =
      type === "sweat"
        ? 8 + this.state.stage * 4
        : 10 + this.state.stage * 6;
    const amount = Math.max(1, Math.round(baseAmount * multiplier));
    if (type === "sweat") {
      this.state.sweat += amount;
    } else {
      this.state.cash += amount;
    }
    this.notice(`+${amount} ${type === "sweat" ? "Sweat" : "Cash"}`, "good");
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
      `Pothole — dropped ${lost} Cash (${Math.round(effectiveLossPercentage)}%)`,
      "bad",
    );
    this.emit();
    return lost;
  }

  resetCareer(): void {
    this.state = initialState(this.now());
    this.sweatGenerationRemainder = 0;
    this.cashGenerationRemainder = 0;
    this.temporaryDraftBonus = 0;
    this.save();
    this.notice("Career reset — back to the local circuit", "neutral");
    this.emit();
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
    const requiredStage =
      upgrade.requiredStages?.[level] ?? upgrade.requiredStage;
    if (requiredStage && this.state.stage < requiredStage) {
      return {
        ...status,
        available: false,
        reason: `Unlocks at Stage ${requiredStage}`,
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
    return branch !== "team" || this.state.stage >= 3;
  }

  setTemporaryDraftBonus(bonus: number): void {
    this.temporaryDraftBonus = Math.max(0, Math.min(0.25, bonus));
  }

  private currentStage(): StageDefinition {
    return stages[Math.min(this.state.stage, stages.length) - 1];
  }

  private level(id: string): number {
    return this.state.upgrades[id] ?? 0;
  }

  private computeStats(): ComputedStats {
    const stage = this.currentStage();
    const power = this.level("power");
    const endurance = this.level("endurance");
    const technique = this.level("technique");
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
    const draftWindMitigation = this.temporaryDraftBonus > 0 ? 0.45 : 0;
    const effectiveWindPenalty =
      stage.windPenalty *
      (1 - windMitigation) *
      (1 - draftWindMitigation);

    const flatSpeed =
      12 +
      power * 1.8 +
      roadBike * 4.5 +
      frame * 1.35 +
      performanceTires * 1.2 +
      tubeless * 0.7 +
      shifting * 0.65 +
      wheels * 1.15 +
      aeroLevels * 0.28;
    const gradientPenalty = Math.max(0.42, 1 - stage.gradient * 6.2);
    const windMultiplier = 1 - effectiveWindPenalty;
    const draftMultiplier =
      1 + domestiques * 0.08 + this.temporaryDraftBonus;
    const speedKmh =
      flatSpeed * gradientPenalty * windMultiplier * draftMultiplier;

    return {
      speedKmh,
      sweatPerSecond:
        (0.7 + speedKmh / 80) * stage.sweatYield * (1 + endurance * 0.1),
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
    };
  }

  private applyOfflineProgress(): void {
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
      return {
        ...initialState(this.now()),
        ...currentState,
        sweat: Math.max(0, Math.floor(Number(currentState.sweat ?? 0))),
        cash: Math.max(
          0,
          Math.floor(Number(currentState.cash ?? 0) + rideCash),
        ),
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
