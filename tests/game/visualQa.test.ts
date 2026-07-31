import { describe, expect, it } from "vitest";
import { parseVisualQaOverrides } from "../../src/game/visualQa";

describe("visual QA overrides", () => {
  it("parses deterministic stage and slope states for browser QA", () => {
    expect(
      parseVisualQaOverrides("?qaStage=2&qaGradient=-0.05"),
    ).toEqual({
      domestiques: null,
      flow: null,
      gradient: -0.05,
      paused: false,
      stage: 2,
    });
  });

  it("clamps out-of-range values and ignores invalid input", () => {
    expect(
      parseVisualQaOverrides("?qaStage=99&qaGradient=0.8"),
    ).toEqual({
      domestiques: null,
      flow: null,
      gradient: 0.12,
      paused: false,
      stage: 5,
    });
    expect(
      parseVisualQaOverrides("?qaStage=nope&qaGradient=nope"),
    ).toEqual({
      domestiques: null,
      flow: null,
      gradient: null,
      paused: false,
      stage: null,
    });
  });

  it("supports clean deterministic paused screenshots", () => {
    expect(parseVisualQaOverrides("?qaPaused=1").paused).toBe(true);
    expect(parseVisualQaOverrides("?qaPaused=true").paused).toBe(true);
    expect(parseVisualQaOverrides("?qaPaused=0").paused).toBe(false);
  });

  it("forces support-rider and Flow states without altering the save", () => {
    expect(
      parseVisualQaOverrides("?qaDomestiques=3&qaFlow=82.5"),
    ).toMatchObject({
      domestiques: 3,
      flow: 82.5,
    });
    expect(
      parseVisualQaOverrides("?qaDomestiques=20&qaFlow=-4"),
    ).toMatchObject({
      domestiques: 3,
      flow: 0,
    });
  });
});
