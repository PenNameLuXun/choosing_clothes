"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { AvatarBodySchema } from "@choosing-clothes/shared-types";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

import ProceduralAvatarBody from "@/components/procedural-avatar-body";
import RealAvatarBody from "@/components/real-avatar-body";
import {
  defaultAvatarBodyModelManifest,
  getAvatarBodyModelStatusLabel,
  type AvatarBodyModelStatus
} from "@/lib/avatar-body-model";

type ViewMode = "front" | "side";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function CameraRig({
  cameraDistance,
  targetY,
  frameHeight,
  panX,
  panY
}: {
  cameraDistance: number;
  targetY: number;
  frameHeight: number;
  panX: number;
  panY: number;
}) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const elevatedY = targetY + frameHeight * 0.08 + panY;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, panX, 5, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, elevatedY, 5, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraDistance, 5, delta);
    camera.lookAt(panX, targetY + panY, 0);
  });

  return null;
}

function ViewerScene({
  stats,
  targetRotation,
  cameraDistance,
  frameTargetY,
  frameHeight,
  panX,
  panY,
  onModelStatusChange,
  onModelBoundsChange
}: {
  stats: AvatarBodySchema;
  targetRotation: number;
  cameraDistance: number;
  frameTargetY: number;
  frameHeight: number;
  panX: number;
  panY: number;
  onModelStatusChange: (status: AvatarBodyModelStatus) => void;
  onModelBoundsChange: (payload: { centerY: number; height: number; width: number }) => void;
}) {
  return (
    <Canvas className="viewer-canvas" camera={{ position: [0, 0.55, cameraDistance], fov: 24 }} shadows dpr={[1, 1.75]}>
      <color attach="background" args={["#f7efe5"]} />
      <fog attach="fog" args={["#f7efe5", 5.2, 9.4]} />
      <hemisphereLight intensity={1.45} color="#fff5e9" groundColor="#c59c7a" />
      <directionalLight castShadow intensity={1.4} position={[3.5, 6.4, 4.6]} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight intensity={0.45} position={[-2.4, 2.8, 2.4]} color="#ffd4b2" />
      <spotLight intensity={0.4} position={[0, 5, -3]} angle={0.38} penumbra={0.8} color="#fff0df" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.25, 0]} receiveShadow>
        <circleGeometry args={[4.4, 64]} />
        <meshStandardMaterial color="#dcc1aa" roughness={0.92} metalness={0.02} />
      </mesh>

      <CameraRig
        cameraDistance={cameraDistance}
        targetY={frameTargetY}
        frameHeight={frameHeight}
        panX={panX}
        panY={panY}
      />
      <RealAvatarBody
        stats={stats}
        targetRotation={targetRotation}
        manifest={defaultAvatarBodyModelManifest}
        onStatusChange={onModelStatusChange}
        onBoundsChange={onModelBoundsChange}
        fallback={<ProceduralAvatarBody stats={stats} targetRotation={targetRotation} />}
      />
    </Canvas>
  );
}

export default function AvatarViewerPlaceholder({ stats }: { stats: AvatarBodySchema }) {
  const [rotation, setRotation] = useState(0.12);
  const [viewMode, setViewMode] = useState<ViewMode>("front");
  const [cameraDistance, setCameraDistance] = useState(5.8);
  const [frameTargetY, setFrameTargetY] = useState(0.82);
  const [frameHeight, setFrameHeight] = useState(1.7);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [modelStatus, setModelStatus] = useState<AvatarBodyModelStatus>("fallback");
  const dragStateRef = useRef<{
    pointerId: number | null;
    button: number;
    startX: number;
    startY: number;
    startRotation: number;
    startPanX: number;
    startPanY: number;
  }>({
    pointerId: null,
    button: 0,
    startX: 0,
    startY: 0,
    startRotation: 0,
    startPanX: 0,
    startPanY: 0
  });
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCameraDistance(5.8);
    setFrameTargetY(0.82);
    setFrameHeight(1.7);
    setPanX(0);
    setPanY(0);
  }, [stats.name]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault();
      zoomBy(event.deltaY * 0.0035);
    }

    stage.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", handleNativeWheel);
    };
  }, []);

  const targetRotation = viewMode === "side" ? Math.PI / 2 + rotation : rotation;
  const bodyProfile = `${stats.heightCm} cm · ${stats.weightKg} kg`;
  const zoomPercent = Math.round(((6.8 - cameraDistance) / (6.8 - 3.2)) * 100);

  function zoomBy(delta: number) {
    setCameraDistance((value) => clamp(value + delta, 3.2, 6.8));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragStateRef.current = {
      pointerId: event.pointerId,
      button: event.button,
      startX: event.clientX,
      startY: event.clientY,
      startRotation: rotation,
      startPanX: panX,
      startPanY: panY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragStateRef.current.startX;
    const deltaY = event.clientY - dragStateRef.current.startY;

    if (dragStateRef.current.button === 1) {
      setPanX(dragStateRef.current.startPanX - deltaX * 0.0045);
      setPanY(dragStateRef.current.startPanY + deltaY * 0.0045);
      return;
    }

    setRotation(dragStateRef.current.startRotation + deltaX * 0.012);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current.pointerId === event.pointerId) {
      dragStateRef.current.pointerId = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleModelBoundsChange(payload: { centerY: number; height: number; width: number }) {
    const targetY = payload.centerY;
    const framedDistance = clamp(Math.max(payload.height * 2.15, payload.width * 2.8), 3.6, 6.8);
    setFrameTargetY(targetY);
    setFrameHeight(payload.height);
    setCameraDistance((current) => (Math.abs(current - 5.8) < 0.001 ? framedDistance : current));
  }

  return (
    <div className="viewer-shell">
      <div className="viewer-toolbar">
        <button className="viewer-button" type="button" onClick={() => setRotation((value) => value - 0.18)}>
          Rotate Left
        </button>
        <button className="viewer-button" type="button" onClick={() => setRotation((value) => value + 0.18)}>
          Rotate Right
        </button>
        <button className="viewer-button secondary" type="button" onClick={() => zoomBy(0.45)}>
          Zoom Out
        </button>
        <button className="viewer-button secondary" type="button" onClick={() => zoomBy(-0.45)}>
          Zoom In
        </button>
        <button className="viewer-button secondary" type="button" onClick={() => setViewMode("front")}>
          Front View
        </button>
        <button className="viewer-button secondary" type="button" onClick={() => setViewMode("side")}>
          Side View
        </button>
      </div>

      <div
        ref={stageRef}
        className="viewer-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="viewer-gridlines" />
        <div className="viewer-pedestal" />
        <ViewerScene
          stats={stats}
          targetRotation={targetRotation}
          cameraDistance={cameraDistance}
          frameTargetY={frameTargetY}
          frameHeight={frameHeight}
          panX={panX}
          panY={panY}
          onModelStatusChange={setModelStatus}
          onModelBoundsChange={handleModelBoundsChange}
        />
      </div>

      <div className="viewer-stats">
        <strong>{stats.name}</strong>
        <span>{stats.baseGender}</span>
        <span>{bodyProfile}</span>
        <span>Shoulder {stats.shoulderCm} · Chest {stats.chestCm}</span>
        <span>Waist {stats.waistCm} · Hip {stats.hipCm}</span>
        <span>Leg {stats.legLengthCm} · Arm {stats.armLengthCm}</span>
        <span>Model Source: {getAvatarBodyModelStatusLabel(modelStatus)}</span>
        <span>Zoom {zoomPercent}%</span>
        <span>Middle Mouse Drag: Pan View</span>
      </div>
    </div>
  );
}
