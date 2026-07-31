<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  branchLabels,
  branchUnlockStages,
  type Branch,
  type PurchaseQuantity,
  type UpgradeDefinition,
  nextUpgradeMilestone,
  reachedMilestones,
  upgradeById,
  upgradeEffectMultiplier,
  upgradeMilestoneMultiplier,
  upgradesByBranch,
} from "../core/upgrades";
import { formatCompactNumber, formatMultiplier } from "../core/format";
import { gameStore, type GameSnapshot } from "../core/gameStore";
import {
  axialHexPosition,
  regularFlatTopHexHeight,
} from "../core/hexGrid";

const props = defineProps<{
  snapshot: GameSnapshot;
}>();

type NodeVisibility = "revealed" | "mystery" | "hidden";

const selectedId = ref<string | null>(null);
const viewport = ref<HTMLElement | null>(null);
const dragging = ref(false);
const world = { width: 1_200, height: 820 };
const center = { x: 600, y: 410 };
const HEX_WIDTH = 108;
const HEX_HEIGHT = regularFlatTopHexHeight(HEX_WIDTH);
const HEX_GAP = 4;
const hexPosition = (q: number, r: number) =>
  axialHexPosition(
    center,
    { q, r },
    { x: HEX_WIDTH + HEX_GAP, y: HEX_HEIGHT + HEX_GAP },
  );
const branchPositions: Record<Branch, { x: number; y: number }> = {
  bike: hexPosition(-1, 1),
  rider: hexPosition(0, -1),
  nutrition: hexPosition(1, -1),
  equipment: hexPosition(1, 0),
  team: hexPosition(0, 1),
};
const nodePositions: Record<string, { x: number; y: number }> = {
  "road-bike": hexPosition(-2, 1),
  frame: hexPosition(-3, 1),
  tires: hexPosition(-2, 0),
  shifting: hexPosition(-3, 2),
  wheels: hexPosition(-4, 1),
  brakes: hexPosition(-4, 3),
  "chain-lube": hexPosition(-2, 2),
  endurance: hexPosition(-1, -1),
  power: hexPosition(0, -2),
  hyperbike: hexPosition(-2, 0),
  technique: hexPosition(1, -2),
  "body-composition": hexPosition(-2, -1),
  hydration: hexPosition(2, -2),
  fueling: hexPosition(3, -3),
  "aero-socks": hexPosition(2, 0),
  helmet: hexPosition(2, -1),
  skinsuit: hexPosition(1, 1),
  "gravel-tires": hexPosition(3, 0),
  suspension: hexPosition(3, 1),
  domestique: hexPosition(0, 2),
  mechanic: hexPosition(-1, 2),
  sponsor: hexPosition(1, 2),
  "team-director": hexPosition(0, 3),
};
const branches = Object.keys(branchLabels) as Branch[];

const level = (upgrade: UpgradeDefinition): number =>
  props.snapshot.upgrades[upgrade.id] ?? 0;

const visibility = (upgrade: UpgradeDefinition): NodeVisibility => {
  if (!upgrade.requires) return "revealed";
  const parent = upgradeById(upgrade.requires);
  if (!parent) return "hidden";
  if (level(parent) > 0) return "revealed";
  return visibility(parent) === "revealed" ? "mystery" : "hidden";
};

const visibleNodes = computed(() =>
  branches.flatMap((branch) =>
    upgradesByBranch(branch).filter(
      (upgrade) => visibility(upgrade) !== "hidden",
    ),
  ),
);

const selected = computed(() =>
  selectedId.value ? upgradeById(selectedId.value) : undefined,
);
const selectedVisibility = computed<NodeVisibility>(() =>
  selected.value ? visibility(selected.value) : "hidden",
);
const purchaseOptions = computed(() => {
  const upgrade = selected.value;
  if (!upgrade || level(upgrade) >= upgrade.maxLevel) return [];
  const snapshot = props.snapshot;
  void snapshot.stage;
  void snapshot.sweat;
  void snapshot.cash;
  void snapshot.upgrades[upgrade.id];
  return ([1, 10, "max"] as const).map((quantity) => ({
    quantity,
    status: gameStore.purchaseStatus(upgrade, quantity),
  }));
});
const currentMilestone = computed(() => {
  if (!selected.value) return undefined;
  return reachedMilestones(selected.value, level(selected.value)).at(-1);
});
const currentMilestoneMultiplier = computed(() =>
  selected.value
    ? upgradeMilestoneMultiplier(selected.value, level(selected.value))
    : 1,
);
const nextMilestone = computed(() =>
  selected.value
    ? nextUpgradeMilestone(selected.value, level(selected.value))
    : undefined,
);
const installedLevelName = computed(() => {
  if (!selected.value || level(selected.value) === 0) return "Not started";
  return currentMilestone.value?.label ?? `Level ${level(selected.value)}`;
});
const effectSummary = computed(() => {
  const upgrade = selected.value;
  if (!upgrade) return "";
  const currentLevel = level(upgrade);
  const summaryLevel =
    upgrade.id === "hyperbike" && currentLevel === 0 ? 1 : currentLevel;
  const effects = [
    upgrade.effects.pacePerLevel
      ? `Pace ${formatMultiplier(
          upgradeEffectMultiplier(upgrade, summaryLevel, "pacePerLevel"),
        )}`
      : "",
    upgrade.effects.sweatPerLevel
      ? `Sweat ${formatMultiplier(
          upgradeEffectMultiplier(upgrade, summaryLevel, "sweatPerLevel"),
        )}`
      : "",
    upgrade.effects.cashPerLevel
      ? `Cash ${formatMultiplier(
          upgradeEffectMultiplier(upgrade, summaryLevel, "cashPerLevel"),
        )}`
      : "",
  ].filter(Boolean);
  return effects.join(" · ") || "Handling and reliability";
});

const nodeMarkers = (upgrade: UpgradeDefinition) =>
  upgrade.milestones?.length
    ? upgrade.milestones
    : [{ level: upgrade.maxLevel, multiplier: 1, label: "Installed" }];

const formatCost = (upgrade: UpgradeDefinition, cost: number): string =>
  upgrade.currency === "cash"
    ? `$${formatCompactNumber(cost)}`
    : `${formatCompactNumber(cost)} Sweat`;

const purchaseOptionLabel = (quantity: PurchaseQuantity): string =>
  quantity === 1
    ? "Buy 1 level"
    : quantity === 10
      ? "Buy up to 10"
      : "Buy max";

const purchaseOptionDetail = (
  upgrade: UpgradeDefinition,
  option: (typeof purchaseOptions.value)[number],
): string => {
  if (!option.status.available) return option.status.reason ?? "Unavailable";
  const levelLabel = option.status.levels === 1 ? "level" : "levels";
  return `+${option.status.levels} ${levelLabel} · ${formatCost(
    upgrade,
    option.status.cost,
  )}`;
};

watch(
  () => props.snapshot.upgrades,
  () => {
    if (
      selectedId.value &&
      !visibleNodes.value.some((node) => node.id === selectedId.value)
    ) {
      selectedId.value = null;
    }
  },
);

const activateNode = (upgrade: UpgradeDefinition): void => {
  selectedId.value = upgrade.id;
};

const activateAndBuyNode = (upgrade: UpgradeDefinition): void => {
  activateNode(upgrade);
  if (
    visibility(upgrade) === "revealed" &&
    gameStore.isBranchUnlocked(upgrade.branch)
  ) {
    gameStore.purchase(upgrade, 1);
  }
};

const buySelected = (quantity: PurchaseQuantity): void => {
  if (selected.value) {
    gameStore.purchase(selected.value, quantity);
  }
};

const centerViewport = async (): Promise<void> => {
  await nextTick();
  if (!viewport.value) return;
  viewport.value.scrollLeft = center.x - viewport.value.clientWidth / 2;
  viewport.value.scrollTop = center.y - viewport.value.clientHeight / 2;
};

let dragOrigin:
  | { pointerX: number; pointerY: number; scrollX: number; scrollY: number }
  | undefined;

const startPan = (event: PointerEvent): void => {
  if ((event.target as Element).closest("button")) return;
  const target = viewport.value;
  if (!target) return;
  dragging.value = true;
  dragOrigin = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    scrollX: target.scrollLeft,
    scrollY: target.scrollTop,
  };
  target.setPointerCapture(event.pointerId);
};

const pan = (event: PointerEvent): void => {
  if (!dragging.value || !dragOrigin || !viewport.value) return;
  viewport.value.scrollLeft =
    dragOrigin.scrollX - (event.clientX - dragOrigin.pointerX);
  viewport.value.scrollTop =
    dragOrigin.scrollY - (event.clientY - dragOrigin.pointerY);
};

const stopPan = (event: PointerEvent): void => {
  if (!viewport.value || !dragging.value) return;
  dragging.value = false;
  dragOrigin = undefined;
  if (viewport.value.hasPointerCapture(event.pointerId)) {
    viewport.value.releasePointerCapture(event.pointerId);
  }
};

onMounted(centerViewport);
</script>

<template>
  <div class="upgrade-graph">
    <div
      ref="viewport"
      class="graph-viewport"
      :class="{ dragging }"
      @pointerdown="startPan"
      @pointermove="pan"
      @pointerup="stopPan"
      @pointercancel="stopPan"
    >
      <div
        class="graph-map"
        :style="{
          width: `${world.width}px`,
          height: `${world.height}px`,
          '--hex-width': `${HEX_WIDTH}px`,
          '--hex-height': `${HEX_HEIGHT}px`,
        }"
      >
        <div
          class="graph-center"
          :style="{ left: `${center.x}px`, top: `${center.y}px` }"
        >
          <span>◆</span>
          <strong>Season {{ snapshot.season }}</strong>
        </div>

        <div
          v-for="branch in branches"
          :key="branch"
          class="branch-hub hex-branch"
          :data-branch="branch"
          :class="{ locked: !gameStore.isBranchUnlocked(branch) }"
          :style="{
            left: `${branchPositions[branch].x}px`,
            top: `${branchPositions[branch].y}px`,
          }"
        >
          <span>{{ gameStore.isBranchUnlocked(branch) ? "◆" : "🔒" }}</span>
          <strong>{{ branchLabels[branch] }}</strong>
          <small v-if="!gameStore.isBranchUnlocked(branch)">
            Sector {{ branchUnlockStages[branch] }}
          </small>
        </div>

        <button
          v-for="node in visibleNodes"
          :key="node.id"
          type="button"
          class="tree-node"
          :data-branch="node.branch"
          :class="[
            `node-${visibility(node)}`,
            {
              selected: selectedId === node.id,
              acquired: level(node) > 0,
              complete: level(node) >= node.maxLevel,
              locked: !gameStore.isBranchUnlocked(node.branch),
            },
          ]"
          :style="{
            left: `${nodePositions[node.id]?.x ?? center.x}px`,
            top: `${nodePositions[node.id]?.y ?? center.y}px`,
          }"
          :disabled="!gameStore.isBranchUnlocked(node.branch)"
          :aria-label="
            visibility(node) === 'mystery' ? 'Unknown upgrade' : node.name
          "
          @pointerenter="activateNode(node)"
          @focus="activateNode(node)"
          @click="activateAndBuyNode(node)"
        >
          <span class="node-main">
            <span class="node-icon">
              {{ visibility(node) === "mystery" ? "?" : node.icon }}
            </span>
            <span class="node-label">
              {{ visibility(node) === "mystery" ? "Unknown" : node.name }}
            </span>
            <small v-if="visibility(node) === 'revealed'">
              <template v-if="node.id === 'hyperbike' && level(node) === 0">
                $2B DREAM
              </template>
              <template v-else>Lv {{ level(node) }}</template>
            </small>
          </span>
          <span
            v-if="visibility(node) === 'revealed'"
            class="node-progress"
            :aria-label="`Level ${level(node)} of ${node.maxLevel}`"
          >
            <span
              v-for="marker in nodeMarkers(node)"
              :key="marker.level"
              class="node-progress-segment"
              :class="{ filled: marker.level <= level(node) }"
              :title="`${marker.label} at Level ${marker.level}`"
            ></span>
          </span>
        </button>
      </div>

      <div class="graph-help">
        Drag or scroll to explore
        <button type="button" @click="centerViewport">Center</button>
      </div>
    </div>

    <aside class="node-detail">
      <template v-if="selected && selectedVisibility === 'revealed'">
        <div class="detail-kicker">
          <span>{{ selected.icon }}</span>
          {{ branchLabels[selected.branch] }} · {{ effectSummary }}
        </div>
        <h3>{{ selected.name }}</h3>
        <p>{{ selected.description }}</p>

        <div class="detail-milestones">
          <div class="milestone-heading">
            <strong>Compounding breakthroughs</strong>
            <small>Every bonus multiplies the last</small>
          </div>

          <div class="milestone-track" aria-label="Upgrade milestones">
            <span
              v-for="marker in nodeMarkers(selected)"
              :key="marker.level"
              :class="{ filled: marker.level <= level(selected) }"
            >
              <strong>Lv {{ marker.level }}</strong>
              <small>
                {{
                  formatMultiplier(
                    upgradeMilestoneMultiplier(selected, marker.level),
                  )
                }}
              </small>
            </span>
          </div>
        </div>

        <dl class="detail-stats">
          <div class="detail-stat">
            <dt>Installed</dt>
            <dd>{{ installedLevelName }}</dd>
            <dd v-if="currentMilestone" class="current-level-total">
              {{ formatMultiplier(currentMilestoneMultiplier) }} total
            </dd>
          </div>
          <div class="detail-stat detail-level-stat">
            <dt>Level</dt>
            <dd>{{ level(selected) }} / {{ selected.maxLevel }}</dd>
          </div>
          <div v-if="nextMilestone" class="detail-stat detail-next-stat">
            <dt>Next breakthrough</dt>
            <dd>{{ nextMilestone.label }}</dd>
            <dd class="next-level-cost">
              {{ nextMilestone.level - level(selected) }} levels away ·
              {{
                formatMultiplier(
                  upgradeMilestoneMultiplier(selected, nextMilestone.level),
                )
              }}
              total
            </dd>
          </div>
        </dl>

        <section
          v-if="purchaseOptions.length"
          class="detail-purchase"
          aria-label="Buy upgrade levels"
        >
          <div class="purchase-heading">
            <strong>Buy levels now</strong>
            <small>Each button purchases immediately</small>
          </div>
          <div class="purchase-options">
            <button
              v-for="option in purchaseOptions"
              :key="option.quantity"
              type="button"
              class="purchase-option"
              :data-quantity="option.quantity"
              :disabled="!option.status.available"
              :aria-label="`${purchaseOptionLabel(option.quantity)} of ${selected.name}`"
              @click="buySelected(option.quantity)"
            >
              <strong>{{ purchaseOptionLabel(option.quantity) }}</strong>
              <small>{{ purchaseOptionDetail(selected, option) }}</small>
            </button>
          </div>
        </section>

        <div
          v-else
          class="purchase-complete"
          role="status"
        >
          <span>✓</span>
          <strong>Fully upgraded</strong>
        </div>
      </template>

      <template v-else-if="selectedVisibility === 'mystery'">
        <div class="mystery-detail-icon">?</div>
        <h3>Unknown upgrade</h3>
        <p>Purchase the connected node to reveal this bonus.</p>
      </template>

      <template v-else>
        <div class="detail-kicker">Compounding career</div>
        <h3>Select a node</h3>
        <p>
          Every branch multiplies the others. Push nodes to Levels 10, 25, 50,
          and 100 for the breakthroughs that turn a bicycle into an economic
          incident.
        </p>
      </template>
    </aside>
  </div>
</template>
