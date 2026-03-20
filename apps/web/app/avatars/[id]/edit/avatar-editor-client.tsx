"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AvatarBodySchema, AvatarMorphParams } from "@choosing-clothes/shared-types";

import AvatarViewerPlaceholder from "@/components/avatar-viewer-placeholder";
import { mapAvatarSchemaToMorphProfile } from "@/lib/avatar-schema";

type AvatarFormState = AvatarBodySchema & {
  morphParams: AvatarMorphParams;
};

const defaultAvatar: AvatarFormState = {
  name: "New Avatar",
  baseGender: "female",
  heightCm: 168,
  weightKg: 54,
  shoulderCm: 39,
  chestCm: 84,
  waistCm: 66,
  hipCm: 90,
  legLengthCm: 98,
  armLengthCm: 56,
  morphParams: {
    bodyFat: 0.32,
    muscle: 0.18,
    torsoScale: 1.03
  }
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8765";

async function fetchAvatar(avatarId: string) {
  const response = await fetch(`${apiBaseUrl}/api/avatars/${avatarId}`);
  if (!response.ok) {
    throw new Error("Failed to load avatar");
  }
  return response.json();
}

async function saveAvatar(avatarId: string, payload: AvatarFormState) {
  const isNew = avatarId === "new";
  const url = isNew ? `${apiBaseUrl}/api/avatars` : `${apiBaseUrl}/api/avatars/${avatarId}`;
  const method = isNew ? "POST" : "PUT";

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Failed to save avatar");
  }

  return response.json();
}

function NumberField({
  label,
  name,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="control-item">
      <span>{label}</span>
      <input type="range" name={name} min={min} max={max} step={step ?? 1} value={value} onChange={onChange} />
      <small>
        {name}: {value}
      </small>
    </label>
  );
}

export default function AvatarEditorClient({ avatarId }: { avatarId: string }) {
  const [form, setForm] = useState<AvatarFormState>(defaultAvatar);
  const [statusMessage, setStatusMessage] = useState("Ready to edit");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(avatarId !== "new");

  const morphProfile = useMemo(() => mapAvatarSchemaToMorphProfile(form), [form]);

  useEffect(() => {
    let active = true;

    if (avatarId === "new") {
      setForm(defaultAvatar);
      setIsLoading(false);
      setStatusMessage("Creating a new avatar");
      return () => {
        active = false;
      };
    }

    setIsLoading(true);
    setStatusMessage("Loading avatar...");

    fetchAvatar(avatarId)
      .then((data) => {
        if (!active) {
          return;
        }

        setForm({
          name: data.name,
          baseGender: data.baseGender,
          heightCm: data.heightCm,
          weightKg: data.weightKg,
          shoulderCm: data.shoulderCm,
          chestCm: data.chestCm,
          waistCm: data.waistCm,
          hipCm: data.hipCm,
          legLengthCm: data.legLengthCm,
          armLengthCm: data.armLengthCm,
          morphParams: {
            bodyFat: data.morphParams.bodyFat ?? defaultAvatar.morphParams.bodyFat,
            muscle: data.morphParams.muscle ?? defaultAvatar.morphParams.muscle,
            torsoScale: data.morphParams.torsoScale ?? defaultAvatar.morphParams.torsoScale
          }
        });
        setStatusMessage("Avatar loaded");
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setStatusMessage("Unable to load avatar, using local defaults");
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [avatarId]);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    if (name === "name" || name === "baseGender") {
      setForm((current) => ({ ...current, [name]: value } as AvatarFormState));
      return;
    }

    if (name in form.morphParams) {
      setForm((current) => ({
        ...current,
        morphParams: {
          ...current.morphParams,
          [name]: Number(value)
        }
      }));
      return;
    }

    setForm((current) => ({ ...current, [name]: Number(value) } as AvatarFormState));
  }

  async function handleSubmit() {
    setIsSaving(true);
    setStatusMessage("Saving avatar...");

    try {
      const saved = await saveAvatar(avatarId, form);
      setStatusMessage(`Save Avatar complete: ${saved.name}`);
    } catch {
      setStatusMessage("Save Avatar failed. Check API server and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Editor</p>
        <h1>Avatar Editor</h1>
        <p className="lead">编辑器现在已经接入真实表单状态，并可通过 API 保存 Avatar 数据。</p>
        <div className="sync-banner">
          <strong>Live Sync</strong>
          <span>拖动左侧滑杆时，右侧 3D 底座会实时平滑过渡到新的体型参数。</span>
        </div>
        <div className="actions-row">
          <Link className="action-link secondary" href="/avatars">
            Back to Avatar Library
          </Link>
          <button className="action-link button-link" type="button" onClick={handleSubmit} disabled={isSaving || isLoading}>
            {isSaving ? "Saving..." : "Save Avatar"}
          </button>
        </div>
        <p className="status-line">{statusMessage}</p>
      </section>

      <section className="editor-grid">
        <article className="panel">
          <h2>Body Controls</h2>
          <div className="control-list">
            <label className="control-item">
              <span>Name</span>
              <input className="text-input" name="name" value={form.name} onChange={updateField} />
            </label>

            <label className="control-item">
              <span>Base Gender</span>
              <select className="text-input" name="baseGender" value={form.baseGender} onChange={updateField}>
                <option value="female">female</option>
                <option value="male">male</option>
                <option value="neutral">neutral</option>
              </select>
            </label>

            <NumberField label="Height" name="heightCm" value={form.heightCm} min={150} max={200} onChange={updateField} />
            <NumberField label="Weight" name="weightKg" value={form.weightKg} min={35} max={120} onChange={updateField} />
            <NumberField label="Shoulder" name="shoulderCm" value={form.shoulderCm} min={30} max={60} onChange={updateField} />
            <NumberField label="Chest" name="chestCm" value={form.chestCm} min={70} max={130} onChange={updateField} />
            <NumberField label="Waist" name="waistCm" value={form.waistCm} min={55} max={120} onChange={updateField} />
            <NumberField label="Hip" name="hipCm" value={form.hipCm} min={75} max={140} onChange={updateField} />
            <NumberField label="Leg Length" name="legLengthCm" value={form.legLengthCm} min={70} max={120} onChange={updateField} />
            <NumberField label="Arm Length" name="armLengthCm" value={form.armLengthCm} min={45} max={75} onChange={updateField} />
            <NumberField label="Body Fat" name="bodyFat" value={form.morphParams.bodyFat} min={0.05} max={0.8} step={0.01} onChange={updateField} />
            <NumberField label="Muscle" name="muscle" value={form.morphParams.muscle} min={0.05} max={0.8} step={0.01} onChange={updateField} />
            <NumberField label="Torso Scale" name="torsoScale" value={form.morphParams.torsoScale} min={0.8} max={1.2} step={0.01} onChange={updateField} />
          </div>
        </article>

        <article className="panel viewer-placeholder">
          <h2>3D Viewer</h2>
          <p>这是第一版可交互占位组件，下一步会替换成真实的人体模型和服装渲染。</p>
          <div className="measure-grid">
            <div className="measure-chip">
              <strong>{form.heightCm}</strong>
              <span>Height</span>
            </div>
            <div className="measure-chip">
              <strong>{form.chestCm}</strong>
              <span>Chest</span>
            </div>
            <div className="measure-chip">
              <strong>{form.waistCm}</strong>
              <span>Waist</span>
            </div>
            <div className="measure-chip">
              <strong>{form.hipCm}</strong>
              <span>Hip</span>
            </div>
            <div className="measure-chip">
              <strong>{morphProfile.torso.chestFull.toFixed(2)}</strong>
              <span>Chest Morph</span>
            </div>
            <div className="measure-chip">
              <strong>{morphProfile.lowerBody.hipWide.toFixed(2)}</strong>
              <span>Hip Morph</span>
            </div>
            <div className="measure-chip">
              <strong>{morphProfile.lowerBody.bodyMass.toFixed(2)}</strong>
              <span>Mass Morph</span>
            </div>
            <div className="measure-chip">
              <strong>{morphProfile.scale.bodyHeight.toFixed(2)}</strong>
              <span>Height Scale</span>
            </div>
          </div>
          <AvatarViewerPlaceholder
            stats={{
              name: form.name,
              baseGender: form.baseGender,
              heightCm: form.heightCm,
              weightKg: form.weightKg,
              chestCm: form.chestCm,
              waistCm: form.waistCm,
              hipCm: form.hipCm,
              shoulderCm: form.shoulderCm,
              legLengthCm: form.legLengthCm,
              armLengthCm: form.armLengthCm,
              morphParams: form.morphParams
            }}
          />
        </article>
      </section>
    </main>
  );
}
