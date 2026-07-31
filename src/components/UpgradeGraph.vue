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
const zoom = ref(0.7);
const world = { width: 1_120, height: 780 };
const grid = { originX: 48, originY: 70, column: 64, row: 64 };
const gridPoint = (column: number, row: number): Point => ({
  x: grid.originX + column * grid.column,
  y: grid.originY + row * grid.row,
});
const center: Point = gridPoint(8, 5);
const branchPositions: Record<Branch, Point> = {
  bike: gridPoint(5, 5),
  rider: gridPoint(7, 2),
  nutrition: gridPoint(9, 2),
  equipment: gridPoint(11, 5),
  team: gridPoint(8, 8),
};
const nodePositions: Record<string, Point> = {
  "road-bike": gridPoint(4, 5),
  frame: gridPoint(3, 4),
  tires: gridPoint(3, 5),
  shifting: gridPoint(3, 6),
  wheels: gridPoint(2, 3),
  brakes: gridPoint(2, 7),
  "chain-lube": gridPoint(4, 7),
  endurance: gridPoint(6, 1),
  power: gridPoint(7, 0),
  hyperbike: gridPoint(8, 0),
  technique: gridPoint(8, 1),
  "body-composition": gridPoint(5, 0),
  hydration: gridPoint(10, 1),
  fueling: gridPoint(11, 0),
  "aero-socks": gridPoint(12, 4),
  helmet: gridPoint(13, 5),
  skinsuit: gridPoint(12, 6),
  "gravel-tires": gridPoint(11, 7),
  suspension: gridPoint(12, 8),
  domestique: gridPoint(7, 9),
  mechanic: gridPoint(8, 10),
  sponsor: gridPoint(9, 9),
  "team-director": gridPoint(6, 10),
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
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
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
const zoomPercent = computed(() => Math.round(zoom.value * 100));

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
  viewport.value.scrollLeft =
    center.x * zoom.value - viewport.value.clientWidth / 2;
  viewport.value.scrollTop =
    center.y * zoom.value - viewport.value.clientHeight / 2;
};

const setZoom = async (
  nextZoom: number,
  anchor?: { clientX: number; clientY: number },
): Promise<void> => {
  const target = viewport.value;
  const previousZoom = zoom.value;
  const clampedZoom = Math.min(1.3, Math.max(0.6, nextZoom));
  if (clampedZoom === previousZoom) return;

  const bounds = target?.getBoundingClientRect();
  const anchorX =
    target && bounds && anchor
      ? anchor.clientX - bounds.left
      : (target?.clientWidth ?? 0) / 2;
  const anchorY =
    target && bounds && anchor
      ? anchor.clientY - bounds.top
      : (target?.clientHeight ?? 0) / 2;
  const focusX = target
    ? (target.scrollLeft + anchorX) / previousZoom
    : center.x;
  const focusY = target
    ? (target.scrollTop + anchorY) / previousZoom
    : center.y;
  zoom.value = clampedZoom;
  await nextTick();
  if (!target) return;
  target.scrollLeft = focusX * clampedZoom - anchorX;
  target.scrollTop = focusY * clampedZoom - anchorY;
};

const zoomOut = (): Promise<void> =>
  setZoom(Number((zoom.value - 0.1).toFixed(1)));
const zoomIn = (): Promise<void> =>
  setZoom(Number((zoom.value + 0.1).toFixed(1)));
const zoomWithWheel = (event: WheelEvent): void => {
  if (event.deltaY === 0) return;
  const direction = event.deltaY > 0 ? -0.1 : 0.1;
  void setZoom(Number((zoom.value + direction).toFixed(1)), {
    clientX: event.clientX,
    clientY: event.clientY,
  });
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
    <div class="graph-pane">
      <div
        ref="viewport"
        class="graph-viewport"
        :class="{ dragging }"
        @pointerdown="startPan"
        @pointermove="pan"
        @pointerup="stopPan"
        @pointercancel="stopPan"
        @wheel.prevent="zoomWithWheel"
      >
        <div
          class="graph-stage"
          :style="{
            width: `${world.width * zoom}px`,
            height: `${world.height * zoom}px`,
          }"
        >
          <div
            class="graph-map"
            :style="{
              width: `${world.width}px`,
              height: `${world.height}px`,
              transform: `scale(${zoom})`,
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
        </div>
      </div>

      <div class="graph-help">
        <span>Drag or scroll</span>
        <span class="graph-zoom" aria-label="Map zoom">
          <button type="button" aria-label="Zoom out" @click.stop="zoomOut">
            −
          </button>
          <output>{{ zoomPercent }}%</output>
          <button type="button" aria-label="Zoom in" @click.stop="zoomIn">
            +
          </button>
        </span>
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
