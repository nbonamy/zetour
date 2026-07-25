import Phaser from "phaser";
import { GameScene } from "./GameScene";

export const createGame = (parent: HTMLElement): Phaser.Game =>
  new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 640,
    height: 360,
    backgroundColor: "#8ed7e8",
    pixelArt: true,
    roundPixels: true,
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [GameScene],
  });
