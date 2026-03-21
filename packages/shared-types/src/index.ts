export type TryOnJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export type GarmentCategory = "tshirt" | "shirt" | "dress" | "pants" | "unknown";

export type GarmentStatus = "uploaded" | "parsing" | "ready" | "failed";

export type AvatarBaseGender = "female" | "male" | "neutral";

export interface AvatarSummary {
  id: string;
  name: string;
  baseGender: AvatarBaseGender;
  heightCm: number;
}

export interface AvatarMorphParams {
  bodyFat: number;
  muscle: number;
  torsoScale: number;
}

export interface AvatarBodySchema {
  name: string;
  baseGender: AvatarBaseGender;
  heightCm: number;
  weightKg: number;
  shoulderCm: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
  legLengthCm: number;
  armLengthCm: number;
  morphParams?: Partial<AvatarMorphParams>;
}

export type TorsoMorphTargetName = "shoulderWide" | "chestFull" | "waistSlim" | "torsoTall";

export type LowerBodyMorphTargetName = "hipWide" | "legLong" | "bodyMass";

export interface AvatarBodyScaleProfile {
  bodyHeight: number;
  shoulderWidth: number;
  chestDepth: number;
  waistDepth: number;
  hipWidth: number;
  armLength: number;
  legLength: number;
  weightScale: number;
}

export interface AvatarMorphProfile {
  scale: AvatarBodyScaleProfile;
  torso: Record<TorsoMorphTargetName, number>;
  lowerBody: Record<LowerBodyMorphTargetName, number>;
}

export interface GarmentSummary {
  id: string;
  name: string;
  category: GarmentCategory;
  imageUrl: string;
  status: GarmentStatus;
}

export interface GarmentCreateInput {
  name: string;
  category: GarmentCategory;
  imageUrl: string;
}

export interface Garment extends GarmentSummary {
  parsedMeta: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}
