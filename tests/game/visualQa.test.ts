import { describe, expect, it } from "vitest";
import { parseVisualQaOverrides } from "../../src/game/visualQa";

describe("visual QA overrides", () => {
  it("parses deterministic stage and slope states for browser QA", () => {
    expect(
      parseVisualQaOverrides("?qaStage=2&qaGradient=-0.05"),
    ).toEqual({
      domestiques: null,
      draftLane: null,
      drafting: false,
      encounter: null,
      finished: false,
      flow: null,
      gradient: -0.05,
      paused: false,
      powerUp: null,
      stage: 2,
    });
  });

  it("clamps out-of-range values and ignores invalid input", () => {
    expect(
      parseVisualQaOverrides("?qaStage=99&qaGradient=0.8"),
    ).toEqual({
      domestiques: null,
      draftLane: null,
      drafting: false,
      encounter: null,
      finished: false,
      flow: null,
      gradient: 0.12,
      paused: false,
      powerUp: null,
      stage: 5,
    });
    expect(
      parseVisualQaOverrides("?qaStage=nope&qaGradient=nope"),
    ).toEqual({
      domestiques: null,
      draftLane: null,
      drafting: false,
      encounter: null,
      finished: false,
      flow: null,
      gradient: null,
      paused: false,
      powerUp: null,
      stage: null,
    });
  });

  it("supports clean deterministic paused screenshots", () => {
    expect(parseVisualQaOverrides("?qaPaused=1").paused).toBe(true);
    expect(parseVisualQaOverrides("?qaPaused=true").paused).toBe(true);
    expect(parseVisualQaOverrides("?qaPaused=0").paused).toBe(false);
  });

  it("shows a deterministic finished-race view for results QA", () => {
    expect(parseVisualQaOverrides("?qaFinished=1").finished).toBe(true);
    expect(parseVisualQaOverrides("?qaFinished=true").finished).toBe(true);
    expect(parseVisualQaOverrides("?qaFinished=0").finished).toBe(false);
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

  it("selects active drafting effects and rejects unknown power-ups", () => {
    expect(
      parseVisualQaOverrides(
        "?qaDrafting=true&qaPowerUp=super-draft",
      ),
    ).toMatchObject({
      drafting: true,
      powerUp: "super-draft",
    });
    expect(
      parseVisualQaOverrides("?qaDrafting=0&qaPowerUp=rocket"),
    ).toMatchObject({
      drafting: false,
      powerUp: null,
    });
  });

  it("forces a known encounter and draft lane for live gameplay QA", () => {
    expect(
      parseVisualQaOverrides("?qaEncounter=traffic"),
    ).toMatchObject({ encounter: "traffic" });
    expect(
      parseVisualQaOverrides(
        "?qaEncounter=draft&qaDraftLane=1",
      ),
    ).toMatchObject({
      encounter: "draft",
      draftLane: 1,
    });
    expect(
      parseVisualQaOverrides(
        "?qaEncounter=dragon&qaDraftLane=9",
      ),
    ).toMatchObject({
      encounter: null,
      draftLane: 2,
    });
  });
});
