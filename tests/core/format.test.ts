import { describe, expect, it } from "vitest";
import {
  formatCompactNumber,
  formatMultiplier,
} from "../../src/core/format";

describe("large-number formatting", () => {
  it("keeps small values readable", () => {
    expect(formatCompactNumber(42)).toBe("42");
    expect(formatCompactNumber(9.5)).toBe("9.5");
  });

  it("uses incremental-game suffixes for large values", () => {
    expect(formatCompactNumber(1_250)).toBe("1.3K");
    expect(formatCompactNumber(184_000)).toBe("184K");
    expect(formatCompactNumber(2_400_000)).toBe("2.4M");
    expect(formatMultiplier(2_400_000)).toBe("×2.4M");
  });
});
