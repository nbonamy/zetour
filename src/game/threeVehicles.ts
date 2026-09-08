import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Point = [number, number, number];
const WHEEL_RADIUS = 0.315;

// Batch the stationary panels by finish; keep each wheel as a separate rotating group.
const batchPanels = (group: THREE.Group): void => {
  const finishes = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    const meshes = finishes.get(child.material) ?? [];
    meshes.push(child);
    finishes.set(child.material, meshes);
  }
  for (const [material, meshes] of finishes) {
    const parts = meshes.map((mesh) => {
      mesh.updateMatrix();
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      return geometry.applyMatrix4(mesh.matrix);
    });
    const geometry = mergeGeometries(parts);
    parts.forEach((part) => part.dispose());
    if (!geometry) continue;
    meshes.forEach((mesh) => { group.remove(mesh); mesh.geometry.dispose(); });
    const merged = new THREE.Mesh(geometry, material);
    merged.castShadow = true;
    merged.receiveShadow = true;
    group.add(merged);
  }
};

export const createRoadVehicle = (van: boolean, paintIndex = 0): THREE.Group => {
  const root = new THREE.Group();
  root.name = van ? "Service van" : "Tour hatchback";
  const finish = (color: number, roughness = 0.45, metalness = 0.1): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const paint = finish(van ? 0xe9dfc5 : [0xc94c3c, 0x427e99, 0xd4ae51][paintIndex % 3], 0.32, 0.22);
  const rubber = finish(0x242b2f, 0.93, 0);
  const alloy = finish(0xb8c2c3, 0.32, 0.65);
  const glass = finish(0x294d61, 0.18, 0.4);
  glass.side = THREE.DoubleSide;
  const reflection = finish(0x83afb8, 0.22, 0.3);
  reflection.side = THREE.DoubleSide;
  const accent = finish(van ? 0x347e7c : 0x303b41, 0.56);
  const plate = finish(0xf6edd6, 0.6);
  const plateBlue = finish(0x306298, 0.6);
  const headlight = finish(0xffedbd, 0.25);
  headlight.emissive.setHex(0xffd080);
  headlight.emissiveIntensity = 0.3;
  const tailLight = finish(0xba302e, 0.3);
  const indicator = finish(0xe4a039, 0.4);

  const box = (parent: THREE.Group, size: Point, at: Point, material: THREE.Material, radius = 0.025): THREE.Mesh => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 1, radius), material);
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  };
  const panel = (points: Point[], material: THREE.Material): THREE.Mesh => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    root.add(mesh);
    return mesh;
  };
  const bar = (a: Point, b: Point, radius: number, material: THREE.Material): void => {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 6), material);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    root.add(mesh);
  };

  const halfLength = van ? 1.78 : 1.64;
  const halfWidth = van ? 0.82 : 0.78;
  const axle = van ? 1.12 : 1.02;
  const waist = van ? 1.08 : 0.95;
  // The lower edge follows real wheel openings instead of hiding tyres in a box.
  const profile = new THREE.Shape();
  profile.moveTo(-halfLength, 0.34);
  for (const z of [-axle, axle]) {
    profile.lineTo(z - 0.39, 0.34);
    profile.absarc(z, 0.34, 0.39, Math.PI, 0, true);
  }
  profile.lineTo(halfLength, 0.34);
  profile.lineTo(halfLength, waist - 0.23);
  profile.lineTo(halfLength - 0.16, waist - 0.05);
  profile.lineTo(0.62, waist);
  profile.lineTo(-halfLength + 0.2, waist);
  profile.lineTo(-halfLength, waist - 0.14);
  profile.closePath();
  const bodyGeometry = new THREE.ExtrudeGeometry(profile, {
    depth: halfWidth * 2 - 0.08, bevelEnabled: true, bevelSize: 0.04,
    bevelThickness: 0.04, bevelSegments: 2, curveSegments: 12, steps: 1,
  });
  bodyGeometry.translate(0, 0, -halfWidth + 0.04);
  bodyGeometry.rotateY(-Math.PI / 2);
  root.add(new THREE.Mesh(bodyGeometry, paint));

  const roofY = van ? 1.91 : 1.46;
  const roofWidth = van ? 0.73 : 0.62;
  const frontBottom = van ? 1.39 : 0.7;
  const frontTop = van ? 1.08 : 0.23;
  const rearBottom = van ? -1.68 : -1.33;
  const rearTop = van ? -1.62 : -0.86;
  const lowerWidth = halfWidth - 0.045;
  // Four gently sloping sides and a separate roof give the cabin its silhouette.
  panel([[-lowerWidth, waist, frontBottom], [lowerWidth, waist, frontBottom], [roofWidth, roofY, frontTop], [-roofWidth, roofY, frontTop]], paint);
  panel([[lowerWidth, waist, rearBottom], [-lowerWidth, waist, rearBottom], [-roofWidth, roofY, rearTop], [roofWidth, roofY, rearTop]], paint);
  for (const side of [-1, 1]) {
    const points: Point[] = [[side * lowerWidth, waist, rearBottom], [side * lowerWidth, waist, frontBottom], [side * roofWidth, roofY, frontTop], [side * roofWidth, roofY, rearTop]];
    panel(side === 1 ? points.reverse() : points, paint);
  }
  box(root, [roofWidth * 2 + 0.09, 0.10, frontTop - rearTop + 0.12], [0, roofY + 0.015, (frontTop + rearTop) / 2], paint, 0.045);

  const paneBottom = waist + 0.10;
  const paneTop = roofY - 0.09;
  const alongFront = (y: number): number => THREE.MathUtils.lerp(frontBottom, frontTop, (y - waist) / (roofY - waist)) + 0.012;
  const alongRear = (y: number): number => THREE.MathUtils.lerp(rearBottom, rearTop, (y - waist) / (roofY - waist)) - 0.012;
  const widthAt = (y: number): number => THREE.MathUtils.lerp(lowerWidth, roofWidth, (y - waist) / (roofY - waist));
  const paneWidth = widthAt(paneBottom) - 0.075;
  const paneRoofWidth = widthAt(paneTop) - 0.075;
  panel([[-paneWidth, paneBottom, alongFront(paneBottom)], [paneWidth, paneBottom, alongFront(paneBottom)], [paneRoofWidth, paneTop, alongFront(paneTop)], [-paneRoofWidth, paneTop, alongFront(paneTop)]], glass);
  panel([[-paneWidth + 0.03, paneBottom + 0.035, alongFront(paneBottom + 0.035) + 0.006], [-paneWidth + 0.14, paneBottom + 0.035, alongFront(paneBottom + 0.035) + 0.006], [-paneRoofWidth + 0.27, paneTop - 0.03, alongFront(paneTop - 0.03) + 0.006], [-paneRoofWidth + 0.08, paneTop - 0.03, alongFront(paneTop - 0.03) + 0.006]], reflection);
  panel([[paneWidth, paneBottom, alongRear(paneBottom)], [-paneWidth, paneBottom, alongRear(paneBottom)], [-paneRoofWidth, paneTop, alongRear(paneTop)], [paneRoofWidth, paneTop, alongRear(paneTop)]], glass);

  for (const side of [-1, 1]) {
    const sideGlass = (bottomRear: number, bottomFront: number, topFront: number, topRear: number): void => {
      panel([[side * (widthAt(paneBottom) + 0.012), paneBottom, bottomRear], [side * (widthAt(paneBottom) + 0.012), paneBottom, bottomFront], [side * (widthAt(paneTop) + 0.012), paneTop, topFront], [side * (widthAt(paneTop) + 0.012), paneTop, topRear]], glass);
    };
    sideGlass(van ? 0.16 : -0.25, frontBottom - 0.15, frontTop - 0.09, van ? 0.16 : -0.25);
    if (!van) sideGlass(rearBottom + 0.16, -0.32, -0.32, rearTop + 0.09);
    box(root, [0.026, 0.035, van ? 3.30 : 2.96], [side * (halfWidth + 0.013), 0.82, 0], alloy, 0.008);
    box(root, [0.036, van ? 0.17 : 0.085, halfLength * 2 - 0.24], [side * (halfWidth + 0.01), van ? 0.94 : 0.75, 0], accent, 0.01);
    const doorZ = van ? 0.08 : -0.3;
    bar([side * (lowerWidth + 0.015), waist - 0.03, doorZ], [side * (halfWidth + 0.019), 0.40, doorZ], 0.009, accent);
    box(root, [0.06, 0.035, 0.16], [side * (halfWidth + 0.036), waist - 0.10, doorZ + 0.16], rubber, 0.015);
    if (van) {
      // Stamped cargo ribs and a sliding-door rail distinguish the service van.
      for (let rib = 0; rib < 3; rib += 1) {
        const y = 1.23 + rib * 0.16;
        box(root, [0.025, 0.028, 1.26], [side * (widthAt(y) + 0.006), y, -0.85], paint, 0.008);
      }
      bar([side * 0.79, 1.11, -1.5], [side * 0.79, 1.11, 0.08], 0.015, alloy);
    }
    const mirrorZ = frontBottom - 0.11;
    bar([side * lowerWidth, waist + 0.12, mirrorZ], [side * 0.94, waist + 0.15, mirrorZ], 0.024, rubber);
    box(root, [0.15, van ? 0.22 : 0.13, 0.14], [side * 0.97, waist + 0.16, mirrorZ], accent, 0.035);
    box(root, [0.10, van ? 0.17 : 0.085, 0.012], [side * 0.97, waist + 0.16, mirrorZ - 0.074], glass, 0.015);
    bar([side * 0.48, paneBottom + 0.028, alongFront(paneBottom + 0.028) + 0.014], [side * 0.11, paneBottom + 0.11, alongFront(paneBottom + 0.11) + 0.014], 0.012, rubber);
  }

  for (const end of [-1, 1]) {
    const z = end * (halfLength + 0.06);
    box(root, [halfWidth * 2 + 0.04, 0.16, 0.16], [0, 0.40, z], rubber, 0.055);
    box(root, [halfWidth * 2 - 0.1, 0.035, 0.18], [0, 0.46, z], alloy, 0.015);
    box(root, [0.43, 0.115, 0.025], [0, 0.42, z + end * 0.092], plate, 0.012);
    box(root, [0.048, 0.10, 0.029], [-0.18, 0.42, z + end * 0.095], plateBlue, 0.006);
    for (let mark = 0; mark < 3; mark += 1) box(root, [0.053, 0.018, 0.031], [-0.075 + mark * 0.076, 0.42, z + end * 0.097], rubber, 0.005);
  }
  const nose = halfLength + 0.052;
  const lightsY = van ? 0.80 : 0.66;
  box(root, [0.72, 0.23, 0.04], [0, lightsY, nose], rubber, 0.04);
  for (let row = 0; row < 3; row += 1) box(root, [0.64, 0.015, 0.045], [0, lightsY - 0.075 + row * 0.075, nose + 0.009], alloy, 0.004);
  for (const side of [-1, 1]) {
    box(root, [0.36, 0.21, 0.065], [side * 0.56, lightsY, nose], alloy, 0.04);
    box(root, [0.275, 0.14, 0.026], [side * 0.54, lightsY, nose + 0.04], headlight, 0.025);
    box(root, [0.055, 0.13, 0.028], [side * 0.70, lightsY, nose + 0.039], indicator, 0.015);
    box(root, [0.17, van ? 0.38 : 0.23, 0.045], [side * (halfWidth - 0.14), van ? 0.79 : 0.64, -halfLength - 0.066], tailLight, 0.027);
    box(root, [0.17, 0.065, 0.05], [side * (halfWidth - 0.14), van ? 0.95 : 0.70, -halfLength - 0.070], indicator, 0.012);
  }
  if (van) {
    bar([0, 0.52, -halfLength - 0.054], [0, waist, -halfLength - 0.054], 0.012, accent);
    bar([0, waist, rearBottom - 0.015], [0, roofY - 0.05, rearTop - 0.015], 0.012, accent);
    box(root, [0.17, 0.032, 0.045], [0.12, 0.87, -halfLength - 0.066], rubber, 0.012);
  } else {
    bar([-0.24, paneBottom + 0.05, alongRear(paneBottom + 0.05) - 0.01], [0.24, paneBottom + 0.05, alongRear(paneBottom + 0.05) - 0.01], 0.012, rubber);
  }
  batchPanels(root);

  const wheels: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    for (const z of [-axle, axle]) {
      const wheel = new THREE.Group();
      wheel.name = "Wheel";
      wheel.position.set(side * (halfWidth - 0.04), WHEEL_RADIUS, z);
      const cylinder = (radius: number, depth: number, material: THREE.Material, x = 0): void => {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 24), material);
        mesh.rotation.z = Math.PI / 2;
        mesh.position.x = x;
        wheel.add(mesh);
      };
      cylinder(WHEEL_RADIUS - 0.016, 0.18, rubber);
      for (const x of [-0.033, 0.033]) {
        const sidewall = new THREE.Mesh(new THREE.TorusGeometry(0.248, 0.067, 8, 24), rubber);
        sidewall.rotation.y = Math.PI / 2;
        sidewall.position.x = x;
        wheel.add(sidewall);
      }
      cylinder(0.205, 0.194, alloy);
      cylinder(0.17, 0.20, rubber);
      for (let spoke = 0; spoke < 5; spoke += 1) {
        const arm = box(wheel, [0.023, 0.32, 0.038], [side * 0.112, 0, 0], alloy, 0.009);
        arm.rotation.x = spoke * Math.PI / 5;
      }
      cylinder(van ? 0.115 : 0.07, 0.232, alloy);
      batchPanels(wheel);
      root.add(wheel);
      wheels.push(wheel);
    }
  }
  root.userData.vehicleWheels = wheels;
  return root;
};

export const animateRoadVehicle = (vehicle: THREE.Object3D, distance: number): void => {
  const wheels = vehicle.userData.vehicleWheels as THREE.Group[] | undefined;
  wheels?.forEach((wheel) => {
    wheel.rotation.x = (wheel.rotation.x + distance / (WHEEL_RADIUS * vehicle.scale.x)) % (Math.PI * 2);
  });
};
