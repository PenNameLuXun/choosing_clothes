"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useRef, useMemo, useEffect, Suspense, Component } from "react";
import type { ReactNode } from "react";
import { TextureLoader } from "three";
import type { GarmentCategory } from "@choosing-clothes/shared-types";

// ── ErrorBoundary for texture load failures ────────────────────────────────
class TextureErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ── 体模坐标系 ─────────────────────────────────────────────────────────────
// Local space: 脚底≈0，骨盆≈0.94，腰≈1.02，胸≈1.22，肩≈1.40，头顶≈1.72
// rootOffsetY=-0.8587，即 world_y = local_y + (-0.8587)
const ROOT_OFFSET_Y = -0.8587;

// 各类别服装在 local space 的 Y 覆盖范围
// uHalfWidth: 水平 UV 覆盖半宽 —— T-pose 下肩≈±0.20，肘≈±0.40，腕≈±0.58
const CLOTHING_LOCAL_Y: Record<GarmentCategory, { yMin: number; yMax: number; uHalfWidth: number }> = {
  tshirt:  { yMin: 0.93, yMax: 1.42, uHalfWidth: 0.44 },  // 短袖到肘
  shirt:   { yMin: 0.78, yMax: 1.42, uHalfWidth: 0.60 },  // 长袖到腕
  dress:   { yMin: 0.22, yMax: 1.42, uHalfWidth: 0.28 },  // 裙子躯干宽
  pants:   { yMin: 0.03, yMax: 1.06, uHalfWidth: 0.24 },  // 裤子腰胯宽
  unknown: { yMin: 0.78, yMax: 1.42, uHalfWidth: 0.44 },
};

// 服装占位色
const FALLBACK_COLOR: Record<GarmentCategory, string> = {
  tshirt:  "#8ab4d8",
  shirt:   "#a8d8a8",
  dress:   "#d8a8c0",
  pants:   "#c4b89a",
  unknown: "#c0bebe",
};

// ── 从 bodyScene 构建法线偏移几何体 ──────────────────────────────────────
// 返回 local space 下体模轮廓外扩 OFFSET 的全身网格，并附加前视 UV
function buildConformedGeo(
  bodyScene: THREE.Group,
  category: GarmentCategory,
  offsetM = 0.0065,
): THREE.BufferGeometry | null {
  // 找第一个 Mesh（SkinnedMesh 也是 Mesh 的子类）
  let mesh: THREE.Mesh | null = null;
  bodyScene.traverse((child) => {
    if (!mesh && child instanceof THREE.Mesh) mesh = child as THREE.Mesh;
  });
  if (!mesh) return null;

  const geo = mesh.geometry;
  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const count = posAttr.count;

  // 1. 复制基础位置
  const posArr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    posArr[i * 3]     = posAttr.getX(i);
    posArr[i * 3 + 1] = posAttr.getY(i);
    posArr[i * 3 + 2] = posAttr.getZ(i);
  }

  // 2. 叠加 morph target 影响（delta-based）
  const morphPosAttrs = geo.morphAttributes?.position as THREE.BufferAttribute[] | undefined;
  const influences = (mesh instanceof THREE.SkinnedMesh ? mesh.morphTargetInfluences : null) ?? [];
  if (morphPosAttrs && influences.length > 0) {
    for (let m = 0; m < morphPosAttrs.length; m++) {
      const inf = influences[m] ?? 0;
      if (Math.abs(inf) < 0.001) continue;
      const ma = morphPosAttrs[m];
      for (let i = 0; i < count; i++) {
        posArr[i * 3]     += ma.getX(i) * inf;
        posArr[i * 3 + 1] += ma.getY(i) * inf;
        posArr[i * 3 + 2] += ma.getZ(i) * inf;
      }
    }
  }

  // 3. 用有效位置计算法线
  const tmpGeo = new THREE.BufferGeometry();
  tmpGeo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
  if (geo.index) tmpGeo.setIndex(geo.index.clone());
  tmpGeo.computeVertexNormals();
  const normAttr = tmpGeo.attributes.normal as THREE.BufferAttribute;

  // 4. 沿法线外扩，同时计算前视投影 UV
  const { yMin, yMax, uHalfWidth } = CLOTHING_LOCAL_Y[category];
  const ySpan  = yMax - yMin;
  const uWidth = uHalfWidth * 2;
  const newPos = new Float32Array(count * 3);
  const uvArr  = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    const px = posArr[i * 3];
    const py = posArr[i * 3 + 1];
    const pz = posArr[i * 3 + 2];
    const nx = normAttr.getX(i);
    const ny = normAttr.getY(i);
    const nz = normAttr.getZ(i);

    newPos[i * 3]     = px + nx * offsetM;
    newPos[i * 3 + 1] = py + ny * offsetM;
    newPos[i * 3 + 2] = pz + nz * offsetM;

    // 前视 UV：前方 +Z，图片左边=体模左（x 负方向）
    // uHalfWidth 按类别覆盖到袖口/裙摆，arm 区 UV 不再越界
    uvArr[i * 2]     = (px + uHalfWidth) / uWidth;    // 横向：0=左袖端 1=右袖端
    uvArr[i * 2 + 1] = 1 - (py - yMin) / ySpan;       // 纵向：0=领口 1=衣底
  }

  const newGeo = new THREE.BufferGeometry();
  newGeo.setAttribute("position", new THREE.BufferAttribute(newPos, 3));
  newGeo.setAttribute("uv",       new THREE.BufferAttribute(uvArr, 2));
  if (geo.index) newGeo.setIndex(geo.index.clone());
  newGeo.computeVertexNormals();
  return newGeo;
}

// ── 构建裁剪平面（world space）────────────────────────────────────────────
function makeClipPlanes(category: GarmentCategory): THREE.Plane[] {
  const { yMin, yMax } = CLOTHING_LOCAL_Y[category];
  const yMinW = yMin + ROOT_OFFSET_Y;
  const yMaxW = yMax + ROOT_OFFSET_Y;
  return [
    // 保留 y >= yMinW
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -yMinW),
    // 保留 y <= yMaxW
    new THREE.Plane(new THREE.Vector3(0, -1, 0), yMaxW),
  ];
}

// ── 渲染核心：旋转同步 + localClipping 开启 ──────────────────────────────
function ConformedMesh({
  geo,
  material,
  targetRotation,
}: {
  geo: THREE.BufferGeometry;
  material: THREE.Material;
  targetRotation: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { gl } = useThree();

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y, targetRotation, 4.2, delta,
    );
  });

  return (
    <group ref={groupRef} position={[0, ROOT_OFFSET_Y, 0]}>
      <mesh geometry={geo} material={material} renderOrder={1} />
    </group>
  );
}

// ── 带纹理的贴合服装（Suspense 内调用 useLoader）────────────────────────
function ConformedWithTexture({
  bodyScene,
  imageUrl,
  category,
  targetRotation,
}: {
  bodyScene: THREE.Group;
  imageUrl: string;
  category: GarmentCategory;
  targetRotation: number;
}) {
  const tex = useLoader(TextureLoader, imageUrl);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  const clipPlanes = useMemo(() => makeClipPlanes(category), [category]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        roughness: 0.60,
        metalness: 0.02,
        clippingPlanes: clipPlanes,
      }),
    [tex, clipPlanes],
  );

  const geo = useMemo(
    () => buildConformedGeo(bodyScene, category),
    [bodyScene, category],
  );
  if (!geo) return null;

  return <ConformedMesh geo={geo} material={material} targetRotation={targetRotation} />;
}

// ── 纯色贴合服装（无纹理时的占位）────────────────────────────────────────
function ConformedFallback({
  bodyScene,
  category,
  targetRotation,
}: {
  bodyScene: THREE.Group;
  category: GarmentCategory;
  targetRotation: number;
}) {
  const clipPlanes = useMemo(() => makeClipPlanes(category), [category]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(FALLBACK_COLOR[category]),
        transparent: true,
        depthWrite: false,
        opacity: 0.50,
        side: THREE.FrontSide,
        clippingPlanes: clipPlanes,
      }),
    [category, clipPlanes],
  );

  const geo = useMemo(
    () => buildConformedGeo(bodyScene, category),
    [bodyScene, category],
  );
  if (!geo) return null;

  return <ConformedMesh geo={geo} material={material} targetRotation={targetRotation} />;
}

// ── 体模未加载时的圆柱占位（保留作后备）─────────────────────────────────
type SegmentCfg = { cy: number; h: number; rx: number; rz: number };
const CYLINDER_CFG: Record<GarmentCategory, { torso: SegmentCfg }> = {
  tshirt:  { torso: { cy: 0.28, h: 0.48, rx: 0.245, rz: 0.145 } },
  shirt:   { torso: { cy: 0.22, h: 0.62, rx: 0.240, rz: 0.143 } },
  dress:   { torso: { cy: -0.10, h: 1.10, rx: 0.250, rz: 0.148 } },
  pants:   { torso: { cy: -0.08, h: 0.70, rx: 0.230, rz: 0.138 } },
  unknown: { torso: { cy: 0.20, h: 0.56, rx: 0.240, rz: 0.145 } },
};

function makeEllipseCylinder(rx: number, rz: number, h: number) {
  const g = new THREE.CylinderGeometry(1, 1, h, 32, 1, true);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    p.setX(i, p.getX(i) * rx);
    p.setZ(i, p.getZ(i) * rz);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function CylinderFallback({
  category,
  targetRotation,
}: {
  category: GarmentCategory;
  targetRotation: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const cfg = CYLINDER_CFG[category] ?? CYLINDER_CFG.unknown;
  const geo = useMemo(
    () => makeEllipseCylinder(cfg.torso.rx, cfg.torso.rz, cfg.torso.h),
    [cfg.torso.rx, cfg.torso.rz, cfg.torso.h],
  );
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(FALLBACK_COLOR[category]),
        transparent: true,
        depthWrite: false,
        opacity: 0.45,
        side: THREE.FrontSide,
      }),
    [category],
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y, targetRotation, 4.2, delta,
    );
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, cfg.torso.cy, 0]} geometry={geo} material={mat} renderOrder={1} />
    </group>
  );
}

// ── 公开导出的主组件 ──────────────────────────────────────────────────────
export default function GarmentBody({
  category,
  targetRotation,
  imageUrl,
  bodyScene,
}: {
  category: GarmentCategory;
  targetRotation: number;
  imageUrl?: string;
  bodyScene?: THREE.Group | null;
}) {
  const fallback = bodyScene
    ? <ConformedFallback bodyScene={bodyScene} category={category} targetRotation={targetRotation} />
    : <CylinderFallback category={category} targetRotation={targetRotation} />;

  if (bodyScene && imageUrl) {
    return (
      <TextureErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <ConformedWithTexture
            bodyScene={bodyScene}
            imageUrl={imageUrl}
            category={category}
            targetRotation={targetRotation}
          />
        </Suspense>
      </TextureErrorBoundary>
    );
  }

  return fallback;
}
