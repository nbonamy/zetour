<script setup lang="ts">
import { computed } from "vue";
import { gameAudio } from "../audio/gameAudio";
import { formatCompactNumber, formatMultiplier } from "../core/format";
import {
  gameStore,
  type GameSnapshot,
} from "../core/gameStore";
import {
  palmaresUpgradeCost,
  palmaresUpgrades,
} from "../core/palmares";

const props = defineProps<{
  snapshot: GameSnapshot;
}>();

const unlocked = computed(
  () => props.snapshot.totalPalmares > 0 || props.snapshot.raceFinished,
);

const buy = (id: (typeof palmaresUpgrades)[number]["id"]): void => {
  if (gameStore.purchasePalmares(id)) {
    gameAudio.playEffect("upgrade-purchase");
  }
};

const toggleAutomation = (): void => {
  gameStore.setAutomationEnabled(!props.snapshot.automationEnabled);
};
</script>

<template>
  <section class="palmares-panel">
    <header class="palmares-hero">
      <div class="palmares-medallion" aria-hidden="true">★</div>
      <div>
        <p class="eyebrow">Permanent career</p>
        <h3>Palmarès</h3>
        <p>
          Every completed Season compresses the roads you have mastered. These
          upgrades survive every reset.
        </p>
      </div>
      <div class="palmares-balance">
        <small>Available</small>
        <strong>{{ formatCompactNumber(snapshot.palmares) }}</strong>
        <span>
          {{ formatCompactNumber(snapshot.totalPalmares) }} earned forever
        </span>
      </div>
    </header>

    <div v-if="!unlocked" class="palmares-locked">
      <span aria-hidden="true">♜</span>
      <h4>Finish Alpe d'Huez to write history</h4>
      <p>
        Your first Tour awards Palmarès. Starting the next Season immediately
        doubles production before you buy a single permanent upgrade.
      </p>
    </div>

    <template v-else>
      <div class="palmares-summary">
        <span>
          <small>Season</small>
          <strong>{{ snapshot.season }}</strong>
        </span>
        <span>
          <small>Permanent pace</small>
          <strong>{{ formatMultiplier(snapshot.stats.palmaresMultiplier) }}</strong>
        </span>
        <span>
          <small>Tours completed</small>
          <strong>{{ formatCompactNumber(snapshot.toursCompleted) }}</strong>
        </span>
        <span>
          <small>Lifetime distance</small>
          <strong>{{ formatCompactNumber(snapshot.lifetimeDistanceKm) }} km</strong>
        </span>
      </div>

      <div class="palmares-grid">
        <article
          v-for="upgrade in palmaresUpgrades"
          :key="upgrade.id"
          class="palmares-card"
          :class="{
            complete:
              (snapshot.palmaresUpgrades[upgrade.id] ?? 0) >= upgrade.maxLevel,
          }"
        >
          <span class="palmares-card-icon" aria-hidden="true">
            {{ upgrade.icon }}
          </span>
          <div>
            <small>
              Level {{ snapshot.palmaresUpgrades[upgrade.id] ?? 0 }} /
              {{ upgrade.maxLevel }}
            </small>
            <h4>{{ upgrade.name }}</h4>
            <p>{{ upgrade.description }}</p>
          </div>
          <button
            type="button"
            :disabled="!gameStore.palmaresPurchaseStatus(upgrade.id).available"
            @click="buy(upgrade.id)"
          >
            <template
              v-if="
                (snapshot.palmaresUpgrades[upgrade.id] ?? 0) >= upgrade.maxLevel
              "
            >
              Complete
            </template>
            <template v-else>
              ★
              {{
                formatCompactNumber(
                  palmaresUpgradeCost(
                    upgrade,
                    snapshot.palmaresUpgrades[upgrade.id] ?? 0,
                  ),
                )
              }}
            </template>
          </button>
        </article>
      </div>

      <div
        v-if="snapshot.stats.automationUnlocked"
        class="automation-switch"
      >
        <div>
          <strong>Directeur auto-buy</strong>
          <small>
            Buys the cheapest available run upgrade. Switch it off whenever
            you want to steer the build yourself.
          </small>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="snapshot.automationEnabled"
          :class="{ active: snapshot.automationEnabled }"
          @click="toggleAutomation"
        >
          {{ snapshot.automationEnabled ? "ON" : "OFF" }}
        </button>
      </div>
    </template>
  </section>
</template>
