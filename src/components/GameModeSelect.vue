<script setup lang="ts">
export type GameMode = "2d" | "3d";

defineEmits<{
  select: [mode: GameMode];
}>();
</script>

<template>
  <section class="mode-select" aria-labelledby="mode-select-title">
    <header class="mode-select-title">
      <p>Choose your ride</p>
      <h1 id="mode-select-title" aria-label="Ze Tour">
        <span>ZE</span> <span>TOUR</span>
      </h1>
      <small>One career. Two ways to race.</small>
    </header>

    <div class="mode-cards">
      <button
        type="button"
        class="mode-card mode-card-2d"
        @click="$emit('select', '2d')"
      >
        <span class="mode-card-art" aria-hidden="true">
          <img
            class="mode-preview-image"
            src="/assets/art/mode-preview-2d.webp"
            alt=""
          />
        </span>
        <span class="mode-card-copy">
          <small>Original</small>
          <strong>2D Tour</strong>
          <span>The classic side-scrolling ride</span>
        </span>
        <b>Ride in 2D <span aria-hidden="true">→</span></b>
      </button>

      <button
        type="button"
        class="mode-card mode-card-3d"
        @click="$emit('select', '3d')"
      >
        <span class="mode-card-badge">New</span>
        <span class="mode-card-art" aria-hidden="true">
          <img
            class="mode-preview-image"
            src="/assets/art/mode-preview-3d.webp"
            alt=""
          />
        </span>
        <span class="mode-card-copy">
          <small>Immersive</small>
          <strong>3D Tour</strong>
          <span>Chase-camera racing through France</span>
        </span>
        <b>Ride in 3D <span aria-hidden="true">→</span></b>
      </button>
    </div>

    <p class="mode-select-footnote">
      Your progress, workshop, power-ups, and palmarès are shared.
    </p>
  </section>
</template>
