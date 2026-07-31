import Phaser from "phaser";
import { GameScene } from "./GameScene";
import { rideRenderSize } from "./rendering";

export const createGame = (parent: HTMLElement): Phaser.Game => {
  const renderSize = rideRenderSize();
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: renderSize.width,
    height: renderSize.height,
    backgroundColor: "#241711",
    pixelArt: false,
    roundPixels: false,
    antialias: true,
    antialiasGL: true,
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
};
