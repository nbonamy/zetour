import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createRoadVehicle, animateRoadVehicle } from "../../src/game/threeVehicles";
import { disposeRoadObject } from "../../src/game/threeProps";

describe("3D traffic models", () => {
  it.each([false, true])("keeps traffic inside one lane with all four tyres on the road (van: %s)", (van) => {
    const vehicle = createRoadVehicle(van);
    vehicle.scale.setScalar(1.08);
    const bounds = new THREE.Box3().setFromObject(vehicle);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(bounds.getSize(new THREE.Vector3()).x).toBeLessThan(2.4);
    const wheels = vehicle.userData.vehicleWheels as THREE.Group[];
    expect(wheels).toHaveLength(4);
    for (const wheel of wheels) expect(new THREE.Box3().setFromObject(wheel).min.y).toBeCloseTo(0, 5);
    disposeRoadObject(vehicle);
  });

  it("rolls the wheels by road distance while leaving body panels fixed", () => {
    const vehicle = createRoadVehicle(false);
    vehicle.scale.setScalar(1.08);
    const body = vehicle.children.find((part) => part instanceof THREE.Mesh)!;
    const before = body.quaternion.clone();
    animateRoadVehicle(vehicle, 0.315 * 1.08 * Math.PI);
    for (const wheel of vehicle.userData.vehicleWheels as THREE.Group[]) expect(wheel.rotation.x).toBeCloseTo(Math.PI);
    expect(body.quaternion.equals(before)).toBe(true);
    disposeRoadObject(vehicle);
  });
});
