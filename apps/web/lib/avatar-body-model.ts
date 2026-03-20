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
  rootOffsetY: -1.48,
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

export function applyAvatarSchemaToBodyModel(
  root: THREE.Object3D,
  stats: AvatarBodySchema,
  manifest: AvatarBodyModelManifest = defaultAvatarBodyModelManifest
) {
  const profile = mapAvatarSchemaToMorphProfile(stats);
  const heightScale = stats.heightCm / manifest.referenceHeightCm;
  const massScale = 0.92 + profile.scale.weightScale * 0.12;

  root.scale.setScalar(heightScale);
  root.position.y = manifest.rootOffsetY;
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
    }
  });

  const spine = findBone(root, manifest.boneMap.spine);
  if (spine) {
    spine.scale.y = 0.96 + profile.scale.bodyHeight * 0.08;
    spine.scale.x = 0.96 + profile.scale.chestDepth * 0.04;
    spine.scale.z = 0.96 + profile.scale.chestDepth * 0.06;
  }

  const hips = findBone(root, manifest.boneMap.hips);
  if (hips) {
    hips.scale.x = 0.96 + profile.scale.hipWidth * 0.08;
    hips.scale.z = 0.94 + massScale * 0.08;
  }

  for (const key of ["upperArmL", "upperArmR", "forearmL", "forearmR"] as const) {
    const bone = findBone(root, manifest.boneMap[key]);
    if (bone) {
      bone.scale.y = 0.94 + profile.scale.armLength * 0.08;
      bone.scale.x = 0.94 + massScale * 0.04;
      bone.scale.z = 0.94 + massScale * 0.04;
    }
  }

  for (const key of ["thighL", "thighR", "calfL", "calfR"] as const) {
    const bone = findBone(root, manifest.boneMap[key]);
    if (bone) {
      bone.scale.y = 0.94 + profile.scale.legLength * 0.1;
      bone.scale.x = 0.94 + massScale * 0.05;
      bone.scale.z = 0.94 + massScale * 0.05;
    }
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
