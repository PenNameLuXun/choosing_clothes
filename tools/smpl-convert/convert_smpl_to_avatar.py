#!/usr/bin/env python3
"""
convert_smpl_to_avatar.py
Convert SMPL NPZ template to a production-ready rigged GLB.

Features
--------
- Full SMPL 24-joint skeleton with UE4-style bone names
  (matching defaultAvatarBodyModelManifest in avatar-body-model.ts)
- LBS skinning: top-4 joints per vertex, renormalised
- 7 semantic morph targets derived from SMPL shape blendshapes:
    shoulderWide, chestFull, waistSlim, torsoTall, hipWide, legLong, bodyMass

Usage
-----
  pip install pygltflib numpy
  python convert_smpl_to_avatar.py \\
      --input  ../../apps/web/public/models/avatar-body/SMPL_NEUTRAL.npz \\
      --output ../../apps/web/public/models/avatar-body/base.glb [--gender neutral]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pygltflib as gl

# ── GLTF component-type constants ──────────────────────────────────────────
BYTE           = 5120
UNSIGNED_BYTE  = 5121
SHORT          = 5122
UNSIGNED_SHORT = 5123
UNSIGNED_INT   = 5125
FLOAT          = 5126
ARRAY_BUFFER         = 34962
ELEMENT_ARRAY_BUFFER = 34963

# ── SMPL 24-joint names (UE4-style, matching boneMap in avatar-body-model.ts)
SMPL_JOINT_NAMES = [
    "pelvis",      # 0  ← boneMap.hips
    "thigh_l",     # 1  ← boneMap.thighL
    "thigh_r",     # 2  ← boneMap.thighR
    "spine_01",    # 3
    "calf_l",      # 4  ← boneMap.calfL
    "calf_r",      # 5  ← boneMap.calfR
    "spine_02",    # 6  ← boneMap.spine
    "foot_l",      # 7
    "foot_r",      # 8
    "spine_03",    # 9
    "ball_l",      # 10
    "ball_r",      # 11
    "neck_01",     # 12
    "clavicle_l",  # 13
    "clavicle_r",  # 14
    "head",        # 15
    "upperarm_l",  # 16  ← boneMap.upperArmL
    "upperarm_r",  # 17  ← boneMap.upperArmR
    "lowerarm_l",  # 18  ← boneMap.forearmL
    "lowerarm_r",  # 19  ← boneMap.forearmR
    "hand_l",      # 20
    "hand_r",      # 21
    "finger_l",    # 22
    "finger_r",    # 23
]

MORPH_NAMES = [
    "shoulderWide",
    "chestFull",
    "waistSlim",
    "torsoTall",
    "hipWide",
    "legLong",
    "bodyMass",
]

N_JOINTS = 24


# ── Helpers ─────────────────────────────────────────────────────────────────

def load_smpl(path: Path) -> dict:
    data = np.load(path, allow_pickle=True)
    return {k: np.array(data[k]) for k in data.files}


def orient(v: np.ndarray, joints: np.ndarray):
    """Shift so feet sit at Y=0 and body is centred on X/Z."""
    y_min = v[:, 1].min()
    x_c = (v[:, 0].min() + v[:, 0].max()) * 0.5
    z_c = (v[:, 2].min() + v[:, 2].max()) * 0.5

    v = v.copy().astype(np.float64)
    v[:, 1] -= y_min
    v[:, 0] -= x_c
    v[:, 2] -= z_c

    joints = joints.copy().astype(np.float64)
    joints[:, 1] -= y_min
    joints[:, 0] -= x_c
    joints[:, 2] -= z_c

    return v.astype(np.float32), joints.astype(np.float32)


def compute_normals(v: np.ndarray, f: np.ndarray) -> np.ndarray:
    v0, v1, v2 = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0).astype(np.float64)
    n = np.linalg.norm(fn, axis=1, keepdims=True)
    fn /= np.where(n > 0, n, 1.0)

    vn = np.zeros_like(v, dtype=np.float64)
    for i in range(3):
        np.add.at(vn, f[:, i], fn)

    n = np.linalg.norm(vn, axis=1, keepdims=True)
    return (vn / np.where(n > 0, n, 1.0)).astype(np.float32)


def top4_skinning(weights: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Reduce 24-joint LBS weights to top-4 per vertex, renormalised."""
    n = weights.shape[0]
    idx = np.zeros((n, 4), dtype=np.uint16)
    wt  = np.zeros((n, 4), dtype=np.float32)

    top4 = np.argsort(weights, axis=1)[:, -4:][:, ::-1]
    for v in range(n):
        i = top4[v]
        w = weights[v, i].astype(np.float64)
        s = w.sum()
        idx[v] = i
        wt[v]  = (w / s if s > 0 else w).astype(np.float32)

    return idx, wt


# ── Smooth band weighting along normalised Y ─────────────────────────────────

def _smoothstep(a: float, b: float, t: np.ndarray) -> np.ndarray:
    t = np.clip((t - a) / (b - a + 1e-9), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def smooth_band(y_norm: np.ndarray, lo: float, hi: float,
                peak: float | None = None) -> np.ndarray:
    if peak is None:
        peak = (lo + hi) * 0.5
    rising  = _smoothstep(lo, peak, y_norm)
    falling = 1.0 - _smoothstep(peak, hi, y_norm)
    return np.where(y_norm <= peak, rising, falling)


# ── Semantic morph computation via ridge regression ───────────────────────────

def _solve_morph(target: np.ndarray, shapedirs: np.ndarray,
                 n_betas: int = 10, ridge: float = 0.5,
                 max_disp: float = 0.06) -> np.ndarray:
    """
    Find beta weights so that (shapedirs[:,:,:n_betas] @ betas) ≈ target,
    then renormalise so the largest vertex displacement equals max_disp (metres).
    """
    SD = shapedirs[:, :, :n_betas].astype(np.float64)  # (N,3,k)
    N  = SD.shape[0]
    S  = SD.reshape(N * 3, n_betas)                     # (N*3, k)
    t  = target.astype(np.float64).reshape(N * 3)

    A     = S.T @ S + ridge * np.eye(n_betas)
    betas = np.linalg.solve(A, S.T @ t)

    delta = (S @ betas).reshape(N, 3)
    peak  = np.max(np.linalg.norm(delta, axis=1))
    if peak > 1e-9:
        delta *= max_disp / peak
    return delta.astype(np.float32)


def compute_morph_deltas(v: np.ndarray,
                         shapedirs: np.ndarray) -> list[np.ndarray]:
    """
    Build one (N,3) delta array per semantic morph target.

    Strategy: for each morph we specify a desired displacement field
    (which vertices should move in which direction) and solve for the
    best linear combination of the first 10 SMPL shape blendshapes.
    """
    y_min, y_max = v[:, 1].min(), v[:, 1].max()
    y_norm = (v[:, 1] - y_min) / (y_max - y_min + 1e-9)
    x, z   = v[:, 0], v[:, 2]

    deltas: list[np.ndarray] = []

    # 1. shoulderWide – lateral expansion at shoulder height
    m = smooth_band(y_norm, 0.70, 0.92, peak=0.82)
    m *= np.clip(np.abs(x) / 0.12, 0.0, 1.0)          # ignore spine area
    field = np.zeros_like(v, dtype=np.float64)
    field[:, 0] = m * np.sign(x)
    deltas.append(_solve_morph(field, shapedirs, ridge=0.3))

    # 2. chestFull – chest depth + slight width expansion
    m = smooth_band(y_norm, 0.52, 0.80, peak=0.66)
    field = np.zeros_like(v, dtype=np.float64)
    field[:, 0] = m * x * 0.4
    field[:, 2] = m * np.sign(z) * 1.0
    deltas.append(_solve_morph(field, shapedirs, ridge=0.5))

    # 3. waistSlim – inward compression at waist
    m = smooth_band(y_norm, 0.36, 0.56, peak=0.47)
    field = np.zeros_like(v, dtype=np.float64)
    field[:, 0] = -m * np.abs(x)
    field[:, 2] = -m * np.abs(z)
    deltas.append(_solve_morph(field, shapedirs, ridge=0.3))

    # 4. torsoTall – vertical stretch of torso
    m = smooth_band(y_norm, 0.38, 0.98, peak=0.68)
    field = np.zeros_like(v, dtype=np.float64)
    field[:, 1] = m * (y_norm - 0.38)
    deltas.append(_solve_morph(field, shapedirs, ridge=0.6))

    # 5. hipWide – lateral + posterior expansion at hips/glutes
    m = smooth_band(y_norm, 0.18, 0.46, peak=0.32)
    field = np.zeros_like(v, dtype=np.float64)
    field[:, 0] = m * np.sign(x) * 0.9
    field[:, 2] = m * np.sign(z) * 0.7
    deltas.append(_solve_morph(field, shapedirs, ridge=0.4))

    # 6. legLong – downward stretch of legs
    m = smooth_band(y_norm, 0.00, 0.38, peak=0.18)
    field = np.zeros_like(v, dtype=np.float64)
    field[:, 1] = -m * (0.38 - y_norm)                 # pull vertices down
    deltas.append(_solve_morph(field, shapedirs, ridge=0.5))

    # 7. bodyMass – overall volume increase with anterior belly bulge
    base_mask = np.ones(len(v)) * 0.4
    belly     = smooth_band(y_norm, 0.28, 0.62, peak=0.44) * 0.6
    m = base_mask + belly
    field = np.zeros_like(v, dtype=np.float64)
    field[:, 0] = m * x * 0.5
    field[:, 2] = m * np.abs(z) * 1.1
    deltas.append(_solve_morph(field, shapedirs, ridge=0.6))

    return deltas


# ── GLB construction ─────────────────────────────────────────────────────────

class _Blob:
    """Incrementally builds the binary chunk and records views/accessors."""

    def __init__(self):
        self.data       : bytearray         = bytearray()
        self._views     : list[dict]        = []
        self._accessors : list[dict]        = []

    # --- internal ---

    def _pad(self):
        while len(self.data) % 4:
            self.data.append(0)

    def _view(self, arr: np.ndarray, target: int | None = None) -> int:
        self._pad()
        raw = arr.tobytes()
        v = {"byteOffset": len(self.data), "byteLength": len(raw)}
        if target:
            v["target"] = target
        self.data.extend(raw)
        idx = len(self._views)
        self._views.append(v)
        return idx

    def _acc(self, bv: int, count: int, comp: int, atype: str,
             mn=None, mx=None, normalized: bool = False) -> int:
        a: dict = {"bufferView": bv, "byteOffset": 0,
                   "componentType": comp, "count": count, "type": atype}
        if normalized:
            a["normalized"] = True
        if mn is not None:
            a["min"] = [float(x) for x in mn]
            a["max"] = [float(x) for x in mx]
        idx = len(self._accessors)
        self._accessors.append(a)
        return idx

    # --- public helpers ---

    def positions(self, v: np.ndarray) -> int:
        bv = self._view(v.astype(np.float32), ARRAY_BUFFER)
        return self._acc(bv, len(v), FLOAT, "VEC3",
                         mn=v.min(0), mx=v.max(0))

    def normals(self, n: np.ndarray) -> int:
        bv = self._view(n.astype(np.float32), ARRAY_BUFFER)
        return self._acc(bv, len(n), FLOAT, "VEC3")

    def indices(self, f: np.ndarray) -> int:
        # 6890 vertices < 65536, use uint16
        arr = f.astype(np.uint16).flatten()
        bv  = self._view(arr, ELEMENT_ARRAY_BUFFER)
        return self._acc(bv, len(arr), UNSIGNED_SHORT, "SCALAR")

    def joints_attr(self, j: np.ndarray) -> int:
        bv = self._view(j.astype(np.uint16), ARRAY_BUFFER)
        return self._acc(bv, len(j), UNSIGNED_SHORT, "VEC4")

    def weights_attr(self, w: np.ndarray) -> int:
        bv = self._view(w.astype(np.float32), ARRAY_BUFFER)
        return self._acc(bv, len(w), FLOAT, "VEC4")

    def morph_delta(self, d: np.ndarray) -> int:
        bv = self._view(d.astype(np.float32), ARRAY_BUFFER)
        return self._acc(bv, len(d), FLOAT, "VEC3",
                         mn=d.min(0), mx=d.max(0))

    def ibm(self, matrices: np.ndarray) -> int:
        """matrices: (N,4,4) in row-major order; GLTF wants column-major."""
        col_major = matrices.transpose(0, 2, 1).astype(np.float32)
        bv = self._view(col_major)
        return self._acc(bv, len(matrices), FLOAT, "MAT4")

    # --- finalise ---

    def apply(self, gltf: gl.GLTF2):
        for v in self._views:
            gltf.bufferViews.append(
                gl.BufferView(buffer=0,
                              byteOffset=v["byteOffset"],
                              byteLength=v["byteLength"],
                              target=v.get("target")))
        for a in self._accessors:
            gltf.accessors.append(
                gl.Accessor(bufferView=a["bufferView"],
                            byteOffset=0,
                            componentType=a["componentType"],
                            count=a["count"],
                            type=a["type"],
                            normalized=a.get("normalized", False),
                            min=a.get("min"),
                            max=a.get("max")))
        gltf.buffers.append(gl.Buffer(byteLength=len(self.data)))
        gltf.set_binary_blob(bytes(self.data))


def build_glb(
    vertices    : np.ndarray,       # (N,3) float32
    normals     : np.ndarray,       # (N,3) float32
    faces       : np.ndarray,       # (F,3) uint32
    joints_idx  : np.ndarray,       # (N,4) uint16
    joints_wt   : np.ndarray,       # (N,4) float32
    joint_pos   : np.ndarray,       # (J,3) float32  world positions
    parent_idx  : np.ndarray,       # (J,)  int  (-1 = root)
    morph_deltas: list[np.ndarray], # 7×(N,3) float32
) -> gl.GLTF2:

    blob = _Blob()
    gltf = gl.GLTF2()
    gltf.asset = gl.Asset(version="2.0",
                          generator="convert_smpl_to_avatar.py")

    # ── Accessors ─────────────────────────────────────────────────────────
    acc_pos  = blob.positions(vertices)
    acc_nrm  = blob.normals(normals)
    acc_idx  = blob.indices(faces)
    acc_ji   = blob.joints_attr(joints_idx)
    acc_jw   = blob.weights_attr(joints_wt)

    morph_targets: list[dict] = []
    for d in morph_deltas:
        ai = blob.morph_delta(d)
        morph_targets.append({"POSITION": ai})

    # Inverse bind matrices: IBM_j = translate(-joint_world_j)
    ibm = np.tile(np.eye(4, dtype=np.float32), (N_JOINTS, 1, 1))
    for j in range(N_JOINTS):
        ibm[j, :3, 3] = -joint_pos[j]
    acc_ibm = blob.ibm(ibm)

    # ── Mesh ──────────────────────────────────────────────────────────────
    prim = gl.Primitive(
        attributes=gl.Attributes(
            POSITION=acc_pos,
            NORMAL=acc_nrm,
            JOINTS_0=acc_ji,
            WEIGHTS_0=acc_jw,
        ),
        indices=acc_idx,
        targets=morph_targets,
    )
    mesh = gl.Mesh(
        name="Body",
        primitives=[prim],
        weights=[0.0] * len(MORPH_NAMES),
        extras={"targetNames": MORPH_NAMES},
    )
    gltf.meshes.append(mesh)

    # ── Nodes ─────────────────────────────────────────────────────────────
    # Node layout:
    #   0           = Armature root (no transform, children=[1])
    #   1 … J       = bone nodes (joint j → node j+1)
    #   J+1         = mesh node

    MESH_NODE = N_JOINTS + 1

    # Build children lists per joint
    children: list[list[int]] = [[] for _ in range(N_JOINTS)]
    for j in range(N_JOINTS):
        p = int(parent_idx[j])
        if 0 <= p < N_JOINTS:
            children[p].append(j)

    # Armature root node
    gltf.nodes.append(gl.Node(
        name="Armature",
        children=[1, MESH_NODE],    # pelvis + mesh
    ))

    # Bone nodes (1-based: node j+1 = joint j)
    for j in range(N_JOINTS):
        p = int(parent_idx[j])
        if p < 0 or p >= N_JOINTS:
            # Root joint: translation in world space
            t = joint_pos[j].tolist()
        else:
            # Local translation relative to parent
            t = (joint_pos[j] - joint_pos[p]).tolist()

        child_nodes = [c + 1 for c in children[j]]
        gltf.nodes.append(gl.Node(
            name=SMPL_JOINT_NAMES[j],
            translation=t,
            children=child_nodes,
        ))

    # Mesh node
    gltf.nodes.append(gl.Node(name="BodyMesh", mesh=0, skin=0))

    # ── Skin ──────────────────────────────────────────────────────────────
    skin = gl.Skin(
        name="Armature",
        joints=list(range(1, N_JOINTS + 1)),  # node indices for joints
        inverseBindMatrices=acc_ibm,
    )
    gltf.skins.append(skin)

    # ── Scene ─────────────────────────────────────────────────────────────
    gltf.scenes.append(gl.Scene(nodes=[0]))
    gltf.scene = 0

    # ── Populate buffers / buffer views / accessors ───────────────────────
    blob.apply(gltf)

    return gltf


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="Convert SMPL NPZ to a rigged GLB with semantic morph targets")
    ap.add_argument("--input",  required=True,
                    help="Path to SMPL NPZ file (e.g. SMPL_NEUTRAL.npz)")
    ap.add_argument("--output", required=True,
                    help="Output GLB path")
    ap.add_argument("--n-betas", type=int, default=10,
                    help="Number of SMPL shape PCA components to use for morphs (default 10)")
    args = ap.parse_args()

    input_path  = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Loading SMPL model: {input_path}")
    smpl = load_smpl(input_path)

    v_raw  = smpl["v_template"].astype(np.float32)   # (6890, 3)
    f_raw  = smpl["f"].astype(np.int32)               # (13776, 3)
    sd_raw = smpl["shapedirs"].astype(np.float32)     # (6890, 3, ≥10)
    w_raw  = smpl["weights"].astype(np.float32)       # (6890, 24)
    J_raw  = smpl["J"].astype(np.float32)             # (24, 3)

    kintree = smpl["kintree_table"]                   # (2, 24)
    parent_raw = kintree[0].astype(np.int64)
    # Replace UINT32_MAX sentinel with -1 for root
    parent = np.where(parent_raw > 1000, -1, parent_raw).astype(np.int32)

    # Orient: feet at Y=0, centred on X/Z
    vertices, joint_pos = orient(v_raw, J_raw)

    print(f"  {len(vertices)} vertices, {len(f_raw)} faces, {N_JOINTS} joints")
    print(f"  Model height: {vertices[:,1].max():.3f} m")
    print(f"  Pelvis Y: {joint_pos[0,1]:.3f} m")

    normals = compute_normals(vertices, f_raw)
    joints_idx, joints_wt = top4_skinning(w_raw)

    print("Computing semantic morph targets …")
    morph_deltas = compute_morph_deltas(vertices, sd_raw)
    for name, d in zip(MORPH_NAMES, morph_deltas):
        peak = float(np.max(np.linalg.norm(d, axis=1)))
        print(f"  {name}: peak displacement = {peak*100:.1f} cm")

    print("Building GLB …")
    gltf = build_glb(
        vertices    = vertices,
        normals     = normals,
        faces       = f_raw,
        joints_idx  = joints_idx,
        joints_wt   = joints_wt,
        joint_pos   = joint_pos,
        parent_idx  = parent,
        morph_deltas= morph_deltas,
    )

    gltf.save(str(output_path))
    print(f"Wrote {output_path}  ({output_path.stat().st_size // 1024} KB)")

    # ── Update manifest.json ──────────────────────────────────────────────
    manifest_path = output_path.parent / "manifest.json"
    height_cm = round(float(vertices[:, 1].max()) * 100)
    # Centre the model vertically in the Three.js scene
    model_center_y = float(vertices[:, 1].max()) * 0.5
    root_offset_y  = round(-model_center_y, 4)

    manifest = {
        "modelUrl": "/models/avatar-body/base.glb",
        "referenceHeightCm": height_cm,
        "rootOffsetY": root_offset_y,
        "rootRotationY": 0,
        "morphTargets": MORPH_NAMES,
        "notes": [
            "Generated by convert_smpl_to_avatar.py from SMPL_NEUTRAL.npz",
            "Skeleton bone names match boneMap in defaultAvatarBodyModelManifest",
            "Morph targets derived from SMPL shape blendshapes via ridge regression",
        ],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Updated {manifest_path}")
    print(f"  referenceHeightCm = {height_cm}")
    print(f"  rootOffsetY       = {root_offset_y}")


if __name__ == "__main__":
    main()
