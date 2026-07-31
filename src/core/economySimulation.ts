import {
  GameStore,
  permanentFlatSpeedKmh,
  stages,
  type ComputedStats,
  type GameSnapshot,
} from "./gameStore";
import {
  upgradeCost,
  upgrades,
  type Currency,
  type UpgradeDefinition,
} from "./upgrades";
import {
  encounterChallengeRules,
  encounterDelayRange,
  flowMultiplier,
  lootMixForStage,
  nextEncounter,
  roadScrollSpeed,
  type RideEncounter,
} from "../game/rideSystems";

export const economyThresholds = [
  1_000,
  100_000,
  1_000_000,
  100_000_000,
  2_000_000_000,
] as const;

export type EconomyThreshold = (typeof economyThresholds)[number];
export type PurchasePolicy = "none" | "cheapest" | "best-payback";
export type EconomyIncomeSource = "riding" | "bags" | "challenges";
export type EconomyLossSource = "collisions";

export interface EconomyStageIncome {
  income: Record<EconomyIncomeSource, Record<Currency, number>>;
  bagPickups: number;
  cleanChallenges: number;
}

export interface EconomyStrategy {
  id: string;
  label: string;
  cleanChance: number;
  pickupChance: number;
  collisionChance: number;
  purchaseEverySeconds: number;
  purchasePolicy: PurchasePolicy;
  useAcceleration: boolean;
}

export interface EconomySimulationOptions {
  durationSeconds: number;
  seed?: number;
  strategy: EconomyStrategy;
  progressionModel?: EconomyProgressionModel;
}

export interface EconomyProgressionModel {
  id: string;
  label: string;
  enabled: boolean;
}

export const noEconomyProgression: EconomyProgressionModel = {
  id: "none",
  label: "No continuous Rider Level",
  enabled: false,
};

export const continuousRiderLevel: EconomyProgressionModel = {
  id: "rider-level",
  label: "Continuous Rider Level",
  enabled: true,
};

export interface EconomySimulationResult {
  strategy: EconomyStrategy;
  progressionModel: EconomyProgressionModel;
  progressionLevel: number;
  progressionXp: number;
  progressionMultiplier: number;
  seed: number;
  durationSeconds: number;
  firstPurchaseSeconds: number | null;
  firstTourSeconds: number | null;
  tourCompletionSeconds: number[];
  riderProgressAtTourCompletion: Array<{
    level: number;
    xp: number;
  }>;
  hyperbikeSeconds: number | null;
  normalTreeSeconds: number | null;
  stageReachedSeconds: Record<number, number>;
  riderProgressAtStageEntry: Record<
    number,
    { level: number; xp: number }
  >;
  upgradeLevelsAtStageEntry: Record<number, Record<string, number>>;
  balanceTimes: Record<
    Currency,
    Record<EconomyThreshold, number | null>
  >;
  earnedTimes: Record<
    Currency,
    Record<EconomyThreshold, number | null>
  >;
  peakBalance: Record<Currency, number>;
  totalEarned: Record<Currency, number>;
  totalSpent: Record<Currency, number>;
  incomeBySource: Record<
    EconomyIncomeSource,
    Record<Currency, number>
  >;
  incomeByStage: Record<number, EconomyStageIncome>;
  lossBySource: Record<EconomyLossSource, Record<Currency, number>>;
  finalBalance: Record<Currency, number>;
  finalIncomePerMinute: Record<Currency, number>;
  purchases: number;
  completedUpgradeSteps: number;
  availableUpgradeSteps: number;
  tours: number;
  cleanEncounters: number;
  totalEncounters: number;
  finalPaceKmh: number;
  finalNeutralFlatSpeedKmh: number;
  purchaseEvents: EconomyPurchaseEvent[];
}

export interface EconomyPurchaseEvent {
  seconds: number;
  upgradeId: string;
  level: number;
  currency: Currency;
  cost: number;
  balanceAfter: number;
  paybackSeconds: number | null;
  sweatPerMinute: number;
  cashPerMinute: number;
}

export const economyStrategies: readonly EconomyStrategy[] = [
  {
    id: "passive",
    label: "Passive baseline",
    cleanChance: 0,
    pickupChance: 0,
    collisionChance: 0,
    purchaseEverySeconds: Number.POSITIVE_INFINITY,
    purchasePolicy: "none",
    useAcceleration: false,
  },
  {
    id: "casual",
    label: "Casual explorer",
    cleanChance: 0.45,
    pickupChance: 0.65,
    collisionChance: 0.12,
    purchaseEverySeconds: 15,
    purchasePolicy: "cheapest",
    useAcceleration: true,
  },
  {
    id: "skilled",
    label: "Skilled planner",
    cleanChance: 0.75,
    pickupChance: 0.9,
    collisionChance: 0.04,
    purchaseEverySeconds: 5,
    purchasePolicy: "best-payback",
    useAcceleration: true,
  },
  {
    id: "perfect",
    label: "Perfect optimiser",
    cleanChance: 1,
    pickupChance: 1,
    collisionChance: 0,
    purchaseEverySeconds: 1.5,
    purchasePolicy: "best-payback",
    useAcceleration: true,
  },
] as const;

const encounterPickupCounts: Record<RideEncounter, number> = {
  "bonus-line": 4,
  slalom: 5,
  "feed-zone": 6,
  sprint: 7,
  hairpins: 5,
  traffic: 5,
  "power-up": 0,
  draft: 0,
};

const encounterSpanPx: Record<RideEncounter, number> = {
  "bonus-line": 420,
  slalom: 700,
  "feed-zone": 620,
  sprint: 680,
  hairpins: 700,
  traffic: 820,
  "power-up": 620,
  draft: 0,
};

const emptyCurrencyRecord = (): Record<Currency, number> => ({
  sweat: 0,
  cash: 0,
});

const emptyIncomeBySource = (): Record<
  EconomyIncomeSource,
  Record<Currency, number>
> => ({
  riding: emptyCurrencyRecord(),
  bags: emptyCurrencyRecord(),
  challenges: emptyCurrencyRecord(),
});

const emptyStageIncome = (): Record<number, EconomyStageIncome> =>
  Object.fromEntries(
    stages.map((stage) => [
      stage.number,
      {
        income: emptyIncomeBySource(),
        bagPickups: 0,
        cleanChallenges: 0,
      },
    ]),
  );

const emptyThresholdTimes = (): Record<EconomyThreshold, number | null> =>
  Object.fromEntries(
    economyThresholds.map((threshold) => [threshold, null]),
  ) as Record<EconomyThreshold, number | null>;

const seededRandom = (seed: number): (() => number) => {
  let state = Math.max(1, Math.floor(seed)) >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

const clampChance = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const nextLoot = (
  stage: number,
  random: () => number,
): Currency =>
  random() < lootMixForStage(stage).sweat ? "sweat" : "cash";

class SnapshotStorage {
  private value: string;

  constructor(snapshot: GameSnapshot, nowMs: number, rich = false) {
    this.value = JSON.stringify({
      ...snapshot,
      sweat: rich ? Number.MAX_SAFE_INTEGER : snapshot.sweat,
      cash: rich ? Number.MAX_SAFE_INTEGER : snapshot.cash,
      lastSavedAt: nowMs,
    });
  }

  getItem(): string {
    return this.value;
  }

  setItem(_key: string, value: string): void {
    this.value = value;
  }
}

const cloneStore = (
  snapshot: GameSnapshot,
  nowMs: number,
  rich = false,
  riderProgressionEnabled = true,
): GameStore =>
  new GameStore({
    storage: new SnapshotStorage(snapshot, nowMs, rich),
    now: () => nowMs,
    random: () => 0.5,
    riderProgressionEnabled,
  });

const stationaryStats = (
  snapshot: GameSnapshot,
  nowMs: number,
  riderProgressionEnabled = true,
): ComputedStats =>
  cloneStore(
    snapshot,
    nowMs,
    false,
    riderProgressionEnabled,
  ).getSnapshot().stats;

interface PurchasePlan {
  upgrade: UpgradeDefinition;
  cost: number;
  paybackSeconds: number | null;
}

const unlockedWithFunds = (
  snapshot: GameSnapshot,
  upgrade: UpgradeDefinition,
  nowMs: number,
  riderProgressionEnabled: boolean,
): GameStore | null => {
  const store = cloneStore(
    snapshot,
    nowMs,
    true,
    riderProgressionEnabled,
  );
  return store.purchaseStatus(upgrade).available ? store : null;
};

const bestPaybackPlan = (
  store: GameStore,
  currency: Currency,
  nowMs: number,
  riderProgressionEnabled: boolean,
): PurchasePlan | null => {
  const snapshot = store.getSnapshot();
  const before = stationaryStats(
    snapshot,
    nowMs,
    riderProgressionEnabled,
  );
  const balance = snapshot[currency];
  const currentRate =
    currency === "sweat" ? before.sweatPerSecond : before.cashPerSecond;

  return upgrades
    .filter((upgrade) => upgrade.currency === currency)
    .flatMap((upgrade) => {
      const candidate = unlockedWithFunds(
        snapshot,
        upgrade,
        nowMs,
        riderProgressionEnabled,
      );
      if (!candidate) return [];
      const level = snapshot.upgrades[upgrade.id] ?? 0;
      const cost = upgradeCost(upgrade, level);
      let investmentCost = 0;
      let gainPerSecond = 0;
      for (
        let candidateLevel = level;
        candidateLevel < upgrade.maxLevel && gainPerSecond <= 0;
        candidateLevel += 1
      ) {
        investmentCost += upgradeCost(upgrade, candidateLevel);
        if (!candidate.purchase(upgrade)) break;
        const after = candidate.getSnapshot().stats;
        const nextRate =
          currency === "sweat" ? after.sweatPerSecond : after.cashPerSecond;
        gainPerSecond = nextRate - currentRate;
      }
      if (gainPerSecond <= 0) return [];
      const paybackSeconds = investmentCost / gainPerSecond;
      const waitSeconds =
        Math.max(0, investmentCost - balance) / Math.max(0.001, currentRate);
      return [
        {
          upgrade,
          cost,
          paybackSeconds,
          score: waitSeconds + paybackSeconds,
        },
      ];
    })
    .sort((left, right) => left.score - right.score)[0] ?? null;
};

const cheapestAffordablePlan = (
  store: GameStore,
  currency: Currency,
): PurchasePlan | null => {
  const candidate = upgrades
    .map((upgrade) => ({
      upgrade,
      status: store.purchaseStatus(upgrade),
    }))
    .filter(
      ({ status }) => status.available && status.currency === currency,
    )
    .sort((left, right) => left.status.cost - right.status.cost)[0];
  return candidate
    ? {
        upgrade: candidate.upgrade,
        cost: candidate.status.cost,
        paybackSeconds: null,
      }
    : null;
};

const encounterIntervalSeconds = (
  encounter: RideEncounter,
  snapshot: GameSnapshot,
  random: () => number,
): number => {
  const [minimumDelay, maximumDelay] = encounterDelayRange(snapshot.stage);
  const scheduledDelay =
    (minimumDelay + random() * (maximumDelay - minimumDelay)) / 1_000;
  if (encounter === "draft") return Math.max(scheduledDelay, 14);
  const clearSeconds =
    encounterSpanPx[encounter] /
    roadScrollSpeed(snapshot.stats.speedKmh);
  return Math.max(scheduledDelay, clearSeconds);
};

export const simulateEconomy = (
  options: EconomySimulationOptions,
): EconomySimulationResult => {
  const durationSeconds = Math.max(1, options.durationSeconds);
  const seed = Math.max(1, Math.floor(options.seed ?? 1));
  const strategy = {
    ...options.strategy,
    cleanChance: clampChance(options.strategy.cleanChance),
    pickupChance: clampChance(options.strategy.pickupChance),
    collisionChance: clampChance(options.strategy.collisionChance),
  };
  const random = seededRandom(seed);
  const progressionModel =
    options.progressionModel ?? continuousRiderLevel;
  let nowMs = 1_800_000_000_000;
  const store = new GameStore({
    storage: null,
    now: () => nowMs,
    random,
    riderProgressionEnabled: progressionModel.enabled,
  });
  const balanceTimes: EconomySimulationResult["balanceTimes"] = {
    sweat: emptyThresholdTimes(),
    cash: emptyThresholdTimes(),
  };
  const earnedTimes: EconomySimulationResult["earnedTimes"] = {
    sweat: emptyThresholdTimes(),
    cash: emptyThresholdTimes(),
  };
  const peakBalance = emptyCurrencyRecord();
  const totalEarned = emptyCurrencyRecord();
  const totalSpent = emptyCurrencyRecord();
  const incomeBySource = emptyIncomeBySource();
  const incomeByStage = emptyStageIncome();
  const lossBySource: EconomySimulationResult["lossBySource"] = {
    collisions: emptyCurrencyRecord(),
  };
  let elapsedSeconds = 0;
  let encounterCountdown = 1.2;
  let encounterCount = 0;
  let purchaseCountdown = 0;
  let firstPurchaseSeconds: number | null = null;
  let firstTourSeconds: number | null = null;
  const tourCompletionSeconds: number[] = [];
  const riderProgressAtTourCompletion: EconomySimulationResult["riderProgressAtTourCompletion"] = [];
  let hyperbikeSeconds: number | null = null;
  let normalTreeSeconds: number | null = null;
  const stageReachedSeconds: Record<number, number> = { 1: 0 };
  const riderProgressAtStageEntry: EconomySimulationResult["riderProgressAtStageEntry"] = {
    1: { level: 1, xp: 0 },
  };
  const upgradeLevelsAtStageEntry: Record<
    number,
    Record<string, number>
  > = { 1: {} };
  let purchases = 0;
  const purchaseEvents: EconomyPurchaseEvent[] = [];
  let cleanEncounters = 0;
  let totalEncounters = 0;
  let flow = 0;
  let flowGraceSeconds = 0;
  let plannedHighestStage = 1;
  let observedTours = 0;
  const purchasePlans: Partial<Record<Currency, PurchasePlan>> = {};

  const recordMilestones = (): void => {
    const snapshot = store.getSnapshot();
    for (const currency of ["sweat", "cash"] satisfies Currency[]) {
      peakBalance[currency] = Math.max(
        peakBalance[currency],
        snapshot[currency],
      );
      for (const threshold of economyThresholds) {
        if (
          balanceTimes[currency][threshold] === null &&
          snapshot[currency] >= threshold
        ) {
          balanceTimes[currency][threshold] = elapsedSeconds;
        }
        if (
          earnedTimes[currency][threshold] === null &&
          totalEarned[currency] >= threshold
        ) {
          earnedTimes[currency][threshold] = elapsedSeconds;
        }
      }
    }
  };

  const recordIncome = (
    source: EconomyIncomeSource,
    before: GameSnapshot,
    after: GameSnapshot,
  ): void => {
    const stageIncome = incomeByStage[before.stage];
    for (const currency of ["sweat", "cash"] satisfies Currency[]) {
      const amount = Math.max(0, after[currency] - before[currency]);
      incomeBySource[source][currency] += amount;
      if (stageIncome) stageIncome.income[source][currency] += amount;
      totalEarned[currency] += amount;
    }
  };

  const accrue = (source: EconomyIncomeSource, action: () => void): void => {
    const before = store.getSnapshot();
    action();
    recordIncome(source, before, store.getSnapshot());
    const stageIncome = incomeByStage[before.stage];
    if (stageIncome && source === "bags") stageIncome.bagPickups += 1;
    if (stageIncome && source === "challenges") {
      stageIncome.cleanChallenges += 1;
    }
  };

  const recordCollision = (action: () => void): void => {
    const before = store.getSnapshot();
    action();
    const after = store.getSnapshot();
    for (const currency of ["sweat", "cash"] satisfies Currency[]) {
      lossBySource.collisions[currency] += Math.max(
        0,
        before[currency] - after[currency],
      );
    }
  };

  const addFlow = (amount: number): void => {
    flow = Math.min(100, flow + amount);
    flowGraceSeconds = 2.5;
  };

  const processEncounter = (): number => {
    const openingSnapshot = store.getSnapshot();
    const encounter = nextEncounter(
      openingSnapshot.stageDefinition,
      encounterCount,
      random,
    );
    encounterCount += 1;
    totalEncounters += 1;
    const rules = encounterChallengeRules[encounter];
    const clean = Boolean(rules && random() < strategy.cleanChance);
    const pickupCount = encounterPickupCounts[encounter];
    const collectedPickups = clean
      ? pickupCount
      : Array.from({ length: pickupCount }).filter(
          () => random() < strategy.pickupChance,
        ).length;

    for (let index = 0; index < collectedPickups; index += 1) {
      store.setActiveFlowMultiplier(flowMultiplier(flow));
      accrue("bags", () =>
        store.collectBag(nextLoot(store.getSnapshot().stage, random)),
      );
      addFlow(10);
    }

    if (encounter === "power-up" && strategy.useAcceleration) {
      store.collectPowerUp("lucky-bidon");
      store.activateReservedPowerUp();
      addFlow(15);
    }

    if (clean && rules) {
      accrue("challenges", () => {
        store.completeChallenge(
          rules.cleanRewardMultiplier,
          rules.difficulty,
        );
      });
      addFlow(rules.flowReward);
      cleanEncounters += 1;
    } else if (
      rules &&
      random() < strategy.collisionChance &&
      (encounter === "traffic" ||
        encounter === "slalom" ||
        encounter === "hairpins")
    ) {
      recordCollision(() => {
        encounter === "traffic" ? store.hitTraffic() : store.hitPothole();
      });
      flow = 0;
      flowGraceSeconds = 0;
    }

    recordMilestones();
    return encounterIntervalSeconds(encounter, openingSnapshot, random);
  };

  const buy = (currency: Currency): void => {
    let plan: PurchasePlan | null = null;
    if (strategy.purchasePolicy === "cheapest") {
      plan = cheapestAffordablePlan(store, currency);
    } else if (strategy.purchasePolicy === "best-payback") {
      plan = purchasePlans[currency] ?? null;
      if (!plan) {
        plan = bestPaybackPlan(
          store,
          currency,
          nowMs,
          progressionModel.enabled,
        );
        if (plan) purchasePlans[currency] = plan;
      }
      if (plan && !store.purchaseStatus(plan.upgrade).available) return;
    }
    if (!plan) return;

    const beforePurchase = store.getSnapshot();
    recordMilestones();
    if (!store.purchase(plan.upgrade)) return;
    const afterPurchase = store.getSnapshot();
    purchases += 1;
    totalSpent[currency] += plan.cost;
    firstPurchaseSeconds ??= elapsedSeconds;
    const stableStats = stationaryStats(
      afterPurchase,
      nowMs,
      progressionModel.enabled,
    );
    purchaseEvents.push({
      seconds: elapsedSeconds,
      upgradeId: plan.upgrade.id,
      level: afterPurchase.upgrades[plan.upgrade.id] ?? 0,
      currency,
      cost: plan.cost,
      balanceAfter: afterPurchase[currency],
      paybackSeconds: plan.paybackSeconds,
      sweatPerMinute: stableStats.sweatPerSecond * 60,
      cashPerMinute: stableStats.cashPerSecond * 60,
    });
    if (plan.upgrade.id === "hyperbike") hyperbikeSeconds = elapsedSeconds;
    const purchasedNormalSteps = upgrades
      .filter((upgrade) => upgrade.id !== "hyperbike")
      .reduce(
        (total, upgrade) =>
          total + (afterPurchase.upgrades[upgrade.id] ?? 0),
        0,
      );
    const availableNormalSteps = upgrades
      .filter((upgrade) => upgrade.id !== "hyperbike")
      .reduce((total, upgrade) => total + upgrade.maxLevel, 0);
    if (
      normalTreeSeconds === null &&
      purchasedNormalSteps >= availableNormalSteps
    ) {
      normalTreeSeconds = elapsedSeconds;
    }
    if (strategy.purchasePolicy === "best-payback") {
      delete purchasePlans.sweat;
      delete purchasePlans.cash;
    }
    void beforePurchase;
  };

  const stepSeconds = 0.25;
  recordMilestones();
  while (elapsedSeconds < durationSeconds) {
    if (store.getSnapshot().raceFinished) store.continueTour();

    if (encounterCountdown <= 0 && strategy.pickupChance > 0) {
      encounterCountdown += processEncounter();
    }

    store.setActiveFlowMultiplier(flowMultiplier(flow));
    const beforeTick = store.getSnapshot();
    nowMs += stepSeconds * 1_000;
    store.tick(stepSeconds);
    recordIncome("riding", beforeTick, store.getSnapshot());
    elapsedSeconds += stepSeconds;
    encounterCountdown -= stepSeconds;
    purchaseCountdown -= stepSeconds;
    flowGraceSeconds -= stepSeconds;
    if (flowGraceSeconds <= 0 && flow > 0) {
      flow = Math.max(
        0,
        flow - store.getSnapshot().stats.flowDecayPerSecond * stepSeconds,
      );
    }

    recordMilestones();
    const loopSnapshot = store.getSnapshot();
    if (loopSnapshot.toursCompleted > observedTours) {
      observedTours = loopSnapshot.toursCompleted;
      tourCompletionSeconds.push(elapsedSeconds);
      riderProgressAtTourCompletion.push({
        level: loopSnapshot.riderProgress.level,
        xp: loopSnapshot.riderProgress.xp,
      });
      firstTourSeconds ??= elapsedSeconds;
    }
    const highestStage = loopSnapshot.highestStage;
    if (highestStage !== plannedHighestStage) {
      plannedHighestStage = highestStage;
      stageReachedSeconds[highestStage] = elapsedSeconds;
      riderProgressAtStageEntry[highestStage] = {
        level: loopSnapshot.riderProgress.level,
        xp: loopSnapshot.riderProgress.xp,
      };
      upgradeLevelsAtStageEntry[highestStage] = {
        ...loopSnapshot.upgrades,
      };
      delete purchasePlans.sweat;
      delete purchasePlans.cash;
    }

    if (
      strategy.purchasePolicy !== "none" &&
      purchaseCountdown <= 0
    ) {
      for (const currency of ["sweat", "cash"] satisfies Currency[]) {
        buy(currency);
      }
      purchaseCountdown += strategy.purchaseEverySeconds;
    }
  }

  const finalSnapshot = store.getSnapshot();
  const finalStats = stationaryStats(
    finalSnapshot,
    nowMs,
    progressionModel.enabled,
  );
  const completedUpgradeSteps = Object.values(
    finalSnapshot.upgrades,
  ).reduce((total, level) => total + level, 0);
  const availableUpgradeSteps = upgrades.reduce(
    (total, upgrade) => total + upgrade.maxLevel,
    0,
  );

  return {
    strategy,
    progressionModel,
    progressionLevel: finalSnapshot.riderProgress.level,
    progressionXp: finalSnapshot.riderProgress.xp,
    progressionMultiplier:
      finalSnapshot.riderProgress.productionMultiplier,
    seed,
    durationSeconds,
    firstPurchaseSeconds,
    firstTourSeconds,
    tourCompletionSeconds,
    riderProgressAtTourCompletion,
    hyperbikeSeconds,
    normalTreeSeconds,
    stageReachedSeconds,
    riderProgressAtStageEntry,
    upgradeLevelsAtStageEntry,
    balanceTimes,
    earnedTimes,
    peakBalance,
    totalEarned,
    totalSpent,
    incomeBySource,
    incomeByStage,
    lossBySource,
    finalBalance: {
      sweat: finalSnapshot.sweat,
      cash: finalSnapshot.cash,
    },
    finalIncomePerMinute: {
      sweat: finalStats.sweatPerSecond * 60,
      cash: finalStats.cashPerSecond * 60,
    },
    purchases,
    completedUpgradeSteps,
    availableUpgradeSteps,
    tours: finalSnapshot.toursCompleted,
    cleanEncounters,
    totalEncounters,
    finalPaceKmh: finalStats.effectivePaceKmh,
    finalNeutralFlatSpeedKmh: permanentFlatSpeedKmh(
      finalSnapshot.upgrades,
    ),
    purchaseEvents,
  };
};

export const simulateEconomySuite = (
  durationSeconds: number,
  seed = 1,
  progressionModel: EconomyProgressionModel = continuousRiderLevel,
  strategies: readonly EconomyStrategy[] = economyStrategies,
): EconomySimulationResult[] =>
  strategies.map((strategy, index) =>
    simulateEconomy({
      durationSeconds,
      seed: seed + index * 10_007,
      strategy,
      progressionModel,
    }),
  );

export const simulateEconomySamples = (
  durationSeconds: number,
  runs: number,
  seed = 1,
  progressionModel: EconomyProgressionModel = continuousRiderLevel,
  strategies: readonly EconomyStrategy[] = economyStrategies,
): EconomySimulationResult[] =>
  Array.from({ length: Math.max(1, Math.floor(runs)) }, (_, run) =>
    simulateEconomySuite(
      durationSeconds,
      seed + run * 100_003,
      progressionModel,
      strategies,
    ),
  ).flat();
