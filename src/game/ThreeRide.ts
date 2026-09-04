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
export const threeEncounterZ = (offset = 0): number => -58 - offset / 7.5;
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
  onFlowChange: (flow: number, combo: number) => void;
}

export type ThreeCameraMode = "Chase" | "Wide" | "Roadside" | "Helicopter";

const CAMERA_MODES: readonly ThreeCameraMode[] = [
  "Chase",
  "Wide",
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
  { sky: 0xa8d7e7, fog: 0xd6e4db, verge: 0xa4b783, soil: 0xb79c73, mountain: 0x9db9ac },
  { sky: 0xc2d8d4, fog: 0xd9dcc6, verge: 0xa3b184, soil: 0xb89a73, mountain: 0xa6b6a4 },
  { sky: 0xa0d3e4, fog: 0xd4e2dd, verge: 0x9fae7d, soil: 0xb49870, mountain: 0x91b3ac },
  { sky: 0xb2ced8, fog: 0xd5d9ca, verge: 0xa2ad7e, soil: 0xaa9275, mountain: 0x9bafa7 },
  { sky: 0xa4cadb, fog: 0xd0dbd7, verge: 0x8fa178, soil: 0xa49078, mountain: 0x8ca39e },
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
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.03, flatShading: true });

const applyShadow = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
};

const wheel = (): THREE.Mesh => {
  const geometry = new THREE.TorusGeometry(0.43, 0.045, 6, 20);
  const mesh = new THREE.Mesh(geometry, meshMaterial(0x211915, 0.68));
  mesh.rotation.y = Math.PI / 2;
  return mesh;
};

const tubeBetween = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh => {
  const direction = end.clone().sub(start);
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 7),
    material,
  );
  tube.position.copy(start).add(end).multiplyScalar(0.5);
  tube.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return tube;
};

const createCyclist = (
  jersey: number,
  accent: number,
  scale = 1,
): THREE.Group => {
  const group = new THREE.Group();
  const backWheel = wheel();
  backWheel.position.set(0, 0.47, 0.68);
  const frontWheel = wheel();
  frontWheel.position.set(0, 0.47, -0.68);
  group.add(backWheel, frontWheel);

  const frameMaterial = meshMaterial(accent, 0.54);
  const crank = new THREE.Vector3(0, 0.66, 0.08);
  const seat = new THREE.Vector3(0, 1.02, 0.28);
  const handle = new THREE.Vector3(0, 1.0, -0.48);
  group.add(
    tubeBetween(new THREE.Vector3(0, 0.47, 0.68), crank, 0.035, frameMaterial),
    tubeBetween(new THREE.Vector3(0, 0.47, -0.68), handle, 0.03, frameMaterial),
    tubeBetween(crank, seat, 0.04, frameMaterial),
    tubeBetween(crank, handle, 0.04, frameMaterial),
    tubeBetween(seat, handle, 0.04, frameMaterial),
  );
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.3), meshMaterial(0x1f1d1b));
  saddle.position.set(0, 1.05, 0.33);
  const handlebars = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.045, 0.06), meshMaterial(0x282522));
  handlebars.position.set(0, 1.02, -0.51);
  group.add(saddle, handlebars);

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.32, 0.62, 7),
    meshMaterial(jersey, 0.76),
  );
  torso.position.set(0, 1.37, 0.05);
  torso.rotation.x = -0.42;
  const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.42), meshMaterial(0x24262a));
  shorts.position.set(0, 1.08, 0.19);
  shorts.rotation.x = -0.2;
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), meshMaterial(0xd7a27b));
  head.position.set(0, 1.73, -0.16);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.205, 12, 6, 0, Math.PI * 2, 0, Math.PI / 1.8),
    meshMaterial(accent, 0.4),
  );
  helmet.scale.set(1, 0.7, 1.08);
  helmet.position.set(0, 1.82, -0.16);
  group.add(torso, shorts, head, helmet);

  const skinMaterial = meshMaterial(0xd7a27b, 0.88);
  const shortsMaterial = meshMaterial(0x24262a, 0.9);
  const legs: THREE.Group[] = [];
  [-1, 1].forEach((side) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.145, 1.04, 0.12);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.39, 7), shortsMaterial);
    thigh.position.set(0, -0.18, 0.06);
    thigh.rotation.x = 0.3;
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.058, 0.43, 7), skinMaterial);
    shin.position.set(0, -0.48, -0.03);
    shin.rotation.x = -0.34;
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.16, 7), meshMaterial(0xf3eee0));
    sock.position.set(0, -0.68, -0.1);
    legPivot.add(thigh, shin, sock);
    legs.push(legPivot);

    const arm = tubeBetween(
      new THREE.Vector3(side * 0.22, 1.53, -0.02),
      new THREE.Vector3(side * 0.24, 1.07, -0.49),
      0.052,
      skinMaterial,
    );
    group.add(legPivot, arm);
  });

  group.scale.setScalar(scale);
  group.userData.wheels = [backWheel, frontWheel];
  group.userData.legs = legs;
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
  [-0.67, 0.67].forEach((x) => {
    [-0.94, 0.94].forEach((z) => {
      const tyre = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.14, 10),
        meshMaterial(0x24211f, 0.9),
      );
      tyre.rotation.z = Math.PI / 2;
      tyre.position.set(x, 0.31, z);
      group.add(tyre);
    });
  });
  [-0.58, 0.58].forEach((x) => {
    const light = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), new THREE.MeshBasicMaterial({ color: 0xffe4a0 }));
    light.position.set(x, van ? 0.91 : 0.65, -1.69);
    group.add(light);
  });
  applyShadow(group);
  return group;
};

const createTree = (seed: number, cypress = false): THREE.Group => {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, 1.9, 6),
    meshMaterial(0x6b482f, 1),
  );
  trunk.position.y = 0.95;
  const crown = new THREE.Mesh(
    cypress
      ? new THREE.ConeGeometry(0.72 + (seed % 3) * 0.08, 4.2, 7)
      : new THREE.DodecahedronGeometry(1.15 + (seed % 3) * 0.18, 0),
    meshMaterial([0x648b4f, 0x77985d, 0x4f7c4b][seed % 3], 1),
  );
  crown.scale.set(cypress ? 0.72 : 0.9, cypress ? 1 : 1.25, cypress ? 0.72 : 0.9);
  crown.position.y = cypress ? 3.25 : 2.45;
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
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x82a7a8, roughness: 0.35 });
  const windowLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.58), windowMaterial);
  windowLeft.position.set(-0.72, 1.25, 1.41);
  const windowSide = windowLeft.clone();
  windowSide.position.set(-1.81, 1.23, 0.18);
  windowSide.rotation.y = -Math.PI / 2;
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.05, 0.42), meshMaterial(0x9a6749));
  chimney.position.set(-0.92, 3.08, 0.38);
  group.add(walls, roof, door, windowLeft, windowSide, chimney);
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

const createFrenchFlag = (): THREE.Group => {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 2.7, 7),
    meshMaterial(0xd8d2c1, 0.76),
  );
  pole.position.y = 1.35;
  group.add(pole);
  [0x2c5e9e, 0xf2eee1, 0xc4473d].forEach((color, index) => {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.78, 0.025),
      meshMaterial(color, 0.75),
    );
    panel.position.set(0.18 + index * 0.32, 2.2, 0);
    group.add(panel);
  });
  applyShadow(group);
  return group;
};

const createFan = (seed: number): THREE.Group => {
  const group = new THREE.Group();
  const shirtColors = [0xc85f4d, 0xd4b658, 0x4f889b, 0xe5d3a0, 0x658b5d];
  const shirt = meshMaterial(shirtColors[seed % shirtColors.length], 0.9);
  const skin = meshMaterial([0xc98e66, 0xd5aa82, 0xb97955][seed % 3], 0.9);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.27), shirt);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), skin);
  head.position.y = 1.57;
  const legs: THREE.Mesh[] = [];
  [-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.68, 0.14),
      meshMaterial(0x343a3a, 0.95),
    );
    leg.position.set(side * 0.12, 0.37, 0);
    legs.push(leg);
    group.add(leg);
  });
  const arms: THREE.Mesh[] = [];
  [-1, 1].forEach((side) => {
    const arm = tubeBetween(
      new THREE.Vector3(side * 0.2, 1.28, 0),
      new THREE.Vector3(side * 0.48, 1.84 + (seed % 2) * 0.1, 0),
      0.055,
      skin,
    );
    arms.push(arm);
    group.add(arm);
  });
  group.add(torso, head);
  group.userData.wavingArms = arms;
  group.userData.wavePhase = seed * 0.73;
  applyShadow(group);
  return group;
};

const createGantry = (seed: number): THREE.Group => {
  const group = new THREE.Group();
  const green = meshMaterial(seed % 2 === 0 ? 0x397b68 : 0x467b8a, 0.72);
  [-6.25, 6.25].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.25, 0.34), green);
    post.position.set(x, 2.12, 0);
    group.add(post);
  });
  const header = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.66, 0.42), green);
  header.position.y = 4.05;
  const inset = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.34, 0.05),
    meshMaterial(0xe8e6d7, 0.8),
  );
  inset.position.set(0, 4.05, 0.235);
  group.add(header, inset);
  applyShadow(group);
  return group;
};

export class ThreeRide {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 320);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly timer = new THREE.Timer();
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
  private readonly roadMaterial = meshMaterial(0x59615f, 0.93);
  private readonly vergeMaterial = meshMaterial(0xa4b783, 1);
  private readonly mountainMaterials: THREE.MeshStandardMaterial[] = [];
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
  private lastReportedFlow = -1;
  private lastReportedCombo = -1;
  private lastFlowActionAt = 0;
  private raceRevision = 0;
  private sceneryStage = 0;
  private announcement: Announcement | null = null;
  private cameraShake = 0;
  private cameraModeIndex = 0;
  private readonly cameraPosition = new THREE.Vector3(0, 5.05, 9.8);
  private readonly cameraLookTarget = new THREE.Vector3(0, 0.78, -14);
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
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.domElement.setAttribute("aria-label", "3D cycling road");
    this.renderer.domElement.setAttribute("role", "img");
    host.append(this.renderer.domElement);

    this.camera.position.set(0, 5.05, 9.8);
    this.camera.lookAt(0, 0.78, -14);
    this.scene.add(this.roadWorld);
    this.createEnvironment();
    this.rider = createCyclist(0xe3bc43, 0xd2a72d, 1.34);
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

    this.sunlight = new THREE.DirectionalLight(0xffe7bb, 3.1);
    this.sunlight.position.set(-11, 22, 14);
    this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.set(2048, 2048);
    this.sunlight.shadow.camera.left = -24;
    this.sunlight.shadow.camera.right = 24;
    this.sunlight.shadow.camera.top = 26;
    this.sunlight.shadow.camera.bottom = -6;
    this.sunlight.shadow.camera.near = 0.5;
    this.sunlight.shadow.camera.far = 90;
    this.scene.add(this.sunlight);
    this.scene.add(new THREE.HemisphereLight(0xd4efff, 0x8d7958, 2.65));

    this.raceRevision = gameStore.getSnapshot().raceRevision;
    this.callbacks.onCameraChange(CAMERA_MODES[this.cameraModeIndex]);
    this.callbacks.onFlowChange(this.flow, this.combo);
    this.resizeObserver = new ResizeObserver(() => this.resize(host));
    this.resizeObserver.observe(host);
    this.resize(host);
    window.addEventListener("keydown", this.onKeydown, { passive: false });
    this.timer.connect(document);
    this.timer.update();
    this.animationFrame = window.requestAnimationFrame(this.frame);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) this.timer.reset();
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
    this.timer.dispose();
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
    this.timer.update();
    const delta = Math.min(0.05, this.timer.getDelta());
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
    this.reportFlow();
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
    let desiredPosition: THREE.Vector3;
    let desiredLook: THREE.Vector3;
    switch (mode) {
      case "Chase":
        desiredPosition = new THREE.Vector3(this.rider.position.x * 0.08, 5.05, 9.8);
        desiredLook = new THREE.Vector3(this.rider.position.x * 0.1, 0.78, -14);
        break;
      case "Wide":
        desiredPosition = new THREE.Vector3(this.rider.position.x * 0.04, 9.4, 14.6);
        desiredLook = new THREE.Vector3(0, 0.4, -24);
        break;
      case "Roadside":
        desiredPosition = new THREE.Vector3(-11.8, 3.6, 3.4);
        desiredLook = new THREE.Vector3(this.rider.position.x, 0.85, -8);
        break;
      case "Helicopter":
        desiredPosition = new THREE.Vector3(0, 17.5, 8.4);
        desiredLook = new THREE.Vector3(0, 0, -25);
        break;
    }
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

    [-15.3, 15.3].forEach((x) => {
      const verge = new THREE.Mesh(new THREE.BoxGeometry(19, 0.09, 235), this.vergeMaterial);
      verge.position.set(x, -0.13, -105);
      verge.receiveShadow = true;
      this.roadWorld.add(verge);
    });

    const fieldColors = [0xafbd8b, 0xbac49a, 0x9fb27e, 0xc0c69e, 0xaab88b, 0xb4c08e];
    [-1, 1].forEach((side) => {
      for (let index = 0; index < 6; index += 1) {
        const field = new THREE.Mesh(
          new THREE.BoxGeometry(18, 0.05, 30.4),
          meshMaterial(fieldColors[(index + (side > 0 ? 2 : 0)) % fieldColors.length], 1),
        );
        field.position.set(side * 15.3, -0.065, 5 - index * 30);
        field.receiveShadow = true;
        this.movingScenery.push(field);
        this.roadWorld.add(field);
      }
    });

    [-1.38, 1.38].forEach((x) => {
      for (let z = 7; z > -WORLD_WRAP_LENGTH; z -= 8.5) {
        const marker = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 0.025, 3.3),
          new THREE.MeshBasicMaterial({ color: 0xf2eee4 }),
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

    [-6.25, 6.25].forEach((x) => {
      const sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.16, 235),
        meshMaterial(0xe9e5da, 1),
      );
      sidewalk.position.set(x, -0.005, -105);
      sidewalk.receiveShadow = true;
      this.roadWorld.add(sidewalk);
    });

    for (let index = 0; index < 44; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const post = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.8, 0.13), meshMaterial(0xe9e1c8));
      stem.position.y = 0.4;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.2, 0.16), meshMaterial(0xc94932));
      cap.position.y = 0.68;
      post.add(stem, cap);
      post.position.set(side * 7.05, 0, 5 - Math.floor(index / 2) * 8.2);
      this.movingScenery.push(post);
      this.roadWorld.add(post);
    }

    for (let index = 0; index < 60; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const tree = createTree(index, index % 5 === 0 || index % 11 === 0);
      tree.position.set(side * (7.8 + ((index * 4.7) % 6.5)), 0, 6 - index * 3.02);
      tree.rotation.y = (index * 0.47) % Math.PI;
      tree.scale.setScalar(0.62 + (index % 7) * 0.09);
      this.movingScenery.push(tree);
      this.roadWorld.add(tree);
    }

    for (let index = 0; index < 18; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const house = createHouse(index);
      house.position.set(side * (9.6 + ((index * 3.1) % 5.5)), 0, -3 - index * 9.7);
      house.rotation.y = side * (0.05 + (index % 3) * 0.05);
      house.scale.setScalar(0.68 + (index % 5) * 0.07);
      this.movingScenery.push(house);
      this.roadWorld.add(house);
    }

    for (let index = 0; index < 14; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const bale = createHayBale();
      bale.position.set(side * (8.8 + ((index * 5.3) % 6.5)), 0, 2 - index * 12.6);
      bale.rotation.y = (index * 0.61) % Math.PI;
      bale.scale.setScalar(0.75 + (index % 4) * 0.09);
      this.movingScenery.push(bale);
      this.roadWorld.add(bale);
    }

    for (let index = 0; index < 26; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const flag = createFrenchFlag();
      flag.position.set(
        side * (7.35 + (index % 3) * 0.33),
        0,
        -4 - Math.floor(index / 2) * 13.4 - (index % 4) * 0.65,
      );
      flag.rotation.y = side < 0 ? 0.16 : Math.PI - 0.16;
      flag.scale.setScalar(0.82 + (index % 4) * 0.06);
      this.movingScenery.push(flag);
      this.roadWorld.add(flag);
    }

    for (let index = 0; index < 36; index += 1) {
      const cluster = Math.floor(index / 4);
      const withinCluster = index % 4;
      const side = withinCluster < 2 ? -1 : 1;
      const fan = createFan(index);
      fan.position.set(
        side * (7.15 + (withinCluster % 2) * 0.62 + (cluster % 2) * 0.24),
        0,
        3 - cluster * 20.5 - (withinCluster % 2) * 1.15,
      );
      fan.scale.setScalar(0.82 + (index % 4) * 0.07);
      this.movingScenery.push(fan);
      this.roadWorld.add(fan);
    }

    [-44, -112, -174].forEach((z, index) => {
      const gantry = createGantry(index);
      gantry.position.z = z;
      this.movingScenery.push(gantry);
      this.roadWorld.add(gantry);
    });

    for (let index = 0; index < 18; index += 1) {
      const width = 7 + (index % 5) * 2.1;
      const height = 8 + (index % 6) * 2.35;
      const mountainMaterial = meshMaterial(0x9db9ac, 1);
      mountainMaterial.fog = true;
      this.mountainMaterials.push(mountainMaterial);
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(width, height, 5),
        mountainMaterial,
      );
      hill.position.set(-42 + index * 5.1, height / 2 - 1.4, -158 - (index % 4) * 3);
      hill.rotation.y = (index * 0.43) % Math.PI;
      hill.receiveShadow = true;
      this.scene.add(hill);
    }

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 24),
      new THREE.MeshBasicMaterial({ color: 0xf4d478, fog: true }),
    );
    sun.position.set(-26, 20, -155);
    this.scene.add(sun);
  }

  private updateStage(stage: GameSnapshot["stageDefinition"]): void {
    if (this.sceneryStage === stage.number) return;
    this.sceneryStage = stage.number;
    const palette = stagePalette[stage.number - 1] ?? stagePalette[0];
    this.scene.background = new THREE.Color(palette.sky);
    this.scene.fog = new THREE.Fog(palette.fog, 54, 205);
    this.vergeMaterial.color.setHex(stage.surface === "gravel" ? palette.soil : palette.verge);
    this.roadMaterial.color.setHex(stage.surface === "gravel" ? 0x8f755b : 0x59615f);
    this.roadMaterial.roughness = stage.surface === "gravel" ? 1 : 0.91;
    this.mountainMaterials.forEach((material, index) => {
      const color = new THREE.Color(palette.mountain);
      color.offsetHSL(index % 2 === 0 ? -0.012 : 0.008, -0.02, (index % 3) * 0.018);
      material.color.copy(color);
    });
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
    const sprite = this.createSprite(`/assets/art/bag-${type}.png`, 1.7, 1.7);
    sprite.position.set(THREE_LANE_X[lane], 0.95, z);
    this.roadWorld.add(sprite);
    this.objects.push({ mesh: sprite, type, lane, sequenceId, sequenceIndex, speedMultiplier: 1, passedRider: false });
  }

  private spawnPowerUp(type: PowerUpType, lane: number, z: number, choiceId: number): void {
    const sprite = this.createSprite(`/assets/art/${powerUpDefinitions[type].assetKey}.png`, 2.05, 2.05);
    sprite.position.set(THREE_LANE_X[lane], 1.15, z);
    sprite.userData.baseScale = 2.05;
    this.roadWorld.add(sprite);
    this.objects.push({ mesh: sprite, type, lane, choiceId, speedMultiplier: 1, passedRider: false });
  }

  private spawnPothole(lane: number, z: number, sequenceId?: number): void {
    const pothole = new THREE.Group();
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.96, 18),
      new THREE.MeshBasicMaterial({ color: 0x837a68, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.scale.y = 0.58;
    const crater = new THREE.Mesh(
      new THREE.CircleGeometry(0.76, 18),
      new THREE.MeshBasicMaterial({ color: 0x241e1a, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
    );
    crater.rotation.x = -Math.PI / 2;
    crater.scale.y = 0.56;
    crater.position.y = 0.006;
    pothole.add(rim, crater);
    pothole.position.set(THREE_LANE_X[lane], 0.02, z);
    this.roadWorld.add(pothole);
    this.objects.push({ mesh: pothole, type: "pothole", lane, sequenceId, speedMultiplier: 1, passedRider: false });
  }

  private spawnTraffic(lane: number, z: number, sequenceId: number): void {
    const van = Math.random() > 0.62;
    const car = createCar(van);
    car.scale.setScalar(1.08);
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
      if (!object) continue;
      if (object.sequenceFailed) continue;
      object.mesh.position.z += speed * object.speedMultiplier * delta;
      if (isPowerUpType(object.type)) {
        const pulse = 1 + Math.sin(this.elapsedMs / 170) * 0.08;
        const baseScale = (object.mesh.userData.baseScale as number | undefined) ?? 1;
        object.mesh.scale.set(baseScale * pulse, baseScale * pulse, 1);
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
        const spacing = trafficColumnSpacing(VISUAL_QA.speedKmh ?? snapshot.stats.speedKmh, snapshot.stage) / 12;
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

  private reportFlow(): void {
    const roundedFlow = Math.round(this.flow);
    if (roundedFlow === this.lastReportedFlow && this.combo === this.lastReportedCombo) return;
    this.lastReportedFlow = roundedFlow;
    this.lastReportedCombo = this.combo;
    this.callbacks.onFlowChange(roundedFlow, this.combo);
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
    const legs = cyclist.userData.legs as THREE.Group[] | undefined;
    legs?.forEach((leg, index) => {
      leg.rotation.x = Math.sin(this.elapsedMs / 92 + index * Math.PI) * 0.52;
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

  private updateFans(_speed: number, _delta: number): void {
    this.movingScenery.forEach((object) => {
      const arms = object.userData.wavingArms as THREE.Mesh[] | undefined;
      if (!arms) return;
      const phase = (object.userData.wavePhase as number | undefined) ?? 0;
      arms.forEach((arm, index) => {
        arm.rotation.z = Math.sin(this.elapsedMs / 180 + phase + index * 0.7) * 0.13;
      });
    });
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
    this.lastReportedFlow = -1;
    this.lastReportedCombo = -1;
    this.lastFlowActionAt = this.elapsedMs;
    this.drafting = false;
    this.droppedFromDraft = false;
    gameStore.setActiveFlowMultiplier(1);
    gameStore.setTemporaryDraftBonus(0);
    this.reportFlow();
  }
}
