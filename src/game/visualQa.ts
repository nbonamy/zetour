import type { PowerUpType } from "../core/gameStore";

export interface VisualQaOverrides {
  domestiques: number | null;
  drafting: boolean;
  flow: number | null;
  gradient: number | null;
  paused: boolean;
  powerUp: PowerUpType | null;
  stage: number | null;
}

const powerUpTypes: readonly PowerUpType[] = [
  "super-draft",
  "lucky-bidon",
  "jump",
];

const finiteNumber = (value: string | null): number | null => {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseVisualQaOverrides = (
  search: string,
): VisualQaOverrides => {
  const parameters = new URLSearchParams(search);
  const rawDomestiques = finiteNumber(parameters.get("qaDomestiques"));
  const rawDrafting = parameters.get("qaDrafting");
  const rawFlow = finiteNumber(parameters.get("qaFlow"));
  const rawGradient = finiteNumber(parameters.get("qaGradient"));
  const rawStage = finiteNumber(parameters.get("qaStage"));
  const rawPaused = parameters.get("qaPaused");
  const rawPowerUp = parameters.get("qaPowerUp");
  return {
    domestiques:
      rawDomestiques === null
        ? null
        : Math.max(0, Math.min(3, Math.floor(rawDomestiques))),
    drafting: rawDrafting === "1" || rawDrafting === "true",
    flow:
      rawFlow === null
        ? null
        : Math.max(0, Math.min(100, rawFlow)),
    gradient:
      rawGradient === null
        ? null
        : Math.max(-0.12, Math.min(0.12, rawGradient)),
    paused: rawPaused === "1" || rawPaused === "true",
    powerUp:
      powerUpTypes.find((type) => type === rawPowerUp) ?? null,
    stage:
      rawStage === null
        ? null
        : Math.max(1, Math.min(5, Math.round(rawStage))),
  };
};

export const readVisualQaOverrides = (): VisualQaOverrides => {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return {
      domestiques: null,
      drafting: false,
      flow: null,
      gradient: null,
      paused: false,
      powerUp: null,
      stage: null,
    };
  }
  return parseVisualQaOverrides(window.location.search);
};
