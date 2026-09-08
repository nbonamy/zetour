import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyRoadPitch, threeRoadPitch, ThreeLandscape } from "../../src/game/threeLandscape";

describe("3D road grade", () => {
  it("raises the road ahead on a climb and lowers it on a descent", () => {
    for (const gradient of [-0.08, 0, 0.08, 0.12]) {
      const road = new THREE.Group();
      applyRoadPitch(road, threeRoadPitch(gradient), 1.1);
      const ahead = road.localToWorld(new THREE.Vector3(0, 0, -50));
      const rider = road.localToWorld(new THREE.Vector3(0, 0, 1.1));
      expect(Math.sign(ahead.y)).toBe(Math.sign(gradient));
      expect(rider.y).toBeCloseTo(0);
      expect(rider.z).toBeCloseTo(1.1);
    }
    expect(threeRoadPitch(0.12)).toBeGreaterThan(threeRoadPitch(0.08));
    expect(threeRoadPitch(0.3)).toBe(threeRoadPitch(0.12));
  });

  it("keeps the rendered asphalt and road actors aligned while the horizon stays level", () => {
    const landscape = new ThreeLandscape();
    const actors = new THREE.Group();
    for (const grade of [0.12, -0.05, 0]) {
      const pitch = threeRoadPitch(grade);
      landscape.setRoadPitch(pitch, 1.1);
      applyRoadPitch(actors, pitch, 1.1);
      landscape.update(100);
      const asphalt = landscape.root.getObjectByName("Road surface") as THREE.Mesh;
      const vertex = new THREE.Vector3().fromBufferAttribute(asphalt.geometry.attributes.position, 60);
      const actor = new THREE.Object3D();
      actor.position.copy(vertex);
      actors.add(actor);
      expect(actor.getWorldPosition(new THREE.Vector3()).distanceTo(asphalt.localToWorld(vertex.clone()))).toBeLessThan(0.00001);
      expect(actor.position.equals(vertex)).toBe(true);
      expect(landscape.root.rotation.x).toBe(0);
      const mountains = landscape.root.getObjectByName("Mountain backdrop")!;
      const farRoad = actors.localToWorld(new THREE.Vector3(0, 0, -238));
      expect(new THREE.Box3().setFromObject(mountains).min.y).toBeLessThan(farRoad.y);
      actors.remove(actor);
    }
    landscape.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  });
});
