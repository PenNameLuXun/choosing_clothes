"use client";

import { useFrame } from "@react-three/fiber";
import type { AvatarBodySchema } from "@choosing-clothes/shared-types";
import * as THREE from "three";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

import {
  applyAvatarSchemaToBodyModel,
  defaultAvatarBodyModelManifest,
  type AvatarBodyModelManifest,
  type AvatarBodyModelStatus
} from "@/lib/avatar-body-model";

function classifyLoadFailure(error: unknown): AvatarBodyModelStatus {
  const message = String(error);
  if (message.includes("404") || message.includes("Not Found") || message.includes("Failed to fetch")) {
    return "missing";
  }
  return "error";
}

function LoadedRealAvatarBody({
  scene,
  stats,
  targetRotation,
  manifest
}: {
  scene: THREE.Group;
  stats: AvatarBodySchema;
  targetRotation: number;
  manifest: AvatarBodyModelManifest;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const instance = useMemo(() => clone(scene) as THREE.Group, [scene]);

  useLayoutEffect(() => {
    applyAvatarSchemaToBodyModel(instance, stats, manifest);
  }, [instance, manifest, stats]);

  useFrame((_, delta) => {
    if (!rootRef.current) {
      return;
    }
    rootRef.current.rotation.y = THREE.MathUtils.damp(rootRef.current.rotation.y, targetRotation, 4.2, delta);
    rootRef.current.position.y = THREE.MathUtils.damp(rootRef.current.position.y, manifest.rootOffsetY, 3.2, delta);
  });

  return (
    <group ref={rootRef} position={[0, manifest.rootOffsetY, 0]}>
      <primitive object={instance} />
    </group>
  );
}

export default function RealAvatarBody({
  stats,
  targetRotation,
  manifest = defaultAvatarBodyModelManifest,
  onStatusChange,
  fallback
}: {
  stats: AvatarBodySchema;
  targetRotation: number;
  manifest?: AvatarBodyModelManifest;
  onStatusChange?: (status: AvatarBodyModelStatus) => void;
  fallback: React.ReactNode;
}) {
  const [status, setStatus] = useState<AvatarBodyModelStatus>("loading");
  const [scene, setScene] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let active = true;
    const loader = new GLTFLoader();

    setStatus("loading");
    loader.load(
      manifest.modelUrl,
      (gltf) => {
        if (!active) {
          return;
        }
        setScene(gltf.scene);
        setStatus("ready");
      },
      undefined,
      (error) => {
        if (!active) {
          return;
        }
        setScene(null);
        setStatus(classifyLoadFailure(error));
      }
    );

    return () => {
      active = false;
    };
  }, [manifest.modelUrl]);

  useEffect(() => {
    onStatusChange?.(scene ? status : status === "loading" ? "fallback" : status);
  }, [onStatusChange, scene, status]);

  if (!scene || status !== "ready") {
    return <>{fallback}</>;
  }

  return <LoadedRealAvatarBody scene={scene} stats={stats} targetRotation={targetRotation} manifest={manifest} />;
}
