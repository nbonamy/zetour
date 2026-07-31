<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  branchLabels,
  branchUnlockLevels,
  type Branch,
  type PurchaseQuantity,
  type UpgradeDefinition,
  nextUpgradeMilestone,
  upgradeById,
  upgradeEffectMultiplier,
  upgradeGainTotal,
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
const hoveredId = ref<string | null>(null);
const viewport = ref<HTMLElement | null>(null);
const dragging = ref(false);
const zoom = ref(0.7);
const minZoom = 0.6;
const maxZoom = 1.3;
const world = { width: 1_120, height: 780 };
const center: Point = { x: 560, y: 390 };
const virtualCanvasPadding = 640;
const virtualCanvas = {
  width: Math.ceil(world.width * maxZoom + virtualCanvasPadding * 2),
  height: Math.ceil(world.height * maxZoom + virtualCanvasPadding * 2),
};
const canvasCenter: Point = {
  x: virtualCanvas.width / 2,
  y: virtualCanvas.height / 2,
};
const mapOrigin: Point = {
  x: canvasCenter.x - center.x,
  y: canvasCenter.y - center.y,
};
const branchRadius = 200;
const branchStep = 68;
const branchAngles: Record<Branch, number> = {
  rider: -126,
  nutrition: -54,
  equipment: 18,
  team: 90,
  bike: 162,
};
const branchPoint = (
  branch: Branch,
  radialStep = 0,
  lane = 0,
): Point => {
  const angle = (branchAngles[branch] * Math.PI) / 180;
  const radialDistance = branchRadius + radialStep * branchStep;
  const tangentDistance = lane * branchStep;
  return {
    x: Math.round(
      center.x +
        Math.cos(angle) * radialDistance -
        Math.sin(angle) * tangentDistance,
    ),
    y: Math.round(
      center.y +
        Math.sin(angle) * radialDistance +
        Math.cos(angle) * tangentDistance,
    ),
  };
};
const branchPositions: Record<Branch, Point> = {
  bike: branchPoint("bike"),
  rider: branchPoint("rider"),
  nutrition: branchPoint("nutrition"),
  equipment: branchPoint("equipment"),
  team: branchPoint("team"),
};
const nodePositions: Record<string, Point> = {
  "road-bike": branchPoint("bike", 1),
  frame: branchPoint("bike", 2, 1.5),
  tires: branchPoint("bike", 2, 0.5),
  shifting: branchPoint("bike", 2, -0.5),
  wheels: branchPoint("bike", 3, 1.5),
  brakes: branchPoint("bike", 3, -0.5),
  "chain-lube": branchPoint("bike", 2, -1.5),
  endurance: branchPoint("rider", 1, -1.5),
  power: branchPoint("rider", 1, -0.5),
  hyperbike: branchPoint("rider", 1, 0.5),
  technique: branchPoint("rider", 1, 1.5),
  "body-composition": branchPoint("rider", 2, -1.5),
  hydration: branchPoint("nutrition", 1),
  fueling: branchPoint("nutrition", 2),
  "aero-socks": branchPoint("equipment", 1, -1.5),
  helmet: branchPoint("equipment", 1, -0.5),
  skinsuit: branchPoint("equipment", 1, 0.5),
  "gravel-tires": branchPoint("equipment", 1, 1.5),
  suspension: branchPoint("equipment", 2, 1.5),
  domestique: branchPoint("team", 1, -1),
  mechanic: branchPoint("team", 1),
  sponsor: branchPoint("team", 1, 1),
  "team-director": branchPoint("team", 2, -1),
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

const nodePurchaseStatus = (upgrade: UpgradeDefinition) =>
  gameStore.purchaseStatus(upgrade, 1);

const nodePurchaseState = (upgrade: UpgradeDefinition) =>
  visibility(upgrade) === "revealed"
    ? nodePurchaseStatus(upgrade).state
    : "mystery";

const isNodeUnaffordable = (upgrade: UpgradeDefinition): boolean =>
  nodePurchaseState(upgrade) === "unaffordable";

const connectionPath = (from: Point, to: Point): string => {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
};

const graphConnections = computed<GraphConnection[]>(() => {
  void props.snapshot.riderProgress.level;
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
const nextMilestone = computed(() =>
  selected.value
    ? nextUpgradeMilestone(selected.value, level(selected.value))
    : undefined,
);
const installedLevelName = computed(() => {
  if (!selected.value || level(selected.value) === 0) return "Not started";
  return (
    selected.value.tiers[level(selected.value) - 1]?.name ??
    `Step ${level(selected.value)}`
  );
});
const effectSummary = computed(() => {
  const upgrade = selected.value;
  if (!upgrade) return "";
  const currentLevel = level(upgrade);
  const summaryLevel = Math.max(1, currentLevel);
  const speedGain = upgradeGainTotal(upgrade, summaryLevel, "flatSpeed");
  const effects = [
    speedGain > 0 ? `Flat speed +${speedGain.toFixed(1)} km/h` : "",
    upgradeGainTotal(upgrade, summaryLevel, "output") > 0
      ? `Output ${formatMultiplier(
          upgradeEffectMultiplier(upgrade, summaryLevel, "outputPerLevel"),
        )}`
      : "",
    upgradeGainTotal(upgrade, summaryLevel, "sweat") > 0
      ? `Sweat ${formatMultiplier(
          upgradeEffectMultiplier(upgrade, summaryLevel, "sweatPerLevel"),
        )}`
      : "",
    upgradeGainTotal(upgrade, summaryLevel, "cash") > 0
      ? `Cash ${formatMultiplier(
          upgradeEffectMultiplier(upgrade, summaryLevel, "cashPerLevel"),
        )}`
      : "",
  ].filter(Boolean);
  return effects.join(" · ") || "No performance gain";
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

const previewNode = (upgrade: UpgradeDefinition): void => {
  hoveredId.value = upgrade.id;
  activateNode(upgrade);
};

const hideNodeTooltip = (upgrade: UpgradeDefinition): void => {
  if (hoveredId.value === upgrade.id) hoveredId.value = null;
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
    canvasCenter.x - viewport.value.clientWidth / 2;
  viewport.value.scrollTop =
    canvasCenter.y - viewport.value.clientHeight / 2;
};

const setZoom = async (
  nextZoom: number,
  anchor?: { clientX: number; clientY: number },
): Promise<void> => {
  const target = viewport.value;
  const previousZoom = zoom.value;
  const clampedZoom = Math.min(maxZoom, Math.max(minZoom, nextZoom));
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
    ? center.x +
      (target.scrollLeft + anchorX - canvasCenter.x) / previousZoom
    : center.x;
  const focusY = target
    ? center.y +
      (target.scrollTop + anchorY - canvasCenter.y) / previousZoom
    : center.y;
  zoom.value = clampedZoom;
  await nextTick();
  if (!target) return;
  target.scrollLeft =
    canvasCenter.x + (focusX - center.x) * clampedZoom - anchorX;
  target.scrollTop =
    canvasCenter.y + (focusY - center.y) * clampedZoom - anchorY;
};

let wheelZoomTarget = zoom.value;
let wheelZoomFrame: number | undefined;
let wheelZoomGeneration = 0;
let wheelZoomAnchor: { clientX: number; clientY: number } | undefined;

const stopWheelZoom = (): void => {
  wheelZoomGeneration += 1;
  if (wheelZoomFrame !== undefined) {
    cancelAnimationFrame(wheelZoomFrame);
  }
  wheelZoomFrame = undefined;
  wheelZoomTarget = zoom.value;
};

const animateWheelZoom = async (generation: number): Promise<void> => {
  if (generation !== wheelZoomGeneration) return;
  const difference = wheelZoomTarget - zoom.value;
  if (Math.abs(difference) < 0.0002) {
    await setZoom(wheelZoomTarget, wheelZoomAnchor);
    if (generation === wheelZoomGeneration) wheelZoomFrame = undefined;
    return;
  }

  await setZoom(zoom.value + difference * 0.32, wheelZoomAnchor);
  if (generation !== wheelZoomGeneration) return;
  wheelZoomFrame = requestAnimationFrame(() => {
    void animateWheelZoom(generation);
  });
};

const zoomOut = (): Promise<void> => {
  stopWheelZoom();
  return setZoom(Number((zoom.value - 0.1).toFixed(1)));
};
const zoomIn = (): Promise<void> => {
  stopWheelZoom();
  return setZoom(Number((zoom.value + 0.1).toFixed(1)));
};
const zoomWithWheel = (event: WheelEvent): void => {
  if (event.deltaY === 0) return;
  const deltaMultiplier = event.deltaMode === 1
    ? 16
    : event.deltaMode === 2
      ? viewport.value?.clientHeight || 800
      : 1;
  const boundedDelta = Math.max(
    -120,
    Math.min(120, event.deltaY * deltaMultiplier),
  );
  const startingZoom = wheelZoomFrame === undefined
    ? zoom.value
    : wheelZoomTarget;
  wheelZoomTarget = Math.min(
    maxZoom,
    Math.max(minZoom, startingZoom * Math.exp(-boundedDelta * 0.00025)),
  );
  wheelZoomAnchor = {
    clientX: event.clientX,
    clientY: event.clientY,
  };

  if (wheelZoomFrame === undefined) {
    const generation = ++wheelZoomGeneration;
    wheelZoomFrame = requestAnimationFrame(() => {
      void animateWheelZoom(generation);
    });
  }
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
onBeforeUnmount(stopWheelZoom);
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
            width: `${virtualCanvas.width}px`,
            height: `${virtualCanvas.height}px`,
          }"
        >
          <div
            class="graph-map"
            :style="{
              width: `${world.width}px`,
              height: `${world.height}px`,
              left: `${mapOrigin.x}px`,
              top: `${mapOrigin.y}px`,
              transform: `scale(${zoom})`,
            }"
          >
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
            :data-angle="branchAngles[branch]"
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
              Level {{ branchUnlockLevels[branch] }}
            </small>
          </div>

            <button
              v-for="node in visibleNodes"
              :key="node.id"
              type="button"
              class="tree-node"
              :data-branch="node.branch"
              :data-purchase-state="nodePurchaseState(node)"
              :class="[
                `node-${visibility(node)}`,
                {
                  selected: selectedId === node.id,
                  'tooltip-visible': hoveredId === node.id,
                  acquired: level(node) > 0,
                  complete: level(node) >= node.maxLevel,
                  locked: !gameStore.isBranchUnlocked(node.branch),
                  purchasable: nodePurchaseState(node) === 'purchasable',
                  unaffordable: isNodeUnaffordable(node),
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
              @pointerenter="previewNode(node)"
              @pointerleave="hideNodeTooltip(node)"
              @focus="activateNode(node)"
              @click="activateAndBuyNode(node)"
            >
              <span class="node-main">
                <span class="node-medallion">
                  <span class="node-icon">
                    {{ visibility(node) === "mystery" ? "?" : node.icon }}
                  </span>
                  <span
                    v-if="isNodeUnaffordable(node)"
                    class="node-funds-marker"
                    :class="`funds-${node.currency}`"
                    aria-hidden="true"
                  >
                    {{ node.currency === "cash" ? "$" : "S" }}
                  </span>
                </span>
                <span class="node-label">
                  <span>
                    {{ visibility(node) === "mystery" ? "Unknown" : node.name }}
                  </span>
                  <small v-if="isNodeUnaffordable(node)">
                    {{ nodePurchaseStatus(node).reason }}
                  </small>
                </span>
              </span>
              <span
                v-if="visibility(node) === 'revealed'"
                class="node-progress"
                :aria-label="`${nodeProgressPercent(node)}% complete — ${level(node)} of ${node.maxLevel} steps`"
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

      <div class="graph-map-title" aria-hidden="true">
        <strong>Career map</strong>
        <span>Choose your line</span>
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
            <strong>Named tiers</strong>
            <small>Prices and gains come directly from the catalog</small>
          </div>

          <div class="milestone-track" aria-label="Upgrade milestones">
            <span
              v-for="marker in nodeMarkers(selected)"
              :key="marker.level"
              :class="{ filled: marker.level <= level(selected) }"
            >
              <strong>{{ marker.label }}</strong>
              <small>Step {{ marker.level }}</small>
            </span>
          </div>
        </div>

        <dl class="detail-stats">
          <div class="detail-stat">
            <dt>Installed</dt>
            <dd>{{ installedLevelName }}</dd>
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
              away
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
