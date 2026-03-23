import type { AvatarBodySchema } from "@choosing-clothes/shared-types";
import * as THREE from "three";

import { mapAvatarSchemaToMorphProfile } from "@/lib/avatar-schema";

export type AvatarBodyModelStatus = "loading" | "ready" | "missing" | "error" | "fallback";

export interface AvatarBodyModelManifest {
  modelUrl: string;
  referenceHeightCm: number;
  rootOffsetY: number;
  rootRotationY: number;
  morphMap: {
    torso: Record<string, string[]>;
    lowerBody: Record<string, string[]>;
  };
  boneMap: {
    upperArmL: string[];
    upperArmR: string[];
    forearmL: string[];
    forearmR: string[];
    thighL: string[];
    thighR: string[];
    calfL: string[];
    calfR: string[];
    spine: string[];
    hips: string[];
  };
}

export const defaultAvatarBodyModelManifest: AvatarBodyModelManifest = {
  modelUrl: "/models/avatar-body/base.glb",
  referenceHeightCm: 172,
  rootOffsetY: -0.8587,
  rootRotationY: 0,
  morphMap: {
    torso: {
      shoulderWide: ["shoulderWide", "ShoulderWidth", "torso_shoulder_wide"],
      chestFull: ["chestFull", "ChestDepth", "torso_chest_full"],
      waistSlim: ["waistSlim", "WaistNarrow", "torso_waist_slim"],
      torsoTall: ["torsoTall", "TorsoLength", "torso_tall"]
    },
    lowerBody: {
      hipWide: ["hipWide", "HipWidth", "hips_wide"],
      legLong: ["legLong", "LegLength", "legs_long"],
      bodyMass: ["bodyMass", "BodyMass", "body_mass"]
    }
  },
  boneMap: {
    upperArmL: ["upperarm_l", "UpperArm_L", "LeftArm"],
    upperArmR: ["upperarm_r", "UpperArm_R", "RightArm"],
    forearmL: ["lowerarm_l", "ForeArm_L", "LeftForeArm"],
    forearmR: ["lowerarm_r", "ForeArm_R", "RightForeArm"],
    thighL: ["thigh_l", "Thigh_L", "LeftUpLeg"],
    thighR: ["thigh_r", "Thigh_R", "RightUpLeg"],
    calfL: ["calf_l", "Calf_L", "LeftLeg"],
    calfR: ["calf_r", "Calf_R", "RightLeg"],
    spine: ["spine_02", "Spine2", "Spine"],
    hips: ["pelvis", "Hips", "hips"]
  }
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, x: number) {
  if (edge0 === edge1) {
    return x < edge0 ? 0 : 1;
  }

  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function bandWeight(y: number, start: number, peak: number, end: number) {
  if (y <= start || y >= end) {
    return 0;
  }

  if (y <= peak) {
    return smoothstep(start, peak, y);
  }

  return 1 - smoothstep(peak, end, y);
}

function applyNamedMorphs(mesh: THREE.Mesh, names: string[], value: number) {
  if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) {
    return;
  }

  for (const name of names) {
    const index = mesh.morphTargetDictionary[name];
    if (index === undefined) {
      continue;
    }
    mesh.morphTargetInfluences[index] = value;
  }
}

function findBone(root: THREE.Object3D, candidates: string[]): THREE.Object3D | null {
  let resolved: THREE.Bone | null = null;
  root.traverse((child) => {
    if (resolved || !(child instanceof THREE.Bone)) {
      return;
    }
    if (candidates.includes(child.name)) {
      resolved = child;
    }
  });
  return resolved;
}

function deformStaticMeshGeometry(mesh: THREE.Mesh, profile: ReturnType<typeof mapAvatarSchemaToMorphProfile>) {
  const sourceGeometry = mesh.geometry;
  const sourcePosition = sourceGeometry.getAttribute("position");
  if (!sourcePosition) {
    return;
  }

  if (!mesh.userData.detachedGeometry) {
    mesh.geometry = sourceGeometry.clone();
    mesh.userData.detachedGeometry = true;
  }

  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!position) {
    return;
  }

  if (!geometry.userData.basePositions) {
    geometry.userData.basePositions = Float32Array.from(position.array as ArrayLike<number>);
  }

  const basePositions = geometry.userData.basePositions as Float32Array;
  if (!geometry.userData.bounds) {
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;

    for (let index = 1; index < basePositions.length; index += 3) {
      const y = basePositions[index];
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }

    geometry.userData.bounds = { yMin, yMax };
  }

  const { yMin, yMax } = geometry.userData.bounds as { yMin: number; yMax: number };
  const yRange = Math.max(yMax - yMin, 1e-5);

  const shoulderScale = 0.94 + profile.torso.shoulderWide * 0.24;
  const chestWidthScale = 0.96 + profile.torso.chestFull * 0.16;
  const chestDepthScale = 0.94 + profile.torso.chestFull * 0.22;
  const waistWidthScale = 1.02 - profile.torso.waistSlim * 0.2 + profile.lowerBody.bodyMass * 0.04;
  const waistDepthScale = 1 - profile.torso.waistSlim * 0.18 + profile.lowerBody.bodyMass * 0.08;
  const hipWidthScale = 0.96 + profile.lowerBody.hipWide * 0.22;
  const hipDepthScale = 0.96 + profile.lowerBody.bodyMass * 0.16;
  const armThicknessScale = 0.96 + profile.scale.weightScale * 0.08;
  const legThicknessScale = 0.95 + profile.lowerBody.bodyMass * 0.12 + profile.lowerBody.hipWide * 0.04;
  const torsoVerticalScale = 0.94 + profile.scale.bodyHeight * 0.1;
  const legVerticalScale = 0.92 + profile.scale.legLength * 0.14;

  for (let index = 0; index < basePositions.length; index += 3) {
    const x = basePositions[index];
    const y = basePositions[index + 1];
    const z = basePositions[index + 2];
    const normalizedY = (y - yMin) / yRange;

    const shoulderWeight = bandWeight(normalizedY, 0.68, 0.8, 0.92);
    const chestWeight = bandWeight(normalizedY, 0.52, 0.66, 0.8);
    const waistWeight = bandWeight(normalizedY, 0.36, 0.48, 0.62);
    const hipWeight = bandWeight(normalizedY, 0.2, 0.32, 0.48);
    const legWeight = 1 - smoothstep(0.34, 0.54, normalizedY);
    const armWeight = smoothstep(0.32, 0.68, normalizedY) * smoothstep(0.16, 0.55, Math.abs(x));

    const widthScale =
      1 +
      shoulderWeight * (shoulderScale - 1) +
      chestWeight * (chestWidthScale - 1) +
      waistWeight * (waistWidthScale - 1) +
      hipWeight * (hipWidthScale - 1) +
      legWeight * (legThicknessScale - 1) * 0.55 +
      armWeight * (armThicknessScale - 1) * 0.9;

    const depthScale =
      1 +
      shoulderWeight * (chestDepthScale - 1) * 0.35 +
      chestWeight * (chestDepthScale - 1) +
      waistWeight * (waistDepthScale - 1) +
      hipWeight * (hipDepthScale - 1) +
      legWeight * (legThicknessScale - 1) * 0.4 +
      armWeight * (armThicknessScale - 1) * 0.6;

    const verticalScale = torsoVerticalScale * (1 - legWeight) + legVerticalScale * legWeight;

    position.setXYZ(index / 3, x * widthScale, yMin + (y - yMin) * verticalScale, z * depthScale);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function applyAvatarSchemaToBodyModel(
  root: THREE.Object3D,
  stats: AvatarBodySchema,
  manifest: AvatarBodyModelManifest = defaultAvatarBodyModelManifest
) {
  const profile = mapAvatarSchemaToMorphProfile(stats);
  const heightScale = stats.heightCm / manifest.referenceHeightCm;
  const massScale = 0.92 + profile.scale.weightScale * 0.12;
  let hasBones = false;

  root.scale.setScalar(1);
  // The scene wrapper controls world placement. Keep the loaded GLB centered here
  // so we don't apply the vertical offset twice and push the model out of frame.
  root.position.y = 0;
  root.rotation.y = manifest.rootRotationY;

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      applyNamedMorphs(mesh, manifest.morphMap.torso.shoulderWide, profile.torso.shoulderWide);
      applyNamedMorphs(mesh, manifest.morphMap.torso.chestFull, profile.torso.chestFull);
      applyNamedMorphs(mesh, manifest.morphMap.torso.waistSlim, profile.torso.waistSlim);
      applyNamedMorphs(mesh, manifest.morphMap.torso.torsoTall, profile.torso.torsoTall);
      applyNamedMorphs(mesh, manifest.morphMap.lowerBody.hipWide, profile.lowerBody.hipWide);
      applyNamedMorphs(mesh, manifest.morphMap.lowerBody.legLong, profile.lowerBody.legLong);
      applyNamedMorphs(mesh, manifest.morphMap.lowerBody.bodyMass, profile.lowerBody.bodyMass);

      if (!mesh.morphTargetDictionary) {
        deformStaticMeshGeometry(mesh, profile);
      }
    }
  });

  const spine = findBone(root, manifest.boneMap.spine);
  if (spine) {
    hasBones = true;
    spine.scale.y = 0.96 + profile.scale.bodyHeight * 0.08;
    spine.scale.x = 0.96 + profile.scale.chestDepth * 0.04;
    spine.scale.z = 0.96 + profile.scale.chestDepth * 0.06;
  }

  const hips = findBone(root, manifest.boneMap.hips);
  if (hips) {
    hasBones = true;
    hips.scale.x = 0.96 + profile.scale.hipWidth * 0.08;
    hips.scale.z = 0.94 + massScale * 0.08;
  }

  for (const key of ["upperArmL", "upperArmR", "forearmL", "forearmR"] as const) {
    const bone = findBone(root, manifest.boneMap[key]);
    if (bone) {
      hasBones = true;
      bone.scale.y = 0.94 + profile.scale.armLength * 0.08;
      bone.scale.x = 0.94 + massScale * 0.04;
      bone.scale.z = 0.94 + massScale * 0.04;
    }
  }

  for (const key of ["thighL", "thighR", "calfL", "calfR"] as const) {
    const bone = findBone(root, manifest.boneMap[key]);
    if (bone) {
      hasBones = true;
      bone.scale.y = 0.94 + profile.scale.legLength * 0.1;
      bone.scale.x = 0.94 + massScale * 0.05;
      bone.scale.z = 0.94 + massScale * 0.05;
    }
  }

  if (hasBones) {
    root.scale.setScalar(heightScale);
  }
}

export function getAvatarBodyModelStatusLabel(status: AvatarBodyModelStatus) {
  switch (status) {
    case "ready":
      return "Real GLB Body";
    case "loading":
      return "Loading GLB Body";
    case "missing":
      return "GLB Missing, Using Fallback";
    case "error":
      return "GLB Load Error, Using Fallback";
    default:
      return "Procedural Fallback Body";
  }
}
