import * as THREE from "three";
import { gameAudio } from "../audio/gameAudio";
import {
  gameStore,
  powerUpDefinitions,
  stages,
  type GameSnapshot,
  type PowerUpType,
} from "../core/gameStore";
import { RANDOM_RIDER_DRAFT_BONUS } from "../core/drafting";
import { formatCompactNumber } from "../core/format";
import {
  addFlow,
  createTrafficGauntlet,
  decayFlow,
  draftRulesForStage,
  encounterChallengeRules,
  encounterDelayRange,
  encounterLabel,
  flowMultiplier,
  lootSequenceForStage,
  moveLane,
  nextEncounter,
  oncomingTrafficSpeedMultiplier,
  roadPowerUpChoices,
  trafficColumnSpacing,
  type RideEncounter,
} from "./rideSystems";
import { readVisualQaOverrides } from "./visualQa";

export const THREE_LANE_X = [-2.75, 0, 2.75] as const;
export const threeWorldSpeed = (speedKmh: number): number =>
  Math.max(0, speedKmh) * 0.54;
export const threeEncounterZ = (offset = 0): number => -72 - offset / 7.5;
export const isThreeLaneCollision = (
  riderX: number,
  objectX: number,
  riderZ: number,
  objectZ: number,
): boolean =>
  Math.abs(riderX - objectX) < 1.05 && Math.abs(riderZ - objectZ) < 1.35;

type LootType = "sweat" | "cash";
type HazardType = "pothole" | "oncoming-car" | "oncoming-van";
type WorldObjectType = LootType | HazardType | PowerUpType;

interface WorldObject {
  mesh: THREE.Object3D;
  type: WorldObjectType;
  lane: number;
  sequenceId?: number;
  sequenceIndex?: number;
  sequenceFailed?: boolean;
  choiceId?: number;
  speedMultiplier: number;
  passedRider: boolean;
}

interface ChallengeRun {
  encounter: RideEncounter;
  totalPickups: number;
  collectedPickups: number;
  failed: boolean;
}

interface Announcement {
  message: string;
  tone: "neutral" | "good" | "bad";
  until: number;
}

export interface ThreeRideCallbacks {
  onAnnouncement: (announcement: Announcement | null) => void;
  onCameraChange: (camera: ThreeCameraMode) => void;
}

export type ThreeCameraMode = "Chase" | "Roadside" | "Helicopter";

const CAMERA_MODES: readonly ThreeCameraMode[] = [
  "Chase",
  "Roadside",
  "Helicopter",
];

const VISUAL_QA = readVisualQaOverrides();
const RIDER_Z = 1.1;
const WORLD_END_Z = 10;
const WORLD_WRAP_LENGTH = 180;
const MAX_PIXEL_RATIO = 2;
const RANDOM_DRAFT_PERCENT = Math.round(RANDOM_RIDER_DRAFT_BONUS * 100);

const stagePalette = [
  { sky: 0x87cfe5, fog: 0xb8d9d0, verge: 0x5e824a, soil: 0x9a7445 },
  { sky: 0xbad6d4, fog: 0xcbd2b4, verge: 0x648052, soil: 0x9b7048 },
  { sky: 0x7ccbe7, fog: 0xbed9d4, verge: 0x6e8c55, soil: 0x9d7149 },
  { sky: 0x9cc7d5, fog: 0xc8d0bd, verge: 0x6f8050, soil: 0x90704e },
  { sky: 0x82bdd8, fog: 0xbccdcc, verge: 0x536a45, soil: 0x88735b },
] as const;

const randomBetween = (minimum: number, maximum: number): number =>
  minimum + Math.random() * (maximum - minimum);
const randomInt = (minimum: number, maximum: number): number =>
  Math.floor(randomBetween(minimum, maximum + 1));
const isPowerUpType = (type: WorldObjectType): type is PowerUpType =>
  Object.hasOwn(powerUpDefinitions, type);
const isTraffic = (type: WorldObjectType): type is "oncoming-car" | "oncoming-van" =>
  type === "oncoming-car" || type === "oncoming-van";

const meshMaterial = (color: number, roughness = 0.82): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });

const applyShadow = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
};

const wheel = (): THREE.Mesh => {
  const geometry = new THREE.TorusGeometry(0.36, 0.055, 8, 20);
  const mesh = new THREE.Mesh(geometry, meshMaterial(0x211915, 0.68));
  mesh.rotation.y = Math.PI / 2;
  return mesh;
};

const createCyclist = (
  jersey: number,
  accent: number,
  scale = 1,
): THREE.Group => {
  const group = new THREE.Group();
  const backWheel = wheel();
  backWheel.position.set(0, 0.39, 0.48);
  const frontWheel = wheel();
  frontWheel.position.set(0, 0.39, -0.48);
  group.add(backWheel, frontWheel);

  const frameMaterial = meshMaterial(accent, 0.54);
  const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.82, 7), frameMaterial);
  frame.rotation.x = Math.PI / 2;
  frame.rotation.z = -0.62;
  frame.position.set(0, 0.62, 0);
  const topTube = frame.clone();
  topTube.rotation.z = 0.64;
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.65, 7), frameMaterial);
  fork.rotation.x = -0.78;
  fork.position.set(0, 0.63, -0.31);
  group.add(frame, topTube, fork);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.43, 4, 8), meshMaterial(jersey, 0.76));
  torso.position.set(0, 1.23, 0.03);
  torso.rotation.x = -0.5;
  const shorts = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), meshMaterial(0x24262a));
  shorts.scale.set(1, 0.78, 1);
  shorts.position.set(0, 0.96, 0.16);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), meshMaterial(0xc98d66));
  head.position.set(0, 1.65, -0.18);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 6, 0, Math.PI * 2, 0, Math.PI / 1.8), meshMaterial(accent, 0.4));
  helmet.position.set(0, 1.69, -0.18);
  group.add(torso, shorts, head, helmet);

  const limbMaterial = meshMaterial(0x5a3426, 0.88);
  [-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.62, 7), limbMaterial);
    leg.position.set(side * 0.12, 0.71, 0.08);
    leg.rotation.x = side * 0.54;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.56, 7), limbMaterial);
    arm.position.set(side * 0.18, 1.3, -0.2);
    arm.rotation.x = 0.8;
    arm.rotation.z = side * 0.25;
    group.add(leg, arm);
  });

  group.scale.setScalar(scale);
  group.userData.wheels = [backWheel, frontWheel];
  applyShadow(group);
  return group;
};

const createCar = (van: boolean): THREE.Group => {
  const group = new THREE.Group();
  const color = van ? 0xe9d8b6 : 0xb84232;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(van ? 1.7 : 1.65, van ? 1.2 : 0.72, van ? 3.35 : 3.05),
    meshMaterial(color, 0.45),
  );
  body.position.y = van ? 0.86 : 0.62;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(van ? 1.5 : 1.35, van ? 0.65 : 0.58, van ? 1.5 : 1.42),
    meshMaterial(van ? 0xdfcda9 : 0x9d352b, 0.4),
  );
  cabin.position.set(0, van ? 1.55 : 1.15, -0.28);
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(van ? 1.28 : 1.12, 0.48), new THREE.MeshStandardMaterial({ color: 0x91bcc4, roughness: 0.2, metalness: 0.18 }));
  windshield.position.set(0, van ? 1.55 : 1.14, -1.08);
  windshield.rotation.x = -0.08;
  group.add(body, cabin, windshield);
  [-0.58, 0.58].forEach((x) => {
    const light = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), new THREE.MeshBasicMaterial({ color: 0xffe4a0 }));
    light.position.set(x, van ? 0.91 : 0.65, -1.69);
    group.add(light);
  });
  applyShadow(group);
  return group;
};

const createTree = (seed: number): THREE.Group => {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, 1.9, 6),
    meshMaterial(0x6b482f, 1),
  );
  trunk.position.y = 0.95;
  const crown = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.15 + (seed % 3) * 0.18, 0),
    meshMaterial([0x547a43, 0x6b8e4a, 0x436b3f][seed % 3], 1),
  );
  crown.scale.set(0.9, 1.3, 0.9);
  crown.position.y = 2.45;
  crown.rotation.set(seed * 0.31, seed * 0.73, seed * 0.12);
  group.add(trunk, crown);
  applyShadow(group);
  return group;
};

const createHouse = (seed: number): THREE.Group => {
  const group = new THREE.Group();
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 2.3, 2.8),
    meshMaterial(seed % 2 ? 0xeee3c8 : 0xf4ead0, 1),
  );
  walls.position.y = 1.15;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.65, 1.25, 4),
    meshMaterial(seed % 2 ? 0xb9563c : 0xc96a49, 0.94),
  );
  roof.position.y = 2.87;
  roof.rotation.y = Math.PI / 4;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 1.15), meshMaterial(0x76523a, 0.9));
  door.position.set(0.65, 0.62, 1.405);
  group.add(walls, roof, door);
  applyShadow(group);
  return group;
};

const createHayBale = (): THREE.Group => {
  const group = new THREE.Group();
  const bale = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.82, 1.45, 12),
    meshMaterial(0xd6b35b, 1),
  );
  bale.rotation.z = Math.PI / 2;
  bale.position.y = 0.82;
  const center = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 12),
    meshMaterial(0x9f7b37, 1),
  );
  center.rotation.y = Math.PI / 2;
  center.position.set(0.731, 0.82, 0);
  group.add(bale, center);
  applyShadow(group);
  return group;
};

export class ThreeRide {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(54, 16 / 9, 0.1, 320);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly clock = new THREE.Clock();
  private readonly roadWorld = new THREE.Group();
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly textureCache = new Map<string, THREE.Texture>();
  private readonly objects: WorldObject[] = [];
  private readonly movingScenery: THREE.Object3D[] = [];
  private readonly laneMarkers: THREE.Mesh[] = [];
  private readonly challenges = new Map<number, ChallengeRun>();
  private readonly callbacks: ThreeRideCallbacks;
  private readonly resizeObserver: ResizeObserver;
  private readonly rider: THREE.Group;
  private readonly aura: THREE.Mesh;
  private readonly sunlight: THREE.DirectionalLight;
  private readonly roadMaterial = meshMaterial(0x54504c, 0.93);
  private readonly vergeMaterial = meshMaterial(0x5e824a, 1);
  private backdrop: THREE.Mesh | null = null;
  private animationFrame = 0;
  private paused = false;
  private disposed = false;
  private elapsedMs = 0;
  private targetLane = 1;
  private targetRiderX: number = THREE_LANE_X[1];
  private lastSteerAt = 0;
  private encounterCountdown = VISUAL_QA.encounter ? 0 : 1_200;
  private encounterCount = 0;
  private sequenceCount = 0;
  private flow = 0;
  private combo = 0;
  private lastFlowActionAt = 0;
  private raceRevision = 0;
  private sceneryStage = 0;
  private announcement: Announcement | null = null;
  private cameraShake = 0;
  private cameraModeIndex = 0;
  private readonly cameraPosition = new THREE.Vector3(0, 3.5, 8.3);
  private readonly cameraLookTarget = new THREE.Vector3(0, 0.92, -12);
  private fanCountdown = 1.5;
  private domestiques: THREE.Group[] = [];
  private draftCyclist: THREE.Group | null = null;
  private draftLane = 1;
  private draftAcquisitionRemaining = 3.2;
  private draftTimeRemaining = 0;
  private draftGraceRemaining = 0;
  private draftLaneCountdown = 0;
  private drafting = false;
  private droppedFromDraft = false;

  constructor(host: HTMLElement, callbacks: ThreeRideCallbacks) {
    this.callbacks = callbacks;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.domElement.setAttribute("aria-label", "3D cycling road");
    this.renderer.domElement.setAttribute("role", "img");
    host.append(this.renderer.domElement);

    this.camera.position.set(0, 3.5, 8.3);
    this.camera.lookAt(0, 0.92, -12);
    this.scene.add(this.roadWorld);
    this.createEnvironment();
    this.rider = createCyclist(0xefc43e, 0xbf4c2f, 1.05);
    this.rider.position.set(THREE_LANE_X[1], 0, RIDER_Z);
    this.scene.add(this.rider);
    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.72, 32),
      new THREE.MeshBasicMaterial({ color: 0x71f5cc, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
    );
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.set(0, 0.04, RIDER_Z);
    this.aura.visible = false;
    this.scene.add(this.aura);

    this.sunlight = new THREE.DirectionalLight(0xffe7bb, 2.6);
    this.sunlight.position.set(-8, 18, 10);
    this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.set(1024, 1024);
    this.sunlight.shadow.camera.left = -18;
    this.sunlight.shadow.camera.right = 18;
    this.sunlight.shadow.camera.top = 20;
    this.sunlight.shadow.camera.bottom = -4;
    this.scene.add(this.sunlight);
    this.scene.add(new THREE.HemisphereLight(0xb9e4ff, 0x5c3d26, 2.4));

    this.raceRevision = gameStore.getSnapshot().raceRevision;
    this.callbacks.onCameraChange(CAMERA_MODES[this.cameraModeIndex]);
    this.resizeObserver = new ResizeObserver(() => this.resize(host));
    this.resizeObserver.observe(host);
    this.resize(host);
    window.addEventListener("keydown", this.onKeydown, { passive: false });
    this.clock.start();
    this.animationFrame = window.requestAnimationFrame(this.frame);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) this.clock.getDelta();
  }

  cycleCamera(): void {
    this.cameraModeIndex = (this.cameraModeIndex + 1) % CAMERA_MODES.length;
    const mode = CAMERA_MODES[this.cameraModeIndex];
    this.callbacks.onCameraChange(mode);
    this.showAnnouncement(`${mode.toUpperCase()} CAMERA`, "neutral", 850);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("keydown", this.onKeydown);
    this.resizeObserver.disconnect();
    gameStore.setTemporaryDraftBonus(0);
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Sprite)) return;
      if (object instanceof THREE.Mesh) object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.textureCache.forEach((texture) => texture.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly frame = (): void => {
    if (this.disposed) return;
    const delta = Math.min(0.05, this.clock.getDelta());
    if (!this.paused) this.update(delta);
    this.render(delta);
    this.animationFrame = window.requestAnimationFrame(this.frame);
  };

  private update(delta: number): void {
    this.elapsedMs += delta * 1_000;
    const current = gameStore.getSnapshot();
    if (current.raceRevision !== this.raceRevision) {
      this.raceRevision = current.raceRevision;
      this.resetWorld();
      return;
    }
    if (current.raceFinished) return;

    gameStore.tick(delta);
    const snapshot = gameStore.getSnapshot();
    if (snapshot.raceFinished) return;
    const speedKmh = VISUAL_QA.speedKmh ?? snapshot.stats.speedKmh;
    const speed = threeWorldSpeed(speedKmh);
    const gradient = VISUAL_QA.gradient ?? snapshot.currentGradient;
    const stage = VISUAL_QA.stage === null ? snapshot.stageDefinition : stages[VISUAL_QA.stage - 1];
    this.updateStage(stage);
    this.roadWorld.rotation.x = THREE.MathUtils.lerp(
      this.roadWorld.rotation.x,
      THREE.MathUtils.clamp(gradient * 2.2, -0.12, 0.22),
      1 - Math.exp(-delta * 2.8),
    );
    this.targetRiderX = THREE_LANE_X[this.targetLane];
    this.rider.position.x = THREE.MathUtils.lerp(
      this.rider.position.x,
      this.targetRiderX,
      1 - Math.exp(-delta * (7 + snapshot.stats.handling * 0.75)),
    );
    this.rider.rotation.z = THREE.MathUtils.lerp(
      this.rider.rotation.z,
      (this.targetRiderX - this.rider.position.x) * -0.15,
      1 - Math.exp(-delta * 9),
    );
    this.animateCyclist(this.rider, speed, delta);
    this.updateRoadMotion(speed, delta);
    this.updateObjects(speed, delta, snapshot.stats.pickupMagnet);
    this.updateFans(speed, delta);
    this.updateFlow(delta, snapshot.stats.flowDecayPerSecond);
    this.syncDomestiques(snapshot.upgrades.domestique ?? 0);
    this.updateDomestiques(speed, delta);
    this.updateDraft(delta, snapshot.stage, speed);
    this.updatePowerUpFeedback(snapshot.activePowerUp);

    this.encounterCountdown -= delta * 1_000;
    if (
      this.encounterCountdown <= 0 &&
      this.objects.length === 0 &&
      !this.draftCyclist
    ) {
      const encounter = VISUAL_QA.encounter ?? nextEncounter(stage, this.encounterCount);
      this.startEncounter(encounter, snapshot);
      this.encounterCount += 1;
      const [minimum, maximum] = encounterDelayRange(snapshot.stage);
      this.encounterCountdown = randomBetween(minimum, maximum);
    }

    if (this.announcement && this.announcement.until <= this.elapsedMs) {
      this.announcement = null;
      this.callbacks.onAnnouncement(null);
    }
  }

  private render(delta: number): void {
    const shake = this.cameraShake;
    this.cameraShake = Math.max(0, this.cameraShake - delta * 3.8);
    const offsetX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const offsetY = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0;
    const mode = CAMERA_MODES[this.cameraModeIndex];
    const desiredPosition =
      mode === "Chase"
        ? new THREE.Vector3(this.rider.position.x * 0.13, 3.5, 8.3)
        : mode === "Roadside"
          ? new THREE.Vector3(-10.5, 2.7, 1.8)
          : new THREE.Vector3(0, 14.5, 7.5);
    const desiredLook =
      mode === "Chase"
        ? new THREE.Vector3(this.rider.position.x * 0.12, 0.92, -12)
        : mode === "Roadside"
          ? new THREE.Vector3(this.rider.position.x, 0.75, -7)
          : new THREE.Vector3(0, 0, -20);
    const response = 1 - Math.exp(-delta * 4.6);
    this.cameraPosition.lerp(desiredPosition, response);
    this.cameraLookTarget.lerp(desiredLook, response);
    this.camera.position.copy(this.cameraPosition);
    this.camera.position.x += offsetX;
    this.camera.position.y += offsetY;
    this.camera.lookAt(this.cameraLookTarget);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(host: HTMLElement): void {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === "c" && !event.repeat) {
      event.preventDefault();
      this.cycleCamera();
      return;
    }
    if (this.paused || event.repeat) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    this.targetLane = moveLane(
      this.targetLane,
      event.key === "ArrowLeft" ? -1 : 1,
      THREE_LANE_X.length,
    );
    this.lastSteerAt = this.elapsedMs;
  };

  private createEnvironment(): void {
    const road = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.12, 235), this.roadMaterial);
    road.position.set(0, -0.08, -105);
    road.receiveShadow = true;
    this.roadWorld.add(road);

    [-15.2, 15.2].forEach((x) => {
      const verge = new THREE.Mesh(new THREE.BoxGeometry(19, 0.09, 235), this.vergeMaterial);
      verge.position.set(x, -0.13, -105);
      verge.receiveShadow = true;
      this.roadWorld.add(verge);
    });

    [-1.38, 1.38].forEach((x) => {
      for (let z = 7; z > -WORLD_WRAP_LENGTH; z -= 8.5) {
        const marker = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 0.025, 3.3),
          new THREE.MeshBasicMaterial({ color: 0xe8d298 }),
        );
        marker.position.set(x, 0.005, z);
        this.laneMarkers.push(marker);
        this.roadWorld.add(marker);
      }
    });

    [-5.38, 5.38].forEach((x) => {
      const shoulder = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.08, 235),
        meshMaterial(0xe4ded0, 0.95),
      );
      shoulder.position.set(x, 0, -105);
      shoulder.receiveShadow = true;
      this.roadWorld.add(shoulder);
    });

    for (let index = 0; index < 26; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const post = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.8, 0.13), meshMaterial(0xe9e1c8));
      stem.position.y = 0.4;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.2, 0.16), meshMaterial(0xc94932));
      cap.position.y = 0.68;
      post.add(stem, cap);
      post.position.set(side * 6.45, 0, 4 - index * 7.2);
      this.movingScenery.push(post);
      this.roadWorld.add(post);
    }

    for (let index = 0; index < 20; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const scenery =
        index % 9 === 0
          ? createHouse(index)
          : index % 6 === 0
            ? createHayBale()
            : createTree(index);
      scenery.position.set(
        side * randomBetween(9, index % 9 === 0 ? 15 : 21),
        0,
        2 - index * 9.2,
      );
      scenery.rotation.y = randomBetween(-0.35, 0.35);
      this.movingScenery.push(scenery);
      this.roadWorld.add(scenery);
    }

    const mountainMaterial = meshMaterial(0x71817b, 1);
    for (let index = 0; index < 12; index += 1) {
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(randomBetween(5, 11), randomBetween(9, 20), 5),
        mountainMaterial.clone(),
      );
      hill.position.set((index % 2 === 0 ? -1 : 1) * randomBetween(13, 32), randomBetween(2.5, 6), -45 - index * 11);
      hill.rotation.y = randomBetween(0, Math.PI);
      this.roadWorld.add(hill);
    }

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(5.2, 36),
      new THREE.MeshBasicMaterial({ color: 0xffd665, fog: false }),
    );
    sun.position.set(-26, 20, -105);
    this.scene.add(sun);
  }

  private updateStage(stage: GameSnapshot["stageDefinition"]): void {
    if (this.sceneryStage === stage.number) return;
    this.sceneryStage = stage.number;
    const palette = stagePalette[stage.number - 1] ?? stagePalette[0];
    this.scene.background = new THREE.Color(palette.sky);
    this.scene.fog = new THREE.Fog(palette.fog, 42, 190);
    this.vergeMaterial.color.setHex(stage.surface === "gravel" ? palette.soil : palette.verge);
    this.roadMaterial.color.setHex(stage.surface === "gravel" ? 0x8b6e51 : 0x54504c);
    this.roadMaterial.roughness = stage.surface === "gravel" ? 1 : 0.91;

    const texture = this.loadTexture(`/assets/art/stage-${stage.number}.jpg`);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (!this.backdrop) {
      this.backdrop = new THREE.Mesh(
        new THREE.PlaneGeometry(86, 32),
        new THREE.MeshBasicMaterial({ map: texture, fog: true }),
      );
      this.backdrop.position.set(0, 13.5, -123);
      this.scene.add(this.backdrop);
    } else {
      const material = this.backdrop.material as THREE.MeshBasicMaterial;
      material.map = texture;
      material.needsUpdate = true;
    }
    this.showAnnouncement(
      stage.surface === "gravel"
        ? `GRAVEL · ${stage.start.toUpperCase()} → ${stage.finish.toUpperCase()}`
        : `${stage.start.toUpperCase()} → ${stage.finish.toUpperCase()}`,
      "neutral",
      2_400,
    );
  }

  private loadTexture(path: string): THREE.Texture {
    const cached = this.textureCache.get(path);
    if (cached) return cached;
    const texture = this.textureLoader.load(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.textureCache.set(path, texture);
    return texture;
  }

  private updateRoadMotion(speed: number, delta: number): void {
    this.laneMarkers.forEach((marker) => {
      marker.position.z += speed * delta;
      if (marker.position.z > WORLD_END_Z) marker.position.z -= WORLD_WRAP_LENGTH;
    });
    for (let index = this.movingScenery.length - 1; index >= 0; index -= 1) {
      const object = this.movingScenery[index];
      object.position.z += speed * delta;
      if (object.position.z <= WORLD_END_Z) continue;
      if (object.userData.fan) {
        this.movingScenery.splice(index, 1);
        this.roadWorld.remove(object);
        if (object instanceof THREE.Sprite) object.material.dispose();
      } else {
        object.position.z -= WORLD_WRAP_LENGTH;
      }
    }
  }

  private createSprite(path: string, width: number, height: number): THREE.Sprite {
    const material = new THREE.SpriteMaterial({ map: this.loadTexture(path), transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width, height, 1);
    return sprite;
  }

  private spawnPickup(
    type: LootType,
    lane: number,
    z: number,
    sequenceId?: number,
    sequenceIndex?: number,
  ): void {
    const sprite = this.createSprite(`/assets/art/bag-${type}.png`, 1.35, 1.35);
    sprite.position.set(THREE_LANE_X[lane], 0.8, z);
    this.roadWorld.add(sprite);
    this.objects.push({ mesh: sprite, type, lane, sequenceId, sequenceIndex, speedMultiplier: 1, passedRider: false });
  }

  private spawnPowerUp(type: PowerUpType, lane: number, z: number, choiceId: number): void {
    const sprite = this.createSprite(`/assets/art/${powerUpDefinitions[type].assetKey}.png`, 1.65, 1.65);
    sprite.position.set(THREE_LANE_X[lane], 1, z);
    sprite.userData.baseScale = 1.65;
    this.roadWorld.add(sprite);
    this.objects.push({ mesh: sprite, type, lane, choiceId, speedMultiplier: 1, passedRider: false });
  }

  private spawnPothole(lane: number, z: number, sequenceId?: number): void {
    const pothole = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 18),
      new THREE.MeshBasicMaterial({ color: 0x241e1a, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
    );
    pothole.rotation.x = -Math.PI / 2;
    pothole.scale.y = 0.56;
    pothole.position.set(THREE_LANE_X[lane], 0.02, z);
    this.roadWorld.add(pothole);
    this.objects.push({ mesh: pothole, type: "pothole", lane, sequenceId, speedMultiplier: 1, passedRider: false });
  }

  private spawnTraffic(lane: number, z: number, sequenceId: number): void {
    const van = Math.random() > 0.62;
    const car = createCar(van);
    car.position.set(THREE_LANE_X[lane], 0, z);
    this.roadWorld.add(car);
    this.objects.push({
      mesh: car,
      type: van ? "oncoming-van" : "oncoming-car",
      lane,
      sequenceId,
      speedMultiplier: oncomingTrafficSpeedMultiplier(gameStore.getSnapshot().stage),
      passedRider: false,
    });
  }

  private updateObjects(speed: number, delta: number, pickupMagnet: boolean): void {
    for (let index = this.objects.length - 1; index >= 0; index -= 1) {
      const object = this.objects[index];
      if (object.sequenceFailed) continue;
      object.mesh.position.z += speed * object.speedMultiplier * delta;
      if (isPowerUpType(object.type)) {
        const pulse = 1 + Math.sin(this.elapsedMs / 170) * 0.08;
        object.mesh.scale.setScalar(pulse);
        object.mesh.rotation.z += delta * 0.55;
      }
      const pickup = object.type === "sweat" || object.type === "cash" || isPowerUpType(object.type);
      const magnetized = pickupMagnet && (object.type === "sweat" || object.type === "cash") && object.mesh.position.z > -5;
      if (
        (magnetized || isThreeLaneCollision(this.rider.position.x, object.mesh.position.x, RIDER_Z, object.mesh.position.z)) &&
        pickup
      ) {
        this.collect(object);
        continue;
      }
      if (
        isThreeLaneCollision(this.rider.position.x, object.mesh.position.x, RIDER_Z, object.mesh.position.z) &&
        !pickup
      ) {
        this.hitHazard(object);
        continue;
      }
      if (!object.passedRider && object.mesh.position.z >= RIDER_Z + 0.8 && !pickup) {
        object.passedRider = true;
        const laneGap = Math.abs(object.mesh.position.x - this.rider.position.x);
        if (this.elapsedMs - this.lastSteerAt < 5_000 && laneGap >= 1.5 && laneGap <= 3.8) {
          this.rewardFlow(isTraffic(object.type) ? 22 : 15, isTraffic(object.type) ? "TRAFFIC NEAR MISS" : "NEAR MISS");
        }
      }
      if (
        pickup &&
        object.sequenceId !== undefined &&
        object.sequenceIndex !== undefined &&
        object.mesh.position.z > RIDER_Z + 2.1
      ) {
        this.failSequence(object);
        continue;
      }
      if (object.mesh.position.z > 12) this.removeObject(object);
    }
  }

  private collect(object: WorldObject): void {
    if (isPowerUpType(object.type)) {
      const definition = powerUpDefinitions[object.type];
      gameStore.collectPowerUp(object.type);
      gameAudio.playEffect("power-up-pickup");
      this.rewardFlow(15, `${definition.label.toUpperCase()} RESERVED`);
      this.objects
        .filter((candidate) => candidate.choiceId === object.choiceId)
        .forEach((candidate) => this.removeObject(candidate));
      return;
    }
    if (object.type !== "sweat" && object.type !== "cash") return;
    const amount = gameStore.collectBag(object.type);
    gameAudio.playEffect(object.type === "sweat" ? "sweat-pickup" : "cash-pickup");
    this.rewardFlow(10, object.type === "sweat" ? `+${amount} SWEAT` : `+$${amount}`);
    const sequenceId = object.sequenceId;
    this.removeObject(object);
    if (sequenceId !== undefined) this.recordChallengePickup(sequenceId);
  }

  private recordChallengePickup(sequenceId: number): void {
    const challenge = this.challenges.get(sequenceId);
    if (!challenge) return;
    challenge.collectedPickups += 1;
    if (challenge.collectedPickups < challenge.totalPickups) return;
    this.challenges.delete(sequenceId);
    const rules = encounterChallengeRules[challenge.encounter];
    if (!rules || challenge.failed) {
      this.showAnnouncement(`${encounterLabel[challenge.encounter]} SURVIVED · CLEAN BONUS LOST`, "bad", 1_600);
      return;
    }
    const reward = gameStore.completeChallenge(rules.cleanRewardMultiplier, rules.difficulty);
    gameAudio.playEffect("challenge-clean");
    this.rewardFlow(rules.flowReward, `CLEAN ×${rules.cleanRewardMultiplier}`);
    this.showAnnouncement(
      `CLEAN ×${rules.cleanRewardMultiplier} · +${formatCompactNumber(reward.sweat)} SWEAT · +$${formatCompactNumber(reward.cash)}`,
      "good",
      2_200,
    );
  }

  private failSequence(missed: WorldObject): void {
    if (missed.sequenceId === undefined || missed.sequenceIndex === undefined) return;
    const challenge = this.challenges.get(missed.sequenceId);
    if (challenge) challenge.failed = true;
    this.removeObject(missed);
    this.objects
      .filter(
        (object) =>
          object.sequenceId === missed.sequenceId &&
          object.sequenceIndex !== undefined &&
          object.sequenceIndex > (missed.sequenceIndex ?? -1),
      )
      .forEach((object) => this.removeObject(object));
    this.challenges.delete(missed.sequenceId);
    gameAudio.playEffect("challenge-missed");
    this.showAnnouncement("SEQUENCE MISSED · CLEAN BONUS LOST", "bad", 1_500);
  }

  private hitHazard(object: WorldObject): void {
    const traffic = isTraffic(object.type);
    const active = gameStore.getSnapshot().activePowerUp;
    if (active && powerUpDefinitions[active.type].hazardImmunity) {
      gameAudio.playEffect("shield-hit");
      this.rewardFlow(traffic ? 20 : 12, traffic ? "TRAFFIC SHIELD" : "POTHOLE SHIELD");
      this.removeObject(object);
      return;
    }
    const challenge = object.sequenceId === undefined ? undefined : this.challenges.get(object.sequenceId);
    if (challenge) challenge.failed = true;
    const lost = traffic ? gameStore.hitTraffic() : gameStore.hitPothole();
    gameAudio.playEffect(traffic ? "car-crash" : "pothole-crash");
    this.flow = 0;
    this.combo = 0;
    gameStore.setActiveFlowMultiplier(1);
    this.lastFlowActionAt = this.elapsedMs;
    this.cameraShake = traffic ? 0.72 : 0.4;
    this.showAnnouncement(`COLLISION · -$${formatCompactNumber(lost)}`, "bad", 1_450);
    this.removeObject(object);
  }

  private removeObject(object: WorldObject): void {
    const index = this.objects.indexOf(object);
    if (index >= 0) this.objects.splice(index, 1);
    this.roadWorld.remove(object.mesh);
    object.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
      if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }

  private startEncounter(encounter: RideEncounter, snapshot: GameSnapshot): void {
    const rules = encounterChallengeRules[encounter];
    this.showAnnouncement(
      rules ? `${encounterLabel[encounter]} · CLEAN ×${rules.cleanRewardMultiplier}` : encounterLabel[encounter],
      "neutral",
      2_200,
    );
    const sequenceId = this.sequenceCount;
    this.sequenceCount += 1;
    const spawnLoot = (placements: Array<{ lane: number; z: number }>): void => {
      this.challenges.set(sequenceId, { encounter, totalPickups: placements.length, collectedPickups: 0, failed: false });
      const loot = lootSequenceForStage(snapshot.stage, placements.length);
      placements.forEach((placement, index) =>
        this.spawnPickup(loot[index], placement.lane, placement.z, sequenceId, index),
      );
    };
    const start = threeEncounterZ();

    switch (encounter) {
      case "bonus-line": {
        const lane = randomInt(0, 2);
        spawnLoot(Array.from({ length: 4 }, (_, index) => ({ lane, z: start - index * 11 })));
        this.spawnPothole((lane + 1) % 3, start - 18, sequenceId);
        this.spawnPothole((lane + 2) % 3, start - 42, sequenceId);
        break;
      }
      case "slalom": {
        const lanes = [0, 1, 2, 1, 0];
        const placements = lanes.map((lane, index) => {
          const z = start - index * 10.5;
          this.spawnPothole(lane, z, sequenceId);
          return { lane: (lane + 1) % 3, z: z - 5 };
        });
        spawnLoot(placements);
        break;
      }
      case "feed-zone": {
        const lane = randomInt(0, 2);
        spawnLoot(Array.from({ length: 6 }, (_, index) => ({ lane, z: start - index * 9 })));
        break;
      }
      case "sprint": {
        const placements = Array.from({ length: 7 }, (_, index) => {
          const lane = index % 2 === 0 ? 1 : randomInt(0, 2);
          const z = start - index * 8.5;
          if (index === 2 || index === 5) this.spawnPothole((lane + 1) % 3, z - 4, sequenceId);
          return { lane, z };
        });
        spawnLoot(placements);
        break;
      }
      case "hairpins": {
        const placements = [0, 2, 0, 2, 1].map((lane, index) => {
          const z = start - index * 10.5;
          this.spawnPothole(lane, z, sequenceId);
          return { lane: lane === 0 ? 2 : 0, z: z - 5 };
        });
        spawnLoot(placements);
        break;
      }
      case "traffic": {
        const pattern = createTrafficGauntlet(this.targetLane);
        const spacing = trafficColumnSpacing(VISUAL_QA.speedKmh ?? snapshot.stats.speedKmh, snapshot.stage) / 8;
        const placements = pattern.map((column, index) => {
          const z = start - index * spacing;
          column.hazardLanes.forEach((lane) => this.spawnTraffic(lane, z, sequenceId));
          return { lane: column.rewardLane, z: z - 5 };
        });
        spawnLoot(placements);
        break;
      }
      case "power-up":
        roadPowerUpChoices.forEach((type, lane) => this.spawnPowerUp(type, lane, start, sequenceId));
        break;
      case "draft":
        this.spawnDraftCyclist();
        break;
    }
  }

  private updateFlow(delta: number, decayPerSecond: number): void {
    if (VISUAL_QA.flow !== null) {
      this.flow = VISUAL_QA.flow;
    } else if (this.elapsedMs - this.lastFlowActionAt > 2_500 && !this.drafting) {
      this.flow = decayFlow(this.flow, delta, decayPerSecond);
      if (this.flow === 0) this.combo = 0;
    }
    gameStore.setActiveFlowMultiplier(flowMultiplier(this.flow));
  }

  private rewardFlow(amount: number, label: string): void {
    this.flow = addFlow(this.flow, amount);
    this.combo += 1;
    this.lastFlowActionAt = this.elapsedMs;
    this.showAnnouncement(label, "good", 900);
  }

  private spawnDraftCyclist(): void {
    if (this.draftCyclist) return;
    this.draftLane = VISUAL_QA.draftLane ?? randomInt(0, 2);
    this.draftCyclist = createCyclist(0x5d83b9, 0x23384d, 0.96);
    this.draftCyclist.position.set(THREE_LANE_X[this.draftLane], 0, -38);
    this.roadWorld.add(this.draftCyclist);
    this.draftAcquisitionRemaining = 3.2;
    this.draftTimeRemaining = 0;
    this.draftGraceRemaining = 0;
    this.draftLaneCountdown = randomBetween(2.7, 4.2);
    this.drafting = false;
    this.droppedFromDraft = false;
    gameStore.setTemporaryDraftBonus(0);
  }

  private updateDraft(delta: number, stage: number, speed: number): void {
    const cyclist = this.draftCyclist;
    if (!cyclist) {
      gameStore.setTemporaryDraftBonus(0);
      return;
    }
    this.animateCyclist(cyclist, speed, delta);
    cyclist.position.x = THREE.MathUtils.lerp(cyclist.position.x, THREE_LANE_X[this.draftLane], 1 - Math.exp(-delta * 5));
    if (this.droppedFromDraft) {
      cyclist.position.z -= 17 * delta;
      if (cyclist.position.z < -82) {
        this.roadWorld.remove(cyclist);
        this.draftCyclist = null;
        const [minimum, maximum] = encounterDelayRange(stage);
        this.encounterCountdown = randomBetween(minimum, maximum);
      }
      return;
    }
    if (cyclist.position.z < -6.5) {
      cyclist.position.z = Math.min(-6.5, cyclist.position.z + 14 * delta);
      return;
    }
    const rules = draftRulesForStage(stage);
    const aligned = Math.abs(this.rider.position.x - cyclist.position.x) < 0.82;
    if (!this.drafting) {
      this.draftAcquisitionRemaining -= delta;
      if (aligned) {
        this.drafting = true;
        this.draftGraceRemaining = rules.reactionSeconds;
        this.draftTimeRemaining = rules.durationSeconds;
        gameStore.setTemporaryDraftBonus(RANDOM_RIDER_DRAFT_BONUS);
        gameAudio.playEffect("draft-start");
        this.rewardFlow(12, `IN THE DRAFT · +${RANDOM_DRAFT_PERCENT}% SPEED`);
      } else if (this.draftAcquisitionRemaining <= 0) {
        this.dropDraft();
      }
      return;
    }
    this.draftTimeRemaining -= delta;
    if (this.draftTimeRemaining <= 0) {
      this.finishDraft();
      return;
    }
    this.draftLaneCountdown -= delta;
    if (this.draftLaneCountdown <= 0) {
      const direction = this.draftLane === 0 ? 1 : this.draftLane === 2 ? -1 : Math.random() < 0.5 ? -1 : 1;
      this.draftLane += direction;
      this.draftLaneCountdown = randomBetween(2.5, 4);
      this.draftGraceRemaining = rules.reactionSeconds;
      this.showAnnouncement("FOLLOW THE WHEEL!", "neutral", 900);
    }
    if (aligned) {
      this.draftGraceRemaining = rules.reactionSeconds;
      gameStore.setTemporaryDraftBonus(RANDOM_RIDER_DRAFT_BONUS);
      this.flow = addFlow(this.flow, delta * 2.5);
      this.lastFlowActionAt = this.elapsedMs;
    } else {
      this.draftGraceRemaining -= delta;
      if (this.draftGraceRemaining <= 0) this.dropDraft();
    }
  }

  private dropDraft(): void {
    const wasDrafting = this.drafting;
    this.drafting = false;
    this.droppedFromDraft = true;
    gameStore.setTemporaryDraftBonus(0);
    this.showAnnouncement("DROPPED!", "bad", 1_300);
    if (wasDrafting) gameAudio.playEffect("draft-end");
  }

  private finishDraft(): void {
    this.drafting = false;
    this.droppedFromDraft = true;
    gameStore.setTemporaryDraftBonus(0);
    gameAudio.playEffect("draft-end");
    gameAudio.playEffect("challenge-clean");
    const rules = encounterChallengeRules.draft;
    const reward = gameStore.completeChallenge(rules?.cleanRewardMultiplier ?? 6, rules?.difficulty ?? 4);
    this.rewardFlow(rules?.flowReward ?? 24, "DRAFT CLEAN");
    this.showAnnouncement(
      `DRAFT CLEAN ×${rules?.cleanRewardMultiplier ?? 6} · +${formatCompactNumber(reward.sweat)} SWEAT · +$${formatCompactNumber(reward.cash)}`,
      "good",
      2_200,
    );
  }

  private syncDomestiques(level: number): void {
    const count = Math.max(0, Math.min(3, Math.floor(level)));
    while (this.domestiques.length < count) {
      const rider = createCyclist(0xe5d6ad, 0x7d4930, 0.88);
      this.domestiques.push(rider);
      this.roadWorld.add(rider);
    }
    while (this.domestiques.length > count) {
      const rider = this.domestiques.pop();
      if (rider) this.roadWorld.remove(rider);
    }
  }

  private updateDomestiques(speed: number, delta: number): void {
    this.domestiques.forEach((rider, index) => {
      const side = index % 2 === 0 ? -0.85 : 0.85;
      rider.position.x = THREE.MathUtils.lerp(rider.position.x, this.rider.position.x + side, 1 - Math.exp(-delta * 5));
      rider.position.z = -2.2 - index * 1.9;
      this.animateCyclist(rider, speed, delta);
    });
  }

  private animateCyclist(cyclist: THREE.Group, speed: number, delta: number): void {
    const wheels = cyclist.userData.wheels as THREE.Mesh[] | undefined;
    wheels?.forEach((wheelMesh) => {
      wheelMesh.rotation.x -= speed * delta * 1.55;
    });
    cyclist.position.y = Math.sin(this.elapsedMs / 90) * 0.018;
  }

  private updatePowerUpFeedback(active: GameSnapshot["activePowerUp"]): void {
    this.aura.visible = Boolean(active && !active.suppressed);
    if (!active || active.suppressed) return;
    const color = active.type === "jump" ? 0xffe26f : active.type === "lucky-bidon" ? 0xa7e8ff : 0x71f5cc;
    const material = this.aura.material as THREE.MeshBasicMaterial;
    material.color.setHex(color);
    material.opacity = 0.48 + Math.sin(this.elapsedMs / 110) * 0.22;
    this.aura.scale.setScalar(1 + Math.sin(this.elapsedMs / 150) * 0.14);
  }

  private updateFans(speed: number, delta: number): void {
    this.fanCountdown -= delta;
    if (this.fanCountdown <= 0) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const count = randomInt(1, 3);
      for (let index = 0; index < count; index += 1) {
        const variant = randomInt(1, 8);
        const frame = Math.random() < 0.5 ? "a" : "b";
        const sprite = this.createSprite(`/assets/art/fan-${variant}-${frame}.png`, variant === 5 || variant === 6 ? 1.5 : 1.05, 1.7);
        sprite.position.set(side * (6.3 + index * 0.85), 0.92, -78 - index * 2);
        sprite.userData.fan = true;
        this.roadWorld.add(sprite);
        this.movingScenery.push(sprite);
      }
      this.fanCountdown = randomBetween(1.5, 3.3) * Math.max(0.65, 15 / Math.max(1, speed));
    }
  }

  private showAnnouncement(
    message: string,
    tone: Announcement["tone"],
    duration: number,
  ): void {
    this.announcement = { message, tone, until: this.elapsedMs + duration };
    this.callbacks.onAnnouncement(this.announcement);
  }

  private resetWorld(): void {
    [...this.objects].forEach((object) => this.removeObject(object));
    this.challenges.clear();
    if (this.draftCyclist) this.roadWorld.remove(this.draftCyclist);
    this.draftCyclist = null;
    this.domestiques.forEach((rider) => this.roadWorld.remove(rider));
    this.domestiques = [];
    this.targetLane = 1;
    this.rider.position.set(THREE_LANE_X[1], 0, RIDER_Z);
    this.encounterCountdown = VISUAL_QA.encounter ? 0 : 1_200;
    this.encounterCount = 0;
    this.sequenceCount = 0;
    this.flow = 0;
    this.combo = 0;
    this.lastFlowActionAt = this.elapsedMs;
    this.drafting = false;
    this.droppedFromDraft = false;
    gameStore.setActiveFlowMultiplier(1);
    gameStore.setTemporaryDraftBonus(0);
  }
}
