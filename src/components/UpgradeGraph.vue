<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  branchLabels,
  type Branch,
  type UpgradeDefinition,
  upgradeById,
  upgradesByBranch,
} from "../core/upgrades";
import { gameStore, type GameSnapshot } from "../core/gameStore";

const props = defineProps<{
  snapshot: GameSnapshot;
}>();

type NodeVisibility = "revealed" | "mystery" | "hidden";

const selectedId = ref<string | null>(null);
const viewport = ref<HTMLElement | null>(null);
const dragging = ref(false);
const world = { width: 2_200, height: 1_500 };
const center = { x: 1_100, y: 750 };
const branchPositions: Record<Branch, { x: number; y: number }> = {
  bike: { x: 820, y: 590 },
  rider: { x: 1_380, y: 590 },
  equipment: { x: 1_380, y: 910 },
  team: { x: 820, y: 910 },
};
const nodePositions: Record<string, { x: number; y: number }> = {
  "road-bike": { x: 820, y: 420 },
  frame: { x: 590, y: 250 },
  tires: { x: 820, y: 190 },
  shifting: { x: 1_030, y: 250 },
  wheels: { x: 510, y: 450 },
  brakes: { x: 1_080, y: 430 },
  endurance: { x: 1_200, y: 350 },
  power: { x: 1_400, y: 210 },
  technique: { x: 1_620, y: 350 },
  "aero-socks": { x: 1_200, y: 1_150 },
  helmet: { x: 1_400, y: 1_290 },
  skinsuit: { x: 1_620, y: 1_150 },
  domestique: { x: 820, y: 1_150 },
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
const selectedStatus = computed(() =>
  selected.value ? gameStore.purchaseStatus(selected.value) : undefined,
);
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

const buyNode = (upgrade: UpgradeDefinition): void => {
  activateNode(upgrade);
  if (visibility(upgrade) === "revealed") {
    gameStore.purchase(upgrade);
  }
};

const buySelected = (): void => {
  if (selected.value) gameStore.purchase(selected.value);
};

const parentPosition = (upgrade: UpgradeDefinition) => {
  if (!upgrade.requires) return branchPositions[upgrade.branch];
  return nodePositions[upgrade.requires] ?? branchPositions[upgrade.branch];
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
        :style="{ width: `${world.width}px`, height: `${world.height}px` }"
      >
        <svg
          class="graph-connections"
          :viewBox="`0 0 ${world.width} ${world.height}`"
          :width="world.width"
          :height="world.height"
          aria-hidden="true"
        >
          <line
            v-for="branch in branches"
            :key="`branch-${branch}`"
            :x1="center.x"
            :y1="center.y"
            :x2="branchPositions[branch].x"
            :y2="branchPositions[branch].y"
            :class="{ acquired: gameStore.isBranchUnlocked(branch) }"
          />
          <line
            v-for="node in visibleNodes"
            :key="`edge-${node.id}`"
            :x1="parentPosition(node).x"
            :y1="parentPosition(node).y"
            :x2="nodePositions[node.id]?.x ?? center.x"
            :y2="nodePositions[node.id]?.y ?? center.y"
            :class="{
              acquired: level(node) > 0,
              unknown: visibility(node) === 'mystery',
            }"
          />
        </svg>

        <div
          class="graph-center"
          :style="{ left: `${center.x}px`, top: `${center.y}px` }"
        >
          <span>◆</span>
          <strong>Cycling career</strong>
        </div>

        <div
          v-for="branch in branches"
          :key="branch"
          class="branch-hub"
          :class="{ locked: !gameStore.isBranchUnlocked(branch) }"
          :style="{
            left: `${branchPositions[branch].x}px`,
            top: `${branchPositions[branch].y}px`,
          }"
        >
          <span>{{ gameStore.isBranchUnlocked(branch) ? "◆" : "🔒" }}</span>
          <strong>{{ branchLabels[branch] }}</strong>
          <small v-if="!gameStore.isBranchUnlocked(branch)">Stage 3</small>
        </div>

        <button
          v-for="node in visibleNodes"
          :key="node.id"
          type="button"
          class="tree-node"
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
          @click="buyNode(node)"
        >
          <span class="node-icon">
            {{ visibility(node) === "mystery" ? "?" : node.icon }}
          </span>
          <span v-if="visibility(node) === 'revealed'" class="node-level">
            {{ level(node) }}/{{ node.maxLevel }}
          </span>
          <span class="node-label">
            {{ visibility(node) === "mystery" ? "Unknown" : node.name }}
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
            Upgrade ·
            {{ selected.currency === "cash" ? "€" : ""
            }}{{ selectedStatus.cost
            }}{{ selected.currency === "sweat" ? " Sweat" : "" }}
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
          Explore Bike, Rider, Equipment, and Team from the central career
          node. Unknown bonuses reveal as you purchase their parent.
        </p>
      </template>
    </aside>
  </div>
</template>
