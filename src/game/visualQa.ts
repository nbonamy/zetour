export interface VisualQaOverrides {
  gradient: number | null;
  paused: boolean;
  stage: number | null;
}

const finiteNumber = (value: string | null): number | null => {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseVisualQaOverrides = (
  search: string,
): VisualQaOverrides => {
  const parameters = new URLSearchParams(search);
  const rawGradient = finiteNumber(parameters.get("qaGradient"));
  const rawStage = finiteNumber(parameters.get("qaStage"));
  const rawPaused = parameters.get("qaPaused");
  return {
    gradient:
      rawGradient === null
        ? null
        : Math.max(-0.12, Math.min(0.12, rawGradient)),
    paused: rawPaused === "1" || rawPaused === "true",
    stage:
      rawStage === null
        ? null
        : Math.max(1, Math.min(5, Math.round(rawStage))),
  };
};

export const readVisualQaOverrides = (): VisualQaOverrides => {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return { gradient: null, paused: false, stage: null };
  }
  return parseVisualQaOverrides(window.location.search);
};
