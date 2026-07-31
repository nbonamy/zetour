<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  branchLabels,
  branchUnlockStages,
  type Branch,
  type UpgradeDefinition,
  upgradeById,
  upgradesByBranch,
} from "../core/upgrades";
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
const world = { width: 1_000, height: 700 };
const center = { x: 500, y: 350 };
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
  endurance: hexPosition(-1, -1),
  power: hexPosition(0, -2),
  technique: hexPosition(1, -2),
  "body-composition": hexPosition(-2, -1),
  hydration: hexPosition(2, -2),
  fueling: hexPosition(3, -3),
  "aero-socks": hexPosition(2, 0),
  helmet: hexPosition(2, -1),
  skinsuit: hexPosition(1, 1),
  domestique: hexPosition(0, 2),
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
const selectedStatus = computed(() => {
  const upgrade = selected.value;
  if (!upgrade) return undefined;
  const snapshot = props.snapshot;
  void snapshot.stage;
  void snapshot.sweat;
  void snapshot.cash;
  void snapshot.upgrades[upgrade.id];
  return gameStore.purchaseStatus(upgrade);
});
const nextLevelName = computed(() => {
  if (!selected.value) return "";
  return (
    selected.value.levelNames?.[level(selected.value)] ??
    selected.value.name
  );
});
const installedLevelName = computed(() => {
  if (!selected.value || level(selected.value) === 0) return "None";
  return (
    selected.value.levelNames?.[level(selected.value) - 1] ??
    `Level ${level(selected.value)}`
  );
});

const formatCost = (upgrade: UpgradeDefinition, cost: number): string =>
  upgrade.currency === "cash" ? `$${cost}` : `${cost} Sweat`;

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

const buySelected = (): void => {
  if (selected.value) gameStore.purchase(selected.value);
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
          <strong>Cycling career</strong>
        </div>

        <div
          v-for="branch in branches"
          :key="`${branch}-territory`"
          class="branch-territory"
          :data-branch="branch"
          :aria-label="`${branchLabels[branch]} branch territory`"
        >
          <span>{{ branchLabels[branch] }}</span>
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
          @click="activateNode(node)"
        >
          <span class="node-main">
            <span class="node-icon">
              {{ visibility(node) === "mystery" ? "?" : node.icon }}
            </span>
            <span class="node-label">
              {{ visibility(node) === "mystery" ? "Unknown" : node.name }}
            </span>
          </span>
          <span
            v-if="visibility(node) === 'revealed'"
            class="node-progress"
            :aria-label="`Level ${level(node)} of ${node.maxLevel}`"
          >
            <span v-if="level(node) >= node.maxLevel" class="node-complete-mark">
              ✓
            </span>
            <template v-else>
              <span
                v-for="index in node.maxLevel"
                :key="index"
                class="node-progress-segment"
                :class="{ filled: index <= level(node) }"
              ></span>
            </template>
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
          {{ branchLabels[selected.branch] }} upgrade
        </div>
        <h3>{{ selected.name }}</h3>
        <p>{{ selected.description }}</p>

        <div class="level-track" aria-label="Upgrade level">
          <span
            v-for="index in selected.maxLevel"
            :key="index"
            :class="{ filled: index <= level(selected) }"
          ></span>
        </div>

        <dl>
          <div>
            <dt>Installed</dt>
            <dd>{{ installedLevelName }}</dd>
          </div>
          <div v-if="level(selected) < selected.maxLevel">
            <dt>Next level</dt>
            <dd>{{ nextLevelName }}</dd>
            <dd class="next-level-cost">
              {{ formatCost(selected, selectedStatus?.cost ?? 0) }}
            </dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{{ level(selected) }} / {{ selected.maxLevel }}</dd>
          </div>
        </dl>

        <button
          type="button"
          class="detail-buy"
          :disabled="!selectedStatus?.available"
          @click="buySelected"
        >
          <template v-if="level(selected) >= selected.maxLevel">
            Fully upgraded
          </template>
          <template v-else-if="selectedStatus?.available">
            Upgrade · {{ formatCost(selected, selectedStatus.cost) }}
          </template>
          <template v-else>
            {{ selectedStatus?.reason }}
          </template>
        </button>
      </template>

      <template v-else-if="selectedVisibility === 'mystery'">
        <div class="mystery-detail-icon">?</div>
        <h3>Unknown upgrade</h3>
        <p>Purchase the connected node to reveal this bonus.</p>
      </template>

      <template v-else>
        <div class="detail-kicker">Career progression</div>
        <h3>Select a node</h3>
        <p>
          Explore Rider, Nutrition, Bike, Equipment, and Team from the central
          career node. Unknown bonuses reveal as you purchase their parent.
        </p>
      </template>
    </aside>
  </div>
</template>
