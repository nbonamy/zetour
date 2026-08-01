<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

const emit = defineEmits<{
  "blocked-change": [blocked: boolean];
}>();

const compactViewport = ref(false);
const portrait = ref(false);
const attempting = ref(false);
const manualRotationNeeded = ref(false);
const supportsProgrammaticLandscape = ref(false);
const showIosInstallHint = ref(false);
const blocked = computed(() => compactViewport.value && portrait.value);

let compactViewportQuery: MediaQueryList | undefined;
let portraitQuery: MediaQueryList | undefined;
let standaloneQuery: MediaQueryList | undefined;
let settleFrame: number | undefined;
let settleTimer: number | undefined;

const viewportProperties = [
  "--mobile-viewport-height",
  "--mobile-viewport-width",
  "--mobile-game-width",
] as const;

type OptionallyFullscreenElement = {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
};

const cssPixels = (value: number): string =>
  `${Math.round(value * 100) / 100}px`;

const syncVisualViewport = (): void => {
  const viewport = window.visualViewport;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  const gameWidth = Math.min(width, height * (16 / 9));
  const style = document.documentElement.style;

  style.setProperty("--mobile-viewport-width", cssPixels(width));
  style.setProperty("--mobile-viewport-height", cssPixels(height));
  style.setProperty("--mobile-game-width", cssPixels(gameWidth));
};

const resetLandscapeViewport = (): void => {
  if (portrait.value) return;

  window.scrollTo(0, 0);
  syncVisualViewport();
  if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
  if (settleTimer !== undefined) window.clearTimeout(settleTimer);
  settleFrame = requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    syncVisualViewport();
  });
  settleTimer = window.setTimeout(() => {
    window.scrollTo(0, 0);
    syncVisualViewport();
  }, 250);
};

const syncMediaQueries = (): void => {
  compactViewport.value = compactViewportQuery?.matches ?? false;
  portrait.value = portraitQuery?.matches ?? false;
  if (!portrait.value) manualRotationNeeded.value = false;
  syncVisualViewport();
  resetLandscapeViewport();
};

watch(
  blocked,
  (value) => emit("blocked-change", value),
  { immediate: true },
);

const requestLandscape = async (): Promise<void> => {
  attempting.value = true;
  manualRotationNeeded.value = false;

  try {
    const fullscreenElement =
      document.documentElement as unknown as OptionallyFullscreenElement;
    if (!document.fullscreenElement && fullscreenElement.requestFullscreen) {
      await fullscreenElement.requestFullscreen({
        navigationUI: "hide",
      });
    }
  } catch {
    // Fullscreen is optional; installed apps and some browsers can lock without it.
  }

  try {
    const orientation = screen.orientation as unknown as {
      lock?: (orientation: "landscape") => Promise<void>;
    };
    await orientation.lock?.("landscape");
  } catch {
    // Safari and browsers without orientation lock fall back to physical rotation.
  }

  syncMediaQueries();
  manualRotationNeeded.value = blocked.value;
  attempting.value = false;
};

onMounted(() => {
  if (typeof window.matchMedia !== "function") return;

  compactViewportQuery = window.matchMedia("(max-width: 1024px)");
  portraitQuery = window.matchMedia("(orientation: portrait)");
  standaloneQuery = window.matchMedia("(display-mode: standalone)");
  const orientation = screen.orientation as unknown as {
    lock?: (orientation: "landscape") => Promise<void>;
  };
  const fullscreenElement =
    document.documentElement as unknown as OptionallyFullscreenElement;
  supportsProgrammaticLandscape.value = Boolean(
    fullscreenElement.requestFullscreen && orientation?.lock,
  );
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  const iosDevice =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  showIosInstallHint.value =
    iosDevice &&
    iosNavigator.standalone !== true &&
    standaloneQuery.matches !== true;
  compactViewportQuery.addEventListener("change", syncMediaQueries);
  portraitQuery.addEventListener("change", syncMediaQueries);
  window.addEventListener("resize", syncVisualViewport);
  window.visualViewport?.addEventListener("resize", syncVisualViewport);
  window.visualViewport?.addEventListener("scroll", syncVisualViewport);
  syncMediaQueries();
});

onBeforeUnmount(() => {
  compactViewportQuery?.removeEventListener("change", syncMediaQueries);
  portraitQuery?.removeEventListener("change", syncMediaQueries);
  window.removeEventListener("resize", syncVisualViewport);
  window.visualViewport?.removeEventListener("resize", syncVisualViewport);
  window.visualViewport?.removeEventListener("scroll", syncVisualViewport);
  if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
  if (settleTimer !== undefined) window.clearTimeout(settleTimer);
  viewportProperties.forEach((property) =>
    document.documentElement.style.removeProperty(property),
  );
});
</script>

<template>
  <Teleport to="body">
    <Transition name="mobile-landscape">
      <div
        v-if="blocked"
        class="mobile-landscape-gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="landscape-gate-title"
        aria-describedby="landscape-gate-description"
      >
        <section class="mobile-landscape-card">
          <div class="rotate-phone" aria-hidden="true">
            <span></span>
            <i>↻</i>
          </div>
          <p class="eyebrow">Mobile ride</p>
          <h2 id="landscape-gate-title">Turn for Ze Tour</h2>
          <p id="landscape-gate-description">
            Ze Tour rides in landscape. Then swipe up or down on the road to
            change lane.
          </p>
          <button
            v-if="supportsProgrammaticLandscape && !manualRotationNeeded"
            type="button"
            :disabled="attempting"
            @click="requestLandscape"
          >
            {{
              attempting
                ? "Entering landscape…"
                : "Play in landscape"
            }}
          </button>
          <strong v-else class="mobile-rotate-instruction">
            Rotate your phone sideways
          </strong>
          <small v-if="showIosInstallHint">
            For fullscreen without Safari’s bars, tap Share → Add to Home
            Screen, then launch Ze Tour from its icon.
          </small>
          <small v-else-if="manualRotationNeeded">
            Your browser cannot rotate automatically. Turn the phone sideways
            to continue.
          </small>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
