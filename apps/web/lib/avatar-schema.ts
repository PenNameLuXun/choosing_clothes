import type {
  AvatarBodySchema,
  AvatarMorphProfile,
  LowerBodyMorphTargetName,
  TorsoMorphTargetName
} from "@choosing-clothes/shared-types";

const TORSO_MORPH_TARGETS: TorsoMorphTargetName[] = ["shoulderWide", "chestFull", "waistSlim", "torsoTall"];
const LOWER_BODY_MORPH_TARGETS: LowerBodyMorphTargetName[] = ["hipWide", "legLong", "bodyMass"];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: number, min: number, max: number) {
  return clamp((value - min) / (max - min), 0, 1);
}

export function getTorsoMorphTargets() {
  return TORSO_MORPH_TARGETS;
}

export function getLowerBodyMorphTargets() {
  return LOWER_BODY_MORPH_TARGETS;
}

export function mapAvatarSchemaToMorphProfile(schema: AvatarBodySchema): AvatarMorphProfile {
  const bodyFat = schema.morphParams?.bodyFat ?? 0.3;
  const muscle = schema.morphParams?.muscle ?? 0.2;
  const torsoScale = schema.morphParams?.torsoScale ?? 1;

  const scale = {
    bodyHeight: clamp((schema.heightCm / 175) * torsoScale, 0.88, 1.2),
    shoulderWidth: clamp(schema.shoulderCm / 44 + muscle * 0.08, 0.82, 1.26),
    chestDepth: clamp(schema.chestCm / 96 + bodyFat * 0.04 + muscle * 0.03, 0.82, 1.22),
    waistDepth: clamp(schema.waistCm / 78 + bodyFat * 0.1 - muscle * 0.03, 0.78, 1.24),
    hipWidth: clamp(schema.hipCm / 98 + bodyFat * 0.05, 0.82, 1.24),
    armLength: clamp(schema.armLengthCm / 58, 0.82, 1.18),
    legLength: clamp(schema.legLengthCm / 102, 0.84, 1.22),
    weightScale: clamp(schema.weightKg / 68 + bodyFat * 0.08 - muscle * 0.04, 0.78, 1.2)
  };

  return {
    scale,
    torso: {
      shoulderWide: normalize(scale.shoulderWidth, 0.82, 1.26),
      chestFull: normalize(scale.chestDepth, 0.82, 1.22),
      waistSlim: normalize(1.24 - scale.waistDepth, 0, 0.46),
      torsoTall: normalize(scale.bodyHeight, 0.88, 1.2)
    },
    lowerBody: {
      hipWide: normalize(scale.hipWidth, 0.82, 1.24),
      legLong: normalize(scale.legLength, 0.84, 1.22),
      bodyMass: normalize(scale.weightScale, 0.78, 1.2)
    }
  };
}
