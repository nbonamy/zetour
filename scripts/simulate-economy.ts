import {
  continuousRiderLevel,
  economyStrategies,
  economyThresholds,
  noEconomyProgression,
  simulateEconomySamples,
  type EconomySimulationResult,
} from "../src/core/economySimulation";
import { formatCompactNumber } from "../src/core/format";
import { economyBalance } from "../src/core/economyBalance";
import { permanentFlatSpeedKmh } from "../src/core/gameStore";
import { upgradeCost, upgrades } from "../src/core/upgrades";

const argumentValue = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(
    prefix.length,
  );
};

if (process.argv.includes("--help")) {
  console.log(`
Ze Tour economy simulator

Usage:
  npm run simulate:economy -- [options]

Options:
  --minutes=N                   simulated minutes per strategy (default 60)
  --runs=N                      deterministic seed samples (default 3)
  --seed=N                      first random seed (default 42)
  --progression=rider-level|none
  --strategies=casual,skilled    run only selected strategies
  --trace=passive|casual|skilled|perfect
  --check                       fail when declared constraints miss
  --json                        emit raw machine-readable samples
  --help                        show this help
`);
  process.exit(0);
}

const positiveNumber = (
  name: string,
  fallback: number,
  integer = false,
): number => {
  const raw = argumentValue(name);
  const parsed = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive number`);
  }
  return integer ? Math.floor(parsed) : parsed;
};

const minutes = positiveNumber("minutes", 60);
const seed = positiveNumber("seed", 42, true);
const runs = positiveNumber("runs", 3, true);
const json = process.argv.includes("--json");
const check = process.argv.includes("--check");
const trace = argumentValue("trace");
const progression = argumentValue("progression") ?? "rider-level";
if (progression !== "rider-level" && progression !== "none") {
  throw new Error("--progression must be rider-level or none");
}
const progressionModel =
  progression === "rider-level"
    ? continuousRiderLevel
    : noEconomyProgression;
const requestedStrategies = (argumentValue("strategies") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const selectedStrategies =
  requestedStrategies.length === 0
    ? economyStrategies
    : economyStrategies.filter((strategy) =>
        requestedStrategies.includes(strategy.id),
      );
if (selectedStrategies.length !== requestedStrategies.length) {
  throw new Error(
    `--strategies must contain only: ${economyStrategies.map(({ id }) => id).join(", ")}`,
  );
}
const samples = simulateEconomySamples(
  minutes * 60,
  runs,
  seed,
  progressionModel,
  selectedStrategies,
);
const grouped = Object.fromEntries(
  selectedStrategies.map((strategy) => [
    strategy.id,
    samples.filter((sample) => sample.strategy.id === strategy.id),
  ]),
) as Record<string, EconomySimulationResult[]>;

const percentile = (values: number[], fraction: number): number => {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.round((sorted.length - 1) * fraction)),
  );
  return sorted[index];
};

const median = (values: number[]): number => percentile(values, 0.5);

const time = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const wholeSeconds = Math.round(seconds);
  const wholeMinutes = Math.floor(wholeSeconds / 60);
  return `${wholeMinutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
};

const timeSummary = (values: Array<number | null>): string => {
  const numeric = values.map((value) => value ?? Number.POSITIVE_INFINITY);
  const middle = percentile(numeric, 0.5);
  if (!Number.isFinite(middle)) return "—";
  if (values.length === 1) return time(middle);
  const low = percentile(numeric, 0.1);
  const high = percentile(numeric, 0.9);
  return `${time(middle)} [${time(low)}–${time(high)}]`;
};

const compactMedian = (values: number[]): string =>
  formatCompactNumber(median(values));

const thresholdTimes = (
  results: EconomySimulationResult[],
  currency: "sweat" | "cash",
  threshold: (typeof economyThresholds)[number],
): Array<number | null> =>
  results.map((result) => result.balanceTimes[currency][threshold]);

interface CalibrationCheck {
  constraint: string;
  target: string;
  observed: string;
  passed: boolean;
}

const calibrationChecks: CalibrationCheck[] = [];
const casualResults = grouped.casual ?? [];
if (casualResults.length > 0) {
  const firstPurchases = casualResults
    .map((result) => result.firstPurchaseSeconds)
    .filter((value): value is number => value !== null);
  const firstTours = casualResults
    .map((result) => result.firstTourSeconds)
    .filter((value): value is number => value !== null);
  const firstPurchaseTarget = economyBalance.pacing.firstPurchaseSeconds;
  const firstTourTarget = economyBalance.pacing.firstTourMinutes.map(
    (value) => value * 60,
  );
  calibrationChecks.push({
    constraint: "Casual first purchase",
    target: `${time(firstPurchaseTarget[0])}–${time(firstPurchaseTarget[1])}`,
    observed: timeSummary(casualResults.map(({ firstPurchaseSeconds }) => firstPurchaseSeconds)),
    passed:
      firstPurchases.length === casualResults.length &&
      firstPurchases.every(
        (value) =>
          value >= firstPurchaseTarget[0] && value <= firstPurchaseTarget[1],
      ),
  });
  calibrationChecks.push({
    constraint: "Casual first Tour",
    target: `${time(firstTourTarget[0])}–${time(firstTourTarget[1])}`,
    observed: timeSummary(casualResults.map(({ firstTourSeconds }) => firstTourSeconds)),
    passed:
      firstTours.length === casualResults.length &&
      firstTours.every(
        (value) => value >= firstTourTarget[0] && value <= firstTourTarget[1],
      ),
  });
  economyBalance.riderProgression.stageEntryLevelTargets
    .slice(1)
    .forEach((targetLevel, index) => {
      const nextStage = index + 2;
      const levels = casualResults.map(
        (result) =>
          result.riderProgressAtStageEntry[nextStage]?.level ?? 1,
      );
      calibrationChecks.push({
        constraint: `Stage ${index + 1} Rider Level`,
        target: `Level ${targetLevel}`,
        observed: `Level ${Math.round(median(levels))}`,
        passed: levels.every((level) => level === targetLevel),
      });
    });
}

const skilledResultsForChecks = grouped.skilled ?? [];
if (skilledResultsForChecks.length > 0) {
  const target = economyBalance.pacing.skilledHyperbikeMinutes.map(
    (value) => value * 60,
  );
  const arrivals = skilledResultsForChecks
    .map(({ hyperbikeSeconds }) => hyperbikeSeconds)
    .filter((value): value is number => value !== null);
  calibrationChecks.push({
    constraint: "Skilled Hyperbike",
    target: `${time(target[0])}–${time(target[1])}`,
    observed: timeSummary(
      skilledResultsForChecks.map(({ hyperbikeSeconds }) => hyperbikeSeconds),
    ),
    passed:
      arrivals.length === skilledResultsForChecks.length &&
      arrivals.every((value) => value >= target[0] && value <= target[1]),
  });
}

const treeCompletionTimes = samples
  .map(({ normalTreeSeconds }) => normalTreeSeconds)
  .filter((value): value is number => value !== null);
if (treeCompletionTimes.length > 0) {
  const earliest = economyBalance.pacing.earliestNormalTreeCompletionMinutes * 60;
  calibrationChecks.push({
    constraint: "Normal tree runway",
    target: `≥ ${time(earliest)}`,
    observed: time(Math.min(...treeCompletionTimes)),
    passed: treeCompletionTimes.every((value) => value >= earliest),
  });
}

const basePermanentFlatSpeed = permanentFlatSpeedKmh({});
const maximumPermanentFlatSpeed = permanentFlatSpeedKmh(
  Object.fromEntries(
    upgrades.map((upgrade) => [upgrade.id, upgrade.maxLevel]),
  ),
);
calibrationChecks.push({
  constraint: "Permanent flat speed",
  target: `${economyBalance.speed.neutralFlatMinKmh}–${economyBalance.speed.neutralFlatMaxKmh} km/h`,
  observed: `${basePermanentFlatSpeed}–${maximumPermanentFlatSpeed} km/h`,
  passed:
    basePermanentFlatSpeed === economyBalance.speed.neutralFlatMinKmh &&
    maximumPermanentFlatSpeed === economyBalance.speed.neutralFlatMaxKmh &&
    samples.every(
      ({ finalNeutralFlatSpeedKmh }) =>
        finalNeutralFlatSpeedKmh >= economyBalance.speed.neutralFlatMinKmh &&
        finalNeutralFlatSpeedKmh <= economyBalance.speed.neutralFlatMaxKmh,
    ),
});

if (json) {
  console.log(JSON.stringify(samples, null, 2));
} else {
  console.log(
    `\nZe Tour economy calibration · ${minutes} min · ${runs} seed${runs === 1 ? "" : "s"} from ${seed} · ${progressionModel.label}`,
  );
  if (runs > 1) console.log("Times are median [p10–p90].\n");
  else console.log();

  console.table(
    selectedStrategies.map((strategy) => {
      const results = grouped[strategy.id];
      return {
        strategy: strategy.label,
        "first buy": timeSummary(
          results.map((result) => result.firstPurchaseSeconds),
        ),
        "first Tour": timeSummary(
          results.map((result) => result.firstTourSeconds),
        ),
        "Sweat 1K": timeSummary(thresholdTimes(results, "sweat", 1_000)),
        "Sweat 100K": timeSummary(
          thresholdTimes(results, "sweat", 100_000),
        ),
        "Sweat 1M": timeSummary(
          thresholdTimes(results, "sweat", 1_000_000),
        ),
        "Cash 1M": timeSummary(thresholdTimes(results, "cash", 1_000_000)),
        "Cash 100M": timeSummary(
          thresholdTimes(results, "cash", 100_000_000),
        ),
        Hyperbike: timeSummary(
          results.map((result) => result.hyperbikeSeconds),
        ),
        "tree complete": timeSummary(
          results.map((result) => result.normalTreeSeconds),
        ),
        "peak Sweat": compactMedian(
          results.map((result) => result.peakBalance.sweat),
        ),
        "peak Cash": compactMedian(
          results.map((result) => result.peakBalance.cash),
        ),
        steps: `${Math.round(
          median(results.map((result) => result.completedUpgradeSteps)),
        )}/${results[0]?.availableUpgradeSteps ?? 0}`,
        tours: Math.round(median(results.map((result) => result.tours))),
        level: Math.round(
          median(results.map((result) => result.progressionLevel)),
        ),
        "level gain": `${compactMedian(
          results.map((result) => result.progressionMultiplier),
        )}×`,
        "neutral flat": `${compactMedian(
          results.map((result) => result.finalNeutralFlatSpeedKmh),
        )} km/h`,
      };
    }),
  );

  console.log("\nDeclared calibration constraints\n");
  console.table(
    calibrationChecks.map(({ passed, ...row }) => ({
      ...row,
      status: passed ? "PASS" : "FAIL",
    })),
  );

  const standardResults = grouped.casual;
  if (standardResults?.length && progressionModel.enabled) {
    console.log("\nRider Level checkpoints · Casual standard run\n");
    console.table(
      economyBalance.riderProgression.stageEntryLevelTargets
        .slice(1)
        .map((targetLevel, index) => {
          const completedStage = index + 1;
          const nextStage = completedStage + 1;
          const levels = standardResults.map(
            (result) =>
              result.riderProgressAtStageEntry[nextStage]?.level ?? 1,
          );
          const xp = standardResults.map(
            (result) =>
              result.riderProgressAtStageEntry[nextStage]?.xp ?? 0,
          );
          return {
            stage: completedStage,
            target: `Level ${targetLevel}`,
            observed: `Level ${Math.round(median(levels))}`,
            XP: compactMedian(xp),
            status: levels.every((level) => level === targetLevel)
              ? "PASS"
              : "TUNE",
          };
        }),
    );
  }

  console.log("\nStable production at the end of the run\n");
  console.table(
    selectedStrategies.map((strategy) => {
      const results = grouped[strategy.id];
      return {
        strategy: strategy.label,
        "Sweat / min": compactMedian(
          results.map((result) => result.finalIncomePerMinute.sweat),
        ),
        "Cash / min": compactMedian(
          results.map((result) => result.finalIncomePerMinute.cash),
        ),
        "earned Sweat": compactMedian(
          results.map((result) => result.totalEarned.sweat),
        ),
        "earned Cash": compactMedian(
          results.map((result) => result.totalEarned.cash),
        ),
        pace: `${compactMedian(
          results.map((result) => result.finalPaceKmh),
        )} km/h`,
      };
    }),
  );

  console.log("\nIncome sources (median earned during run)\n");
  console.table(
    selectedStrategies.map((strategy) => {
      const results = grouped[strategy.id];
      return {
        strategy: strategy.label,
        "riding Sweat": compactMedian(
          results.map((result) => result.incomeBySource.riding.sweat),
        ),
        "bags Sweat": compactMedian(
          results.map((result) => result.incomeBySource.bags.sweat),
        ),
        "clean Sweat": compactMedian(
          results.map((result) => result.incomeBySource.challenges.sweat),
        ),
        "riding Cash": compactMedian(
          results.map((result) => result.incomeBySource.riding.cash),
        ),
        "bags Cash": compactMedian(
          results.map((result) => result.incomeBySource.bags.cash),
        ),
        "clean Cash": compactMedian(
          results.map((result) => result.incomeBySource.challenges.cash),
        ),
        collisions: compactMedian(
          results.map((result) => result.lossBySource.collisions.cash),
        ),
      };
    }),
  );

  const skilledResults = grouped.skilled;
  if (skilledResults?.length) {
    const averageStageReward = (
      result: EconomySimulationResult,
      stage: number,
      source: "bags" | "challenges",
      currency: "sweat" | "cash",
    ): number => {
      const stageIncome = result.incomeByStage[stage];
      if (!stageIncome) return 0;
      const count =
        source === "bags"
          ? stageIncome.bagPickups
          : stageIncome.cleanChallenges;
      return count > 0 ? stageIncome.income[source][currency] / count : 0;
    };

    console.log("\nReward scaling by sector · Skilled planner\n");
    console.table(
      [1, 2, 3, 4, 5].map((stage) => ({
        sector: stage,
        "bag Sweat": compactMedian(
          skilledResults.map((result) =>
            averageStageReward(result, stage, "bags", "sweat"),
          ),
        ),
        "bag Cash": compactMedian(
          skilledResults.map((result) =>
            averageStageReward(result, stage, "bags", "cash"),
          ),
        ),
        "clean Sweat": compactMedian(
          skilledResults.map((result) =>
            averageStageReward(result, stage, "challenges", "sweat"),
          ),
        ),
        "clean Cash": compactMedian(
          skilledResults.map((result) =>
            averageStageReward(result, stage, "challenges", "cash"),
          ),
        ),
      })),
    );
  }

  console.log("\nUpgrade cost cliffs\n");
  console.table(
    upgrades.map((upgrade) => {
      const costs = Array.from({ length: upgrade.maxLevel }, (_, level) =>
        upgradeCost(upgrade, level),
      );
      return {
        upgrade: upgrade.name,
        currency: upgrade.currency,
        steps: upgrade.maxLevel,
        costs: costs.map(formatCompactNumber).join(" → "),
        total: formatCompactNumber(
          costs.reduce((total, cost) => total + cost, 0),
        ),
      };
    }),
  );

  if (trace) {
    const traced = grouped[trace]?.[0];
    if (!traced) {
      console.log(`\nUnknown trace strategy: ${trace}\n`);
    } else {
      console.log(
        `\nPurchase trace · ${traced.strategy.label} · seed ${traced.seed}\n`,
      );
      console.table(
        traced.purchaseEvents.map((event) => ({
          time: time(event.seconds),
          upgrade: `${event.upgradeId} ${event.level}`,
          cost: `${event.currency === "cash" ? "$" : ""}${formatCompactNumber(event.cost)}`,
          balance: formatCompactNumber(event.balanceAfter),
          payback: time(event.paybackSeconds),
          "Sweat / min": formatCompactNumber(event.sweatPerMinute),
          "Cash / min": formatCompactNumber(event.cashPerMinute),
        })),
      );
    }
  }
}

if (check && calibrationChecks.some(({ passed }) => !passed)) {
  process.exitCode = 1;
}
