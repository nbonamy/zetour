export const TIME_TRIAL_SPLIT_COUNT = 24;

export interface SectorTimeRecord {
  totalSeconds: number;
  splits: number[];
}

export type RecordDeltaStatus = "ahead" | "behind" | "even";

export const createCourseRecord = (
  distanceM: number,
  speedKmhAtProgress: (progress: number) => number,
  splitCount = TIME_TRIAL_SPLIT_COUNT,
): SectorTimeRecord => {
  const safeSplitCount = Math.max(1, Math.floor(splitCount));
  const splitDistanceM = Math.max(0, distanceM) / safeSplitCount;
  const splits = [0];
  let elapsedSeconds = 0;

  for (let index = 1; index <= safeSplitCount; index += 1) {
    const midpointProgress = (index - 0.5) / safeSplitCount;
    const speedKmh = Math.max(1, speedKmhAtProgress(midpointProgress));
    elapsedSeconds += splitDistanceM / (speedKmh / 3.6);
    splits.push(elapsedSeconds);
  }

  return { totalSeconds: elapsedSeconds, splits };
};

export const captureReachedSplits = (
  existingSplits: number[],
  previousProgress: number,
  progress: number,
  previousElapsedSeconds: number,
  elapsedSeconds: number,
  splitCount = TIME_TRIAL_SPLIT_COUNT,
): number[] => {
  const safeSplitCount = Math.max(1, Math.floor(splitCount));
  const result =
    existingSplits.length > 0 ? [...existingSplits] : [0];
  const safePreviousProgress = Math.max(0, Math.min(1, previousProgress));
  const safeProgress = Math.max(safePreviousProgress, Math.min(1, progress));
  const progressSpan = safeProgress - safePreviousProgress;

  while (result.length <= safeSplitCount) {
    const splitProgress = result.length / safeSplitCount;
    if (splitProgress > safeProgress + Number.EPSILON) break;
    const frameRatio =
      progressSpan <= Number.EPSILON
        ? 1
        : Math.max(
            0,
            Math.min(
              1,
              (splitProgress - safePreviousProgress) / progressSpan,
            ),
          );
    result.push(
      previousElapsedSeconds +
        (elapsedSeconds - previousElapsedSeconds) * frameRatio,
    );
  }

  return result;
};

export const recordSecondsAtProgress = (
  record: SectorTimeRecord,
  progress: number,
): number => {
  if (record.splits.length < 2) return 0;
  const safeProgress = Math.max(0, Math.min(1, progress));
  const position = safeProgress * (record.splits.length - 1);
  const index = Math.min(record.splits.length - 2, Math.floor(position));
  const localProgress = position - index;
  return (
    record.splits[index] +
    (record.splits[index + 1] - record.splits[index]) * localProgress
  );
};

export const completeTimeRecord = (
  existingSplits: number[],
  totalSeconds: number,
  splitCount = TIME_TRIAL_SPLIT_COUNT,
): SectorTimeRecord => {
  const safeSplitCount = Math.max(1, Math.floor(splitCount));
  const safeTotalSeconds = Math.max(0, totalSeconds);
  const splits =
    existingSplits.length > 0 ? [...existingSplits] : [0];
  const knownFinalIndex = Math.min(safeSplitCount, splits.length - 1);
  const knownFinalTime = splits[knownFinalIndex] ?? 0;
  const remainingSplits = safeSplitCount - knownFinalIndex;

  while (splits.length <= safeSplitCount) {
    const completedSinceKnown = splits.length - knownFinalIndex;
    const ratio =
      remainingSplits <= 0 ? 1 : completedSinceKnown / remainingSplits;
    splits.push(
      knownFinalTime +
        (safeTotalSeconds - knownFinalTime) * Math.max(0, Math.min(1, ratio)),
    );
  }
  splits[safeSplitCount] = safeTotalSeconds;

  return { totalSeconds: safeTotalSeconds, splits };
};

export const fastestRecord = (
  courseRecord: SectorTimeRecord,
  personalRecord?: SectorTimeRecord,
): { record: SectorTimeRecord; source: "course" | "personal" } =>
  personalRecord &&
  personalRecord.totalSeconds < courseRecord.totalSeconds
    ? { record: personalRecord, source: "personal" }
    : { record: courseRecord, source: "course" };

export const recordDeltaStatus = (
  deltaSeconds: number,
  toleranceSeconds = 0.05,
): RecordDeltaStatus =>
  deltaSeconds < -toleranceSeconds
    ? "ahead"
    : deltaSeconds > toleranceSeconds
      ? "behind"
      : "even";

export const formatRaceTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds - minutes * 60;
  return `${minutes}:${remainingSeconds.toFixed(1).padStart(4, "0")}`;
};
