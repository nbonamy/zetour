import Phaser from "phaser";
import { gameStore } from "../core/gameStore";

type RoadObject = Phaser.Physics.Arcade.Image & {
  eventType?: "sweat" | "cash" | "pothole";
  companion?: Phaser.GameObjects.Image;
};

const WIDTH = 640;
const HEIGHT = 360;
const LANE_Y = [196, 248, 300];

export class GameScene extends Phaser.Scene {
  private rider!: Phaser.Physics.Arcade.Sprite;
  private pickups!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.Group;
  private mountain!: Phaser.GameObjects.TileSprite;
  private fields!: Phaser.GameObjects.TileSprite;
  private gradeMarkers!: Phaser.GameObjects.TileSprite;
  private conditionText!: Phaser.GameObjects.Text;
  private windStreaks: Phaser.GameObjects.Rectangle[] = [];
  private laneMarkers: Phaser.GameObjects.TileSprite[] = [];
  private targetLane = 1;
  private pickupCountdown = 800;
  private hazardCountdown = 2_200;
  private animationCountdown = 120;
  private riderFrame = false;
  private lastPointerMoveAt = 0;

  constructor() {
    super("ride");
  }

  create(): void {
    this.createTextures();
    this.createWorld();
    this.createRider();

    this.pickups = this.physics.add.group();
    this.hazards = this.physics.add.group();

    this.physics.add.overlap(
      this.rider,
      this.pickups,
      (_rider, object) => this.collect(object as RoadObject),
    );
    this.physics.add.overlap(
      this.rider,
      this.hazards,
      (_rider, object) => this.hitHazard(object as RoadObject),
    );

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const y = Phaser.Math.Clamp(pointer.y, LANE_Y[0], LANE_Y[2]);
      this.targetLane = LANE_Y.reduce(
        (best, laneY, index) =>
          Math.abs(laneY - y) < Math.abs(LANE_Y[best] - y) ? index : best,
        0,
      );
      this.lastPointerMoveAt = this.time.now;
    });
  }

  update(_time: number, delta: number): void {
    gameStore.tick(delta / 1_000);
    const snapshot = gameStore.getSnapshot();
    const scrollSpeed = 58 + snapshot.stats.speedKmh * 1.9;
    const isActive = this.time.now - this.lastPointerMoveAt < 5_000;
    const windPenalty = snapshot.stageDefinition.windPenalty;
    const gradient = snapshot.stageDefinition.gradient;

    this.mountain.tilePositionX += scrollSpeed * delta * 0.00014;
    this.fields.tilePositionX += scrollSpeed * delta * 0.00035;
    this.gradeMarkers.tilePositionX += scrollSpeed * delta * 0.001;
    this.gradeMarkers.setAlpha(
      gradient > 0 ? Math.min(0.75, 0.15 + gradient * 7) : 0,
    );
    this.laneMarkers.forEach((marker) => {
      marker.tilePositionX += scrollSpeed * delta * 0.001;
    });
    this.windStreaks.forEach((streak, index) => {
      streak.setVisible(windPenalty > 0);
      streak.setAlpha(Math.min(0.8, 0.2 + windPenalty * 2.5));
      streak.x -= (90 + windPenalty * 850) * (delta / 1_000);
      if (streak.x < -40) {
        streak.x = WIDTH + 30 + index * 13;
      }
    });
    this.conditionText.setText(
      `${
        windPenalty > 0
          ? snapshot.stats.windMitigation > 0
            ? `HEADWIND ← ${Math.round(windPenalty * 100)}% → ${Math.round(snapshot.stats.effectiveWindPenalty * 100)}%`
            : `HEADWIND ← ${Math.round(windPenalty * 100)}%`
          : "CALM"
      }  |  ${
        gradient > 0
          ? `CLIMB ↗ ${(gradient * 100).toFixed(1)}%`
          : "FLAT"
      }`,
    );

    const response = 1 - Math.exp(-delta / (210 / snapshot.stats.handling));
    this.rider.y = Phaser.Math.Linear(
      this.rider.y,
      LANE_Y[this.targetLane],
      response,
    );
    this.rider.setVelocityY(0);

    this.updateRoadObjects(this.pickups, scrollSpeed);
    this.updateRoadObjects(this.hazards, scrollSpeed);

    this.pickupCountdown -= delta;
    if (this.pickupCountdown <= 0) {
      this.spawnPickup();
      this.pickupCountdown = Phaser.Math.Between(1_900, 3_200);
    }

    this.hazardCountdown -= delta;
    if (this.hazardCountdown <= 0) {
      this.spawnPothole();
      this.hazardCountdown = Phaser.Math.Between(2_400, 4_000);
    }

    this.animationCountdown -= delta;
    if (this.animationCountdown <= 0) {
      this.riderFrame = !this.riderFrame;
      this.rider.setTexture(this.riderFrame ? "rider-b" : "rider-a");
      this.animationCountdown = 120;
    }

    this.rider.setData("safeCruise", !isActive);
  }

  private createWorld(): void {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x8ed7e8);
    this.add.circle(545, 58, 28, 0xffe390);
    this.windStreaks = Array.from({ length: 9 }, (_, index) =>
      this.add
        .rectangle(
          50 + index * 78,
          32 + (index % 4) * 31,
          18 + (index % 3) * 8,
          2,
          0xe9fbff,
        )
        .setDepth(2)
        .setVisible(false),
    );

    this.mountain = this.add
      .tileSprite(WIDTH / 2, 104, WIDTH, 110, "mountains")
      .setOrigin(0.5);
    this.fields = this.add
      .tileSprite(WIDTH / 2, 147, WIDTH, 56, "fields")
      .setOrigin(0.5);

    this.add.rectangle(WIDTH / 2, 258, WIDTH, 186, 0x59636b);
    this.add.rectangle(WIDTH / 2, 166, WIDTH, 12, 0x3f8b52);
    this.add.rectangle(WIDTH / 2, 348, WIDTH, 24, 0x3f8b52);
    this.add.rectangle(WIDTH / 2, 176, WIDTH, 2, 0xd7d2b5);
    this.add.rectangle(WIDTH / 2, 338, WIDTH, 2, 0xd7d2b5);

    [222, 274].forEach((y) => {
      this.laneMarkers.push(
        this.add.tileSprite(WIDTH / 2, y, WIDTH, 3, "lane-dash"),
      );
    });
    this.gradeMarkers = this.add
      .tileSprite(WIDTH / 2, 248, WIDTH, 16, "climb-chevron")
      .setDepth(3)
      .setAlpha(0);

    this.add
      .text(12, 338, "MOVE THE MOUSE UP / DOWN — NO CLICKING", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#fff8d8",
      })
      .setDepth(20);
    this.conditionText = this.add
      .text(12, 12, "CALM  |  FLAT", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#fff8d8",
        stroke: "#26323a",
        strokeThickness: 3,
      })
      .setDepth(20);
  }

  private createRider(): void {
    this.rider = this.physics.add.sprite(112, LANE_Y[1], "rider-a");
    this.rider.setDepth(10);
    this.rider.body?.setSize(24, 24);
  }

  private spawnPickup(): void {
    const type = Math.random() < 0.52 ? "sweat" : "cash";
    const lane = Phaser.Math.Between(0, 2);
    const texture = type === "sweat" ? "bag-sweat" : "bag-cash";
    const object = this.physics.add.image(WIDTH + 24, LANE_Y[lane], texture) as RoadObject;
    object.eventType = type;
    object.setDepth(8);
    this.pickups.add(object);

    const fanY = lane === 0 ? 164 : 346;
    const fan = this.add.image(WIDTH + 24, fanY, "fan").setDepth(6);
    object.companion = fan;
  }

  private spawnPothole(): void {
    const lane = Phaser.Math.Between(0, 2);
    const pothole = this.physics.add.image(
      WIDTH + 24,
      LANE_Y[lane] + 8,
      "pothole",
    ) as RoadObject;
    pothole.eventType = "pothole";
    pothole.setDepth(4);
    pothole.body?.setSize(28, 10);
    this.hazards.add(pothole);
  }

  private updateRoadObjects(
    group: Phaser.Physics.Arcade.Group,
    scrollSpeed: number,
  ): void {
    group.getChildren().forEach((child) => {
      const object = child as RoadObject;
      object.setVelocityX(-scrollSpeed);
      if (object.companion) {
        object.companion.x = object.x;
      }
      if (object.x < -36) {
        object.companion?.destroy();
        object.destroy();
      }
    });
  }

  private collect(object: RoadObject): void {
    if (!object.active || object.eventType === "pothole") return;
    const amount = gameStore.collectBag(object.eventType ?? "cash");
    this.floatText(
      object.x,
      object.y - 16,
      `+${amount}${object.eventType === "sweat" ? "S" : "€"}`,
      object.eventType === "sweat" ? "#71f5cc" : "#ffe26f",
    );
    object.companion?.destroy();
    object.destroy();
  }

  private hitHazard(object: RoadObject): void {
    if (!object.active) return;
    const safeCruise = Boolean(this.rider.getData("safeCruise"));
    if (safeCruise) {
      object.destroy();
      return;
    }

    const lost = gameStore.hitPothole();
    this.floatText(object.x, object.y - 18, `-${lost}€`, "#ff8d7d");
    this.cameras.main.shake(120, 0.008);
    this.rider.setTint(0xff9b91);
    this.time.delayedCall(240, () => this.rider.clearTint());
    object.destroy();
  }

  private floatText(x: number, y: number, label: string, color: string): void {
    const text = this.add
      .text(x, y, label, {
        fontFamily: "monospace",
        fontSize: "14px",
        color,
        stroke: "#26323a",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({
      targets: text,
      y: y - 28,
      alpha: 0,
      duration: 700,
      onComplete: () => text.destroy(),
    });
  }

  private createTextures(): void {
    const texture = (
      key: string,
      width: number,
      height: number,
      draw: (graphics: Phaser.GameObjects.Graphics) => void,
    ) => {
      if (this.textures.exists(key)) return;
      const graphics = this.add.graphics({ x: 0, y: 0 });
      draw(graphics);
      graphics.generateTexture(key, width, height);
      graphics.destroy();
    };

    texture("rider-a", 38, 34, (g) => {
      g.fillStyle(0x26323a).fillCircle(9, 25, 8).fillCircle(29, 25, 8);
      g.fillStyle(0x8ed7e8).fillCircle(9, 25, 5).fillCircle(29, 25, 5);
      g.lineStyle(3, 0xf1cf4b)
        .lineBetween(9, 25, 19, 16)
        .lineBetween(19, 16, 29, 25)
        .lineBetween(9, 25, 23, 25)
        .lineBetween(19, 16, 23, 25);
      g.fillStyle(0xef6f51).fillRect(17, 7, 7, 10);
      g.fillStyle(0xf2b28c).fillCircle(21, 5, 4);
      g.fillStyle(0x26323a).fillRect(16, 1, 10, 3);
      g.lineStyle(3, 0x26323a).lineBetween(20, 16, 14, 23);
    });
    texture("rider-b", 38, 34, (g) => {
      g.fillStyle(0x26323a).fillCircle(9, 25, 8).fillCircle(29, 25, 8);
      g.fillStyle(0x8ed7e8).fillCircle(9, 25, 5).fillCircle(29, 25, 5);
      g.lineStyle(3, 0xf1cf4b)
        .lineBetween(9, 25, 19, 16)
        .lineBetween(19, 16, 29, 25)
        .lineBetween(9, 25, 23, 25)
        .lineBetween(19, 16, 23, 25);
      g.fillStyle(0xef6f51).fillRect(17, 7, 7, 10);
      g.fillStyle(0xf2b28c).fillCircle(21, 5, 4);
      g.fillStyle(0x26323a).fillRect(16, 1, 10, 3);
      g.lineStyle(3, 0x26323a).lineBetween(20, 16, 27, 22);
    });
    texture("bag-sweat", 18, 18, (g) => {
      g.fillStyle(0x6fe3cb).fillRect(2, 4, 14, 12);
      g.fillStyle(0xe9fff8).fillRect(7, 7, 4, 6);
      g.fillStyle(0x26323a).fillRect(6, 1, 6, 4);
    });
    texture("bag-cash", 18, 18, (g) => {
      g.fillStyle(0xf1cf4b).fillRect(2, 4, 14, 12);
      g.fillStyle(0x26323a).fillRect(8, 7, 2, 6);
      g.fillStyle(0x26323a).fillRect(6, 9, 6, 2);
      g.fillStyle(0x26323a).fillRect(6, 1, 6, 4);
    });
    texture("pothole", 32, 14, (g) => {
      g.fillStyle(0x30383d).fillEllipse(16, 8, 30, 11);
      g.fillStyle(0x1c2226).fillEllipse(16, 8, 21, 6);
      g.fillStyle(0x7d8588).fillRect(4, 3, 4, 2).fillRect(23, 10, 5, 2);
    });
    texture("fan", 16, 24, (g) => {
      g.fillStyle(0xf2b28c).fillCircle(8, 4, 4);
      g.fillStyle(0x4f7cac).fillRect(4, 8, 8, 10);
      g.fillStyle(0x26323a).fillRect(4, 18, 3, 6).fillRect(10, 18, 3, 6);
      g.fillStyle(0xf2b28c).fillRect(12, 9, 4, 3);
    });
    texture("lane-dash", 64, 3, (g) => {
      g.fillStyle(0xe8e0c9).fillRect(0, 0, 30, 3);
    });
    texture("climb-chevron", 64, 16, (g) => {
      g.lineStyle(3, 0xf1cf4b, 0.9)
        .lineBetween(5, 12, 13, 4)
        .lineBetween(13, 4, 21, 12)
        .lineBetween(37, 12, 45, 4)
        .lineBetween(45, 4, 53, 12);
    });
    texture("mountains", 128, 110, (g) => {
      g.fillStyle(0x7099a1)
        .fillTriangle(0, 110, 38, 28, 78, 110)
        .fillTriangle(48, 110, 92, 12, 128, 110);
      g.fillStyle(0xdbe9df)
        .fillTriangle(27, 51, 38, 28, 49, 51)
        .fillTriangle(80, 39, 92, 12, 103, 39);
      g.fillStyle(0x50777d).fillTriangle(0, 110, 18, 63, 48, 110);
    });
    texture("fields", 128, 56, (g) => {
      g.fillStyle(0x69a84f).fillRect(0, 0, 128, 56);
      g.fillStyle(0x4a8b46)
        .fillTriangle(0, 56, 24, 6, 42, 56)
        .fillTriangle(45, 56, 78, 12, 104, 56)
        .fillTriangle(92, 56, 116, 2, 128, 56);
    });
  }
}
