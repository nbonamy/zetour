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

const props = defineProps<{
  snapshot: GameSnapshot;
}>();

type NodeVisibility = "revealed" | "mystery" | "hidden";
type Point = { x: number; y: number };
type ConnectionState = "available" | "acquired" | "mystery" | "locked";

interface GraphConnection {
  id: string;
  branch: Branch;
  from: Point;
  to: Point;
  state: ConnectionState;
}

const selectedId = ref<string | null>(null);
const viewport = ref<HTMLElement | null>(null);
const dragging = ref(false);
const world = { width: 1_460, height: 980 };
const center: Point = { x: 730, y: 480 };
const branchPositions: Record<Branch, Point> = {
  bike: { x: 490, y: 525 },
  rider: { x: 625, y: 320 },
  nutrition: { x: 850, y: 315 },
  equipment: { x: 985, y: 485 },
  team: { x: 785, y: 680 },
};
const nodePositions: Record<string, Point> = {
  "road-bike": { x: 355, y: 505 },
  frame: { x: 235, y: 385 },
  tires: { x: 175, y: 525 },
  shifting: { x: 245, y: 665 },
  wheels: { x: 105, y: 270 },
  brakes: { x: 105, y: 790 },
  "chain-lube": { x: 385, y: 745 },
  endurance: { x: 490, y: 225 },
  power: { x: 610, y: 120 },
  hyperbike: { x: 740, y: 140 },
  technique: { x: 760, y: 250 },
  "body-composition": { x: 355, y: 120 },
  hydration: { x: 980, y: 220 },
  fueling: { x: 1_135, y: 125 },
  "aero-socks": { x: 1_100, y: 350 },
  helmet: { x: 1_225, y: 445 },
  skinsuit: { x: 1_130, y: 555 },
  "gravel-tires": { x: 1_080, y: 690 },
  suspension: { x: 1_245, y: 800 },
  domestique: { x: 670, y: 815 },
  mechanic: { x: 815, y: 855 },
  sponsor: { x: 965, y: 790 },
  "team-director": { x: 590, y: 930 },
};
const branches = Object.keys(branchLabels) as Branch[];
const branchIcons: Record<Branch, string> = {
  bike: "⚙",
  rider: "♥",
  nutrition: "◍",
  equipment: "◒",
  team: "♟",
};

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

const connectionPath = (from: Point, to: Point): string => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const bend = Math.min(92, Math.max(34, Math.hypot(dx, dy) * 0.28));
  if (Math.abs(dx) > Math.abs(dy)) {
    const direction = Math.sign(dx) || 1;
    return `M ${from.x} ${from.y} C ${from.x + direction * bend} ${from.y}, ${to.x - direction * bend} ${to.y}, ${to.x} ${to.y}`;
  }
  const direction = Math.sign(dy) || 1;
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + direction * bend}, ${to.x} ${to.y - direction * bend}, ${to.x} ${to.y}`;
};

const graphConnections = computed<GraphConnection[]>(() => {
  void props.snapshot.stage;
  const branchConnections = branches.map((branch) => {
    const unlocked = gameStore.isBranchUnlocked(branch);
    const hasProgress = upgradesByBranch(branch).some(
      (upgrade) => level(upgrade) > 0,
    );
    return {
      id: `hub:${branch}`,
      branch,
      from: center,
      to: branchPositions[branch],
      state: !unlocked
        ? "locked"
        : hasProgress
          ? "acquired"
          : "available",
    } satisfies GraphConnection;
  });

  const nodeConnections = visibleNodes.value.map((upgrade) => {
    const nodeVisibility = visibility(upgrade);
    const parentPosition = upgrade.requires
      ? nodePositions[upgrade.requires]
      : branchPositions[upgrade.branch];
    return {
      id: `node:${upgrade.id}`,
      branch: upgrade.branch,
      from: parentPosition ?? branchPositions[upgrade.branch],
      to: nodePositions[upgrade.id] ?? center,
      state: !gameStore.isBranchUnlocked(upgrade.branch)
        ? "locked"
        : nodeVisibility === "mystery"
          ? "mystery"
          : level(upgrade) > 0
            ? "acquired"
            : "available",
    } satisfies GraphConnection;
  });

  return [...branchConnections, ...nodeConnections];
});

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
  return ([1, "max"] as const)
    .map((quantity) => ({
      quantity,
      status: gameStore.purchaseStatus(upgrade, quantity),
    }))
    .filter(
      (option) =>
        option.quantity === 1 || option.status.levels > 1,
    );
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
  return currentMilestone.value?.label ?? `Step ${level(selected.value)}`;
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

const nodeProgressPercent = (upgrade: UpgradeDefinition): number =>
  Math.round(
    Math.min(1, Math.max(0, level(upgrade) / upgrade.maxLevel)) * 100,
  );

const formatCost = (upgrade: UpgradeDefinition, cost: number): string =>
  upgrade.currency === "cash"
    ? `$${formatCompactNumber(cost)}`
    : `${formatCompactNumber(cost)} Sweat`;

const purchaseOptionLabel = (quantity: PurchaseQuantity): string =>
  quantity === 1
    ? "Buy next step"
    : "Buy all affordable";

const purchaseOptionDetail = (
  upgrade: UpgradeDefinition,
  option: (typeof purchaseOptions.value)[number],
): string => {
  if (!option.status.available) return option.status.reason ?? "Unavailable";
  const stepLabel = option.status.levels === 1 ? "step" : "steps";
  return `+${option.status.levels} ${stepLabel} · ${formatCost(
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
        }"
      >
        <div class="graph-map-title" aria-hidden="true">
          <strong>Career map</strong>
          <span>Choose your line</span>
        </div>

        <svg
          class="graph-connections"
          :viewBox="`0 0 ${world.width} ${world.height}`"
          aria-hidden="true"
        >
          <path
            v-for="connection in graphConnections"
            :key="connection.id"
            class="graph-connection"
            :class="`edge-${connection.state}`"
            :data-edge="connection.id"
            :data-branch="connection.branch"
            :d="connectionPath(connection.from, connection.to)"
          />
        </svg>

        <div
          class="graph-center"
          :style="{ left: `${center.x}px`, top: `${center.y}px` }"
        >
          <span class="center-emblem">🚲</span>
          <strong>Season {{ snapshot.season }}</strong>
          <small>Career</small>
        </div>

        <div
          v-for="branch in branches"
          :key="branch"
          class="branch-hub"
          :data-branch="branch"
          :class="{ locked: !gameStore.isBranchUnlocked(branch) }"
          :style="{
            left: `${branchPositions[branch].x}px`,
            top: `${branchPositions[branch].y}px`,
          }"
        >
          <span class="hub-icon">
            {{ gameStore.isBranchUnlocked(branch) ? branchIcons[branch] : "×" }}
          </span>
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
          :title="visibility(node) === 'mystery' ? 'Unknown upgrade' : node.name"
          :aria-label="
            visibility(node) === 'mystery' ? 'Unknown upgrade' : node.name
          "
          @pointerenter="activateNode(node)"
          @focus="activateNode(node)"
          @click="activateAndBuyNode(node)"
        >
          <span class="node-main">
            <span class="node-medallion">
              <span class="node-icon">
                {{ visibility(node) === "mystery" ? "?" : node.icon }}
              </span>
            </span>
            <span class="node-label">
              {{ visibility(node) === "mystery" ? "Unknown" : node.name }}
            </span>
            <small
              v-if="
                visibility(node) === 'revealed' &&
                node.id === 'hyperbike' &&
                level(node) === 0
              "
            >
              $2B DREAM
            </small>
          </span>
          <span
            v-if="visibility(node) === 'revealed'"
            class="node-progress"
            :aria-label="`${nodeProgressPercent(node)}% complete — ${level(node)} of ${node.maxLevel} steps`"
            :title="`${level(node)} of ${node.maxLevel} steps complete`"
          >
            <span
              class="node-progress-fill"
              :style="{ width: `${nodeProgressPercent(node)}%` }"
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
              <strong>{{ marker.label }}</strong>
              <small>
                Step {{ marker.level }} ·
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
            <dt>Progress</dt>
            <dd>{{ level(selected) }} of {{ selected.maxLevel }}</dd>
          </div>
          <div v-if="nextMilestone" class="detail-stat detail-next-stat">
            <dt>Next breakthrough</dt>
            <dd>{{ nextMilestone.label }}</dd>
            <dd class="next-level-cost">
              {{ nextMilestone.level - level(selected) }}
              {{ nextMilestone.level - level(selected) === 1 ? "step" : "steps" }}
              away ·
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
          aria-label="Buy upgrade steps"
        >
          <div class="purchase-heading">
            <strong>Install the next step</strong>
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
          Every branch multiplies the others. Equipment follows short, named
          product tiers; training develops through a longer ten-step path.
        </p>
      </template>
    </aside>
  </div>
</template>
