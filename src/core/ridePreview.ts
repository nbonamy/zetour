const previews = {
  mountain: { title: "Mountain preview", route: "Alpe d’Huez", stage: 5, gradient: 0.1 },
  descent: { title: "Descent preview", route: "Provence descent", stage: 3, gradient: -0.04 },
};

export const readRidePreview = (
  search = typeof window === "undefined" ? "" : window.location.search,
) => {
  const name = new URLSearchParams(search).get("preview");
  return name === "mountain" || name === "descent" ? previews[name] : null;
};
