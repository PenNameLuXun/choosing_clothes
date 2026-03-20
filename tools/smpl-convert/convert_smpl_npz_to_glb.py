#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import trimesh


def load_vertices(npz_path: Path, beta_scale: float = 0.0) -> tuple[np.ndarray, np.ndarray]:
    data = np.load(npz_path)
    vertices = np.array(data["v_template"], dtype=np.float64)
    faces = np.array(data["f"], dtype=np.int64)

    shapedirs = data.get("shapedirs")
    if shapedirs is not None and beta_scale != 0:
        num_betas = min(shapedirs.shape[-1], 10)
        betas = np.zeros(num_betas, dtype=np.float64)
        if num_betas > 1:
            betas[1] = beta_scale
        else:
            betas[0] = beta_scale
        vertices = vertices + np.tensordot(shapedirs[:, :, :num_betas], betas, axes=([2], [0]))

    return vertices, faces


def orient_vertices(vertices: np.ndarray) -> np.ndarray:
    oriented = vertices.copy()
    mins = oriented.min(axis=0)
    maxs = oriented.max(axis=0)
    oriented[:, 1] -= mins[1]
    oriented[:, 0] -= (mins[0] + maxs[0]) * 0.5
    oriented[:, 2] -= (mins[2] + maxs[2]) * 0.5
    return oriented


def export_glb(vertices: np.ndarray, faces: np.ndarray, output_path: Path) -> None:
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.visual.vertex_colors = np.tile(np.array([[201, 149, 107, 255]], dtype=np.uint8), (len(vertices), 1))
    scene = trimesh.Scene(mesh)
    output_path.write_bytes(scene.export(file_type="glb"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert SMPL npz template mesh to a static GLB for web preview")
    parser.add_argument("--input", required=True, help="Path to SMPL npz model")
    parser.add_argument("--output", required=True, help="Output GLB path")
    parser.add_argument("--beta-scale", type=float, default=0.0, help="Optional small shape variation for preview meshes")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    vertices, faces = load_vertices(input_path, beta_scale=args.beta_scale)
    vertices = orient_vertices(vertices)
    export_glb(vertices, faces, output_path)

    bounds = np.vstack([vertices.min(axis=0), vertices.max(axis=0)])
    print(f"Wrote {output_path}")
    print(f"Bounds min={bounds[0].tolist()} max={bounds[1].tolist()}")
