import * as THREE from "three";

/** A small, pooled set of camera-facing air ribbons in the gap between two bikes. */
export class ThreeSlipstream {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor() {
    const segments = 40;
    const positions: number[] = [];
    const lanes: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let lane = 0; lane < 8; lane += 1) {
      const offset = positions.length / 3;
      const side = lane % 2 === 0 ? -1 : 1;
      const height = 0.32 + Math.floor(lane / 2) * 0.23;
      for (let step = 0; step <= segments; step += 1) {
        for (let edge = 0; edge < 2; edge += 1) {
          positions.push(0, 0, step / segments);
          lanes.push(side, height, lane * 0.618);
          uvs.push(step / segments, edge);
        }
        if (step < segments) {
          const i = offset + step * 2;
          indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aLane", new THREE.Float32BufferAttribute(lanes, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uLeader: { value: new THREE.Vector2() },
        uFollower: { value: new THREE.Vector2() },
        uTime: { value: 0 },
        uStrength: { value: 0 },
        uDashCount: { value: 2 },
        uColor: { value: new THREE.Color(0xe0f6ed) },
      },
      vertexShader: `
        attribute vec3 aLane;
        uniform vec2 uLeader;
        uniform vec2 uFollower;
        uniform float uTime;
        varying vec2 vUv;
        varying float vPhase;

        vec3 airPath(float t) {
          float arc = sin(t * 3.141593);
          vec2 center = mix(uLeader, uFollower, vec2(smoothstep(0.0, 1.0, t), t));
          float spread = mix(0.28, 0.62, t) + arc * 0.18;
          float curl = sin(t * 12.0 + aLane.z * 6.28 - uTime * 0.5) * arc * 0.04;
          return vec3(center.x + aLane.x * (spread + curl), aLane.y + arc * 0.1, center.y);
        }

        void main() {
          vUv = uv;
          vPhase = aLane.z;
          vec3 center = airPath(uv.x);
          vec3 tangent = normalize(airPath(uv.x + 0.001) - airPath(uv.x - 0.001));
          vec3 across = normalize(cross(tangent, cameraPosition - center));
          float width = 0.023 + sin(uv.x * 3.141593) * 0.012;
          vec3 point = center + across * (uv.y * 2.0 - 1.0) * width;
          gl_Position = projectionMatrix * viewMatrix * vec4(point, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uStrength;
        uniform float uDashCount;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying float vPhase;

        void main() {
          // The bright tip travels from the leader toward the following rider.
          float pulse = fract(vUv.x * uDashCount - uTime + vPhase);
          float streak = smoothstep(0.0, 0.07, pulse) * (1.0 - smoothstep(0.12, 0.5, pulse));
          float ends = smoothstep(0.0, 0.09, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));
          float edges = 1.0 - smoothstep(0.15, 1.0, abs(vUv.y * 2.0 - 1.0));
          float alpha = (0.045 + streak * 0.68) * ends * edges * uStrength;
          gl_FragColor = vec4(uColor, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = "Draft airflow";
    // The path is positioned in world space by the shader.
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  update(
    delta: number,
    speed: number,
    leader: THREE.Vector3 | null,
    follower: THREE.Vector3,
    strength: number,
  ): void {
    const uniforms = this.mesh.material.uniforms;
    const gap = leader ? follower.z - leader.z : 0;
    const active = leader !== null && gap > 1.5 && speed > 0 && strength > 0;
    const target = active ? THREE.MathUtils.clamp(strength, 0, 1) : 0;
    uniforms.uStrength.value = THREE.MathUtils.lerp(
      uniforms.uStrength.value,
      target,
      1 - Math.exp(-delta * (active ? 6 : 9)),
    );
    this.mesh.visible = uniforms.uStrength.value > 0.01;
    if (!this.mesh.visible) return;
    uniforms.uTime.value += delta * (0.85 + speed * 0.035);
    if (active) {
      uniforms.uLeader.value.set(leader.x, leader.z + 0.65);
      uniforms.uFollower.value.set(follower.x, follower.z - 0.65);
      uniforms.uDashCount.value = THREE.MathUtils.clamp((gap - 1.3) * 0.3, 1, 3);
    }
  }

  reset(): void {
    this.mesh.visible = false;
    this.mesh.material.uniforms.uStrength.value = 0;
    this.mesh.material.uniforms.uTime.value = 0;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
