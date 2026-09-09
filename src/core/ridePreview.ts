export const isMountainPreview = (
  search = typeof window === "undefined" ? "" : window.location.search,
): boolean => new URLSearchParams(search).get("preview") === "mountain";
