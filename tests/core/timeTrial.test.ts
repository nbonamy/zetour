import { describe, expect, it } from "vitest";
import {
  captureReachedSplits,
  completeTimeRecord,
  createCourseRecord,
  fastestRecord,
  formatRaceTime,
  recordDeltaStatus,
  recordSecondsAtProgress,
} from "../../src/core/timeTrial";

describe("time trial records", () => {
  it("builds a deterministic split curve from course speed", () => {
    const record = createCourseRecord(1_000, () => 20, 10);

    expect(record.splits).toHaveLength(11);
    expect(record.totalSeconds).toBeCloseTo(180);
    expect(recordSecondsAtProgress(record, 0.5)).toBeCloseTo(90);
  });

  it("captures every checkpoint crossed inside one frame", () => {
    const splits = captureReachedSplits([0], 0, 0.26, 0, 26, 4);

    expect(splits).toHaveLength(2);
    expect(splits[0]).toBe(0);
    expect(splits[1]).toBeCloseTo(25);
    const laterSplits = captureReachedSplits(
      splits,
      0.26,
      0.8,
      26,
      80,
      4,
    );
    expect(laterSplits).toHaveLength(4);
    expect(laterSplits[2]).toBeCloseTo(50);
    expect(laterSplits[3]).toBeCloseTo(75);
  });

  it("selects only a genuinely faster personal record", () => {
    const course = { totalSeconds: 100, splits: [0, 100] };
    const slower = { totalSeconds: 101, splits: [0, 101] };
    const faster = { totalSeconds: 90, splits: [0, 90] };

    expect(fastestRecord(course, slower).source).toBe("course");
    expect(fastestRecord(course, faster).source).toBe("personal");
  });

  it("fills missing migration splits without inventing a faster finish", () => {
    expect(completeTimeRecord([0, 25], 100, 4)).toEqual({
      totalSeconds: 100,
      splits: [0, 25, 50, 75, 100],
    });
  });

  it("formats timing and classifies the live delta", () => {
    expect(formatRaceTime(83.26)).toBe("1:23.3");
    expect(recordDeltaStatus(-2.4)).toBe("ahead");
    expect(recordDeltaStatus(1.2)).toBe("behind");
    expect(recordDeltaStatus(0.01)).toBe("even");
  });
});
