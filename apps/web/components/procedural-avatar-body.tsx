"use client";

import { useFrame } from "@react-three/fiber";
import type { AvatarBodySchema } from "@choosing-clothes/shared-types";
import * as THREE from "three";
import { useLayoutEffect, useMemo, useRef } from "react";

import { mapAvatarSchemaToMorphProfile } from "@/lib/avatar-schema";

type MorphMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createMorphTargetGeometry(
  baseGeometry: THREE.BufferGeometry,
  builders: Record<string, (position: THREE.Vector3, next: THREE.Vector3) => void>
) {
  const geometry = baseGeometry.clone().toNonIndexed();
  const source = geometry.getAttribute("position");

  if (!source) {
    return geometry;
  }

  geometry.morphAttributes.position = Object.entries(builders).map(([name, build]) => {
    const points: number[] = [];

    for (let index = 0; index < source.count; index += 1) {
      const base = new THREE.Vector3(source.getX(index), source.getY(index), source.getZ(index));
      const next = base.clone();
      build(base, next);
      points.push(next.x, next.y, next.z);
    }

    const attribute = new THREE.Float32BufferAttribute(points, 3);
    attribute.name = name;
    return attribute;
  });

  return geometry;
}

function dampMorphTargets(mesh: MorphMesh, targets: Record<string, number>, delta: number, smoothing = 4.8) {
  const influences = mesh.morphTargetInfluences;
  const dictionary = mesh.morphTargetDictionary;

  if (!influences || !dictionary) {
    return;
  }

  for (const [name, value] of Object.entries(targets)) {
    const index = dictionary[name];
    if (index === undefined) {
      continue;
    }

    influences[index] = THREE.MathUtils.damp(influences[index] ?? 0, value, smoothing, delta);
  }
}

export default function ProceduralAvatarBody({
  stats,
  targetRotation
}: {
  stats: AvatarBodySchema;
  targetRotation: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const neckRef = useRef<THREE.Mesh>(null);
  const chestRef = useRef<MorphMesh>(null);
  const abdomenRef = useRef<MorphMesh>(null);
  const pelvisRef = useRef<MorphMesh>(null);
  const leftUpperArmRef = useRef<THREE.Group>(null);
  const rightUpperArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const leftHandRef = useRef<THREE.Mesh>(null);
  const rightHandRef = useRef<THREE.Mesh>(null);
  const leftThighRef = useRef<THREE.Group>(null);
  const rightThighRef = useRef<THREE.Group>(null);
  const leftCalfRef = useRef<THREE.Group>(null);
  const rightCalfRef = useRef<THREE.Group>(null);
  const leftFootRef = useRef<THREE.Mesh>(null);
  const rightFootRef = useRef<THREE.Mesh>(null);

  const profile = useMemo(() => mapAvatarSchemaToMorphProfile(stats), [stats]);
  const proportions = profile.scale;

  const genderPreset = useMemo(() => {
    if (stats.baseGender === "male") {
      return { shoulderBias: 0.08, hipBias: -0.04, waistBias: 0.02 };
    }
    if (stats.baseGender === "female") {
      return { shoulderBias: -0.05, hipBias: 0.06, waistBias: -0.04 };
    }
    return { shoulderBias: 0, hipBias: 0, waistBias: 0 };
  }, [stats.baseGender]);

  const silhouette = useMemo(() => {
    const shoulderWidth = clamp(proportions.shoulderWidth + genderPreset.shoulderBias, 0.8, 1.28);
    const hipWidth = clamp(proportions.hipWidth + genderPreset.hipBias, 0.82, 1.28);
    const waistDepth = clamp(proportions.waistDepth + genderPreset.waistBias, 0.74, 1.22);

    return {
      shoulderWidth,
      hipWidth,
      waistDepth,
      chestDepth: proportions.chestDepth,
      torsoLength: clamp(proportions.bodyHeight, 0.9, 1.18),
      legLength: proportions.legLength,
      armLength: proportions.armLength,
      mass: proportions.weightScale,
      headScale: clamp(1.02 - (proportions.bodyHeight - 1) * 0.18, 0.9, 1.04)
    };
  }, [genderPreset.hipBias, genderPreset.shoulderBias, genderPreset.waistBias, proportions.armLength, proportions.bodyHeight, proportions.chestDepth, proportions.hipWidth, proportions.legLength, proportions.waistDepth, proportions.weightScale]);

  const chestGeometry = useMemo(() => {
    const base = new THREE.SphereGeometry(0.58, 32, 32);
    return createMorphTargetGeometry(base, {
      shoulderWide: (position, next) => {
        if (position.y > 0.12) {
          next.x = position.x * 1.22;
        }
      },
      chestFull: (position, next) => {
        if (position.y > -0.12) {
          next.z = position.z * 1.22;
          next.x = position.x * 1.06;
        }
      },
      waistSlim: (position, next) => {
        if (position.y < -0.05) {
          next.x = position.x * 0.82;
          next.z = position.z * 0.8;
        }
      },
      torsoTall: (position, next) => {
        next.y = position.y * 1.08;
      }
    });
  }, []);

  const abdomenGeometry = useMemo(() => {
    const base = new THREE.SphereGeometry(0.5, 32, 32);
    return createMorphTargetGeometry(base, {
      chestFull: (position, next) => {
        next.z = position.z * 1.08;
      },
      waistSlim: (position, next) => {
        next.x = position.x * 0.76;
        next.z = position.z * 0.78;
      },
      bodyMass: (position, next) => {
        next.x = position.x * 1.12;
        next.z = position.z * 1.2;
      }
    });
  }, []);

  const pelvisGeometry = useMemo(() => {
    const base = new THREE.SphereGeometry(0.54, 32, 32);
    return createMorphTargetGeometry(base, {
      hipWide: (position, next) => {
        if (position.y < 0.12) {
          next.x = position.x * 1.2;
          next.z = position.z * 1.06;
        }
      },
      legLong: (position, next) => {
        next.y = position.y * 1.04 - 0.04;
      },
      bodyMass: (position, next) => {
        next.x = position.x * 1.12;
        next.z = position.z * 1.16;
      }
    });
  }, []);

  useLayoutEffect(() => {
    chestRef.current?.updateMorphTargets();
    abdomenRef.current?.updateMorphTargets();
    pelvisRef.current?.updateMorphTargets();
  }, [abdomenGeometry, chestGeometry, pelvisGeometry]);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    const idle = Math.sin(performance.now() * 0.0012) * 0.01;
    groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetRotation, 4.2, delta);
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, -1.42, 3.2, delta);

    if (headRef.current) {
      const headScale = THREE.MathUtils.damp(headRef.current.scale.x, silhouette.headScale, 4.8, delta);
      headRef.current.position.y = THREE.MathUtils.damp(headRef.current.position.y, 2.58 * silhouette.torsoLength + idle * 0.4, 4.8, delta);
      headRef.current.scale.x = headScale;
      headRef.current.scale.y = THREE.MathUtils.damp(headRef.current.scale.y, silhouette.headScale * 1.06, 4.8, delta);
      headRef.current.scale.z = THREE.MathUtils.damp(headRef.current.scale.z, silhouette.headScale * 0.98, 4.8, delta);
    }

    if (neckRef.current) {
      neckRef.current.position.y = THREE.MathUtils.damp(neckRef.current.position.y, 2.07 * silhouette.torsoLength, 4.8, delta);
      neckRef.current.scale.x = THREE.MathUtils.damp(neckRef.current.scale.x, 0.94 + silhouette.mass * 0.06, 4.8, delta);
      neckRef.current.scale.z = THREE.MathUtils.damp(neckRef.current.scale.z, 0.94 + silhouette.mass * 0.08, 4.8, delta);
    }

    if (chestRef.current) {
      chestRef.current.position.y = THREE.MathUtils.damp(chestRef.current.position.y, 1.58 * silhouette.torsoLength, 4.8, delta);
      chestRef.current.scale.x = THREE.MathUtils.damp(chestRef.current.scale.x, 0.88 * silhouette.shoulderWidth, 4.8, delta);
      chestRef.current.scale.y = THREE.MathUtils.damp(chestRef.current.scale.y, 1.05 * silhouette.torsoLength, 4.8, delta);
      chestRef.current.scale.z = THREE.MathUtils.damp(chestRef.current.scale.z, 0.72 * silhouette.chestDepth, 4.8, delta);
      dampMorphTargets(chestRef.current, profile.torso, delta);
    }

    if (abdomenRef.current) {
      abdomenRef.current.position.y = THREE.MathUtils.damp(abdomenRef.current.position.y, 0.9 * silhouette.torsoLength, 4.8, delta);
      abdomenRef.current.scale.x = THREE.MathUtils.damp(abdomenRef.current.scale.x, 0.72 * silhouette.shoulderWidth, 4.8, delta);
      abdomenRef.current.scale.y = THREE.MathUtils.damp(abdomenRef.current.scale.y, 0.92 * silhouette.torsoLength, 4.8, delta);
      abdomenRef.current.scale.z = THREE.MathUtils.damp(abdomenRef.current.scale.z, 0.68 * silhouette.waistDepth, 4.8, delta);
      dampMorphTargets(
        abdomenRef.current,
        {
          chestFull: profile.torso.chestFull * 0.45,
          waistSlim: profile.torso.waistSlim,
          bodyMass: profile.lowerBody.bodyMass
        },
        delta
      );
    }

    if (pelvisRef.current) {
      pelvisRef.current.position.y = THREE.MathUtils.damp(pelvisRef.current.position.y, 0.14 * silhouette.torsoLength, 4.8, delta);
      pelvisRef.current.scale.x = THREE.MathUtils.damp(pelvisRef.current.scale.x, 0.82 * silhouette.hipWidth, 4.8, delta);
      pelvisRef.current.scale.y = THREE.MathUtils.damp(pelvisRef.current.scale.y, 0.72 * silhouette.torsoLength, 4.8, delta);
      pelvisRef.current.scale.z = THREE.MathUtils.damp(pelvisRef.current.scale.z, 0.8 * silhouette.mass, 4.8, delta);
      dampMorphTargets(pelvisRef.current, profile.lowerBody, delta);
    }

    const shoulderX = 0.54 * silhouette.shoulderWidth;
    const shoulderY = 1.48 * silhouette.torsoLength;
    const elbowBend = 0.18 + profile.lowerBody.bodyMass * 0.08;

    for (const [group, side] of [[leftUpperArmRef.current, -1], [rightUpperArmRef.current, 1]] as const) {
      if (!group) {
        continue;
      }
      group.position.x = THREE.MathUtils.damp(group.position.x, shoulderX * side, 4.8, delta);
      group.position.y = THREE.MathUtils.damp(group.position.y, shoulderY, 4.8, delta);
      group.rotation.z = THREE.MathUtils.damp(group.rotation.z, side * (0.24 + (1 - silhouette.shoulderWidth) * 0.04), 4.8, delta);
    }

    for (const [group, side] of [[leftForearmRef.current, -1], [rightForearmRef.current, 1]] as const) {
      if (!group) {
        continue;
      }
      group.position.y = THREE.MathUtils.damp(group.position.y, -0.7 * silhouette.armLength, 4.8, delta);
      group.rotation.z = THREE.MathUtils.damp(group.rotation.z, side * elbowBend, 4.8, delta);
    }

    for (const [mesh, side] of [[leftHandRef.current, -1], [rightHandRef.current, 1]] as const) {
      if (!mesh) {
        continue;
      }
      mesh.position.y = THREE.MathUtils.damp(mesh.position.y, -0.58 * silhouette.armLength, 4.8, delta);
      mesh.position.z = THREE.MathUtils.damp(mesh.position.z, 0.02 * side, 4.8, delta);
      mesh.scale.y = THREE.MathUtils.damp(mesh.scale.y, 1.2, 4.8, delta);
    }

    const hipX = 0.24 * silhouette.hipWidth;
    const hipY = -0.34 * silhouette.torsoLength;
    const kneeBend = 0.05 + idle * 0.8;

    for (const [group, side] of [[leftThighRef.current, -1], [rightThighRef.current, 1]] as const) {
      if (!group) {
        continue;
      }
      group.position.x = THREE.MathUtils.damp(group.position.x, hipX * side, 4.8, delta);
      group.position.y = THREE.MathUtils.damp(group.position.y, hipY, 4.8, delta);
      group.rotation.z = THREE.MathUtils.damp(group.rotation.z, side * 0.03, 4.8, delta);
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, kneeBend, 4.8, delta);
    }

    for (const group of [leftCalfRef.current, rightCalfRef.current]) {
      if (!group) {
        continue;
      }
      group.position.y = THREE.MathUtils.damp(group.position.y, -0.9 * silhouette.legLength, 4.8, delta);
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, -0.08 - kneeBend * 0.5, 4.8, delta);
    }

    for (const [mesh, side] of [[leftFootRef.current, -1], [rightFootRef.current, 1]] as const) {
      if (!mesh) {
        continue;
      }
      mesh.position.set(
        THREE.MathUtils.damp(mesh.position.x, 0.02 * side, 4.8, delta),
        THREE.MathUtils.damp(mesh.position.y, -0.52 * silhouette.legLength, 4.8, delta),
        THREE.MathUtils.damp(mesh.position.z, 0.14, 4.8, delta)
      );
      mesh.scale.x = THREE.MathUtils.damp(mesh.scale.x, 0.9 + silhouette.mass * 0.05, 4.8, delta);
      mesh.scale.z = THREE.MathUtils.damp(mesh.scale.z, 1.22, 4.8, delta);
    }
  });

  const skin = "#c8946b";
  const warmSkin = "#d7a57b";
  const coreTone = "#945b3b";
  const coreToneDark = "#7a452d";

  return (
    <group ref={groupRef} position={[0, -1.42, 0]}>
      <mesh ref={headRef} position={[0, 2.58 * silhouette.torsoLength, 0.02]} castShadow>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshStandardMaterial color={warmSkin} roughness={0.68} metalness={0.01} />
      </mesh>

      <mesh ref={neckRef} position={[0, 2.07 * silhouette.torsoLength, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.16, 10, 18]} />
        <meshStandardMaterial color={skin} roughness={0.65} metalness={0.01} />
      </mesh>

      <mesh ref={chestRef} geometry={chestGeometry} position={[0, 1.58 * silhouette.torsoLength, 0]} castShadow onUpdate={(self) => self.updateMorphTargets()}>
        <meshStandardMaterial color={coreTone} roughness={0.56} metalness={0.03} />
      </mesh>

      <mesh ref={abdomenRef} geometry={abdomenGeometry} position={[0, 0.9 * silhouette.torsoLength, 0.02]} castShadow onUpdate={(self) => self.updateMorphTargets()}>
        <meshStandardMaterial color={coreTone} roughness={0.58} metalness={0.02} />
      </mesh>

      <mesh ref={pelvisRef} geometry={pelvisGeometry} position={[0, 0.14 * silhouette.torsoLength, 0]} castShadow onUpdate={(self) => self.updateMorphTargets()}>
        <meshStandardMaterial color={coreToneDark} roughness={0.6} metalness={0.02} />
      </mesh>

      <group ref={leftUpperArmRef} position={[-0.54 * silhouette.shoulderWidth, 1.48 * silhouette.torsoLength, 0]} rotation={[0, 0, 0.24]}>
        <mesh castShadow scale={[0.94, silhouette.armLength, silhouette.mass]}>
          <capsuleGeometry args={[0.12, 0.7, 10, 18]} />
          <meshStandardMaterial color={skin} roughness={0.62} metalness={0.02} />
        </mesh>
        <group ref={leftForearmRef} position={[0, -0.7 * silhouette.armLength, 0]} rotation={[0, 0, -0.18]}>
          <mesh castShadow scale={[0.9, silhouette.armLength * 0.96, silhouette.mass * 0.94]}>
            <capsuleGeometry args={[0.1, 0.62, 10, 18]} />
            <meshStandardMaterial color={skin} roughness={0.64} metalness={0.02} />
          </mesh>
          <mesh ref={leftHandRef} position={[0, -0.58 * silhouette.armLength, 0]} castShadow>
            <sphereGeometry args={[0.11, 18, 18]} />
            <meshStandardMaterial color={warmSkin} roughness={0.66} metalness={0.01} />
          </mesh>
        </group>
      </group>

      <group ref={rightUpperArmRef} position={[0.54 * silhouette.shoulderWidth, 1.48 * silhouette.torsoLength, 0]} rotation={[0, 0, -0.24]}>
        <mesh castShadow scale={[0.94, silhouette.armLength, silhouette.mass]}>
          <capsuleGeometry args={[0.12, 0.7, 10, 18]} />
          <meshStandardMaterial color={skin} roughness={0.62} metalness={0.02} />
        </mesh>
        <group ref={rightForearmRef} position={[0, -0.7 * silhouette.armLength, 0]} rotation={[0, 0, 0.18]}>
          <mesh castShadow scale={[0.9, silhouette.armLength * 0.96, silhouette.mass * 0.94]}>
            <capsuleGeometry args={[0.1, 0.62, 10, 18]} />
            <meshStandardMaterial color={skin} roughness={0.64} metalness={0.02} />
          </mesh>
          <mesh ref={rightHandRef} position={[0, -0.58 * silhouette.armLength, 0]} castShadow>
            <sphereGeometry args={[0.11, 18, 18]} />
            <meshStandardMaterial color={warmSkin} roughness={0.66} metalness={0.01} />
          </mesh>
        </group>
      </group>

      <group ref={leftThighRef} position={[-0.24 * silhouette.hipWidth, -0.34 * silhouette.torsoLength, 0]}>
        <mesh castShadow scale={[0.96, silhouette.legLength, silhouette.mass * 1.02]}>
          <capsuleGeometry args={[0.16, 0.92, 10, 18]} />
          <meshStandardMaterial color={coreToneDark} roughness={0.62} metalness={0.02} />
        </mesh>
        <group ref={leftCalfRef} position={[0, -0.9 * silhouette.legLength, 0]} rotation={[-0.08, 0, 0]}>
          <mesh castShadow scale={[0.88, silhouette.legLength * 0.96, silhouette.mass * 0.92]}>
            <capsuleGeometry args={[0.13, 0.82, 10, 18]} />
            <meshStandardMaterial color={coreToneDark} roughness={0.64} metalness={0.02} />
          </mesh>
          <mesh ref={leftFootRef} position={[0, -0.52 * silhouette.legLength, 0.14]} castShadow scale={[0.92, 0.38, 1.22]}>
            <boxGeometry args={[0.2, 0.14, 0.42]} />
            <meshStandardMaterial color={coreToneDark} roughness={0.66} metalness={0.02} />
          </mesh>
        </group>
      </group>

      <group ref={rightThighRef} position={[0.24 * silhouette.hipWidth, -0.34 * silhouette.torsoLength, 0]}>
        <mesh castShadow scale={[0.96, silhouette.legLength, silhouette.mass * 1.02]}>
          <capsuleGeometry args={[0.16, 0.92, 10, 18]} />
          <meshStandardMaterial color={coreToneDark} roughness={0.62} metalness={0.02} />
        </mesh>
        <group ref={rightCalfRef} position={[0, -0.9 * silhouette.legLength, 0]} rotation={[-0.08, 0, 0]}>
          <mesh castShadow scale={[0.88, silhouette.legLength * 0.96, silhouette.mass * 0.92]}>
            <capsuleGeometry args={[0.13, 0.82, 10, 18]} />
            <meshStandardMaterial color={coreToneDark} roughness={0.64} metalness={0.02} />
          </mesh>
          <mesh ref={rightFootRef} position={[0, -0.52 * silhouette.legLength, 0.14]} castShadow scale={[0.92, 0.38, 1.22]}>
            <boxGeometry args={[0.2, 0.14, 0.42]} />
            <meshStandardMaterial color={coreToneDark} roughness={0.66} metalness={0.02} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
