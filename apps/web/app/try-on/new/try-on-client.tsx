"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  AvatarSummary,
  AvatarBodySchema,
  Garment,
  GarmentCategory,
} from "@choosing-clothes/shared-types";

import AvatarViewerPlaceholder from "@/components/avatar-viewer-placeholder";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8765";

const DEFAULT_SCHEMA: AvatarBodySchema = {
  name: "Preview",
  baseGender: "neutral",
  heightCm: 168,
  weightKg: 58,
  shoulderCm: 40,
  chestCm: 88,
  waistCm: 70,
  hipCm: 94,
  legLengthCm: 98,
  armLengthCm: 56,
  morphParams: { bodyFat: 0.3, muscle: 0.2, torsoScale: 1 },
};

const CATEGORY_LABEL: Record<GarmentCategory, string> = {
  tshirt: "T恤",
  shirt: "衬衫",
  dress: "连衣裙",
  pants: "裤子",
  unknown: "其他",
};

async function fetchFullAvatar(id: string): Promise<AvatarBodySchema> {
  const res = await fetch(`${apiBaseUrl}/api/avatars/${id}`);
  if (!res.ok) throw new Error("fetch avatar failed");
  return res.json();
}

type AiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; imageUrl: string }
  | { status: "error"; message: string };

export default function TryOnClient({
  avatars,
  garments,
}: {
  avatars: AvatarSummary[];
  garments: Garment[];
}) {
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(
    avatars[0]?.id ?? null,
  );
  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(
    garments[0]?.id ?? null,
  );
  const [avatarSchema, setAvatarSchema] =
    useState<AvatarBodySchema>(DEFAULT_SCHEMA);
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [aiState, setAiState] = useState<AiState>({ status: "idle" });
  const [viewMode, setViewMode] = useState<"3d" | "ai">("3d");

  // 选中 avatar 时拉取完整数据
  useEffect(() => {
    if (!selectedAvatarId) return;
    let active = true;
    setLoadingAvatar(true);
    fetchFullAvatar(selectedAvatarId)
      .then((data) => {
        if (active) setAvatarSchema(data);
      })
      .catch(() => {/* 保持默认值 */})
      .finally(() => {
        if (active) setLoadingAvatar(false);
      });
    return () => { active = false; };
  }, [selectedAvatarId]);

  const selectedGarment = garments.find((g) => g.id === selectedGarmentId);

  async function handleAiTryOn() {
    if (!selectedAvatarId || !selectedGarmentId) return;
    setAiState({ status: "loading" });
    setViewMode("ai");
    try {
      const res = await fetch(`${apiBaseUrl}/api/tryon/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: selectedAvatarId, garmentId: selectedGarmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "生成失败");
      setAiState({ status: "done", imageUrl: data.imageUrl });
    } catch (err) {
      setAiState({ status: "error", message: String(err) });
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Try On</p>
        <h1>虚拟试穿</h1>
        <p className="lead">
          选择一个身材，再选一件服装，右侧 3D 预览会实时更新。
        </p>
        <div className="actions-row">
          <Link className="action-link secondary" href="/avatars">
            Avatar Library
          </Link>
          <Link className="action-link secondary" href="/garments">
            Garment Library
          </Link>
        </div>
      </section>

      <section className="tryon-layout">
        {/* ── 左栏：选 Avatar ── */}
        <div className="tryon-panel">
          <h2>选择身材</h2>
          {avatars.length === 0 ? (
            <p className="tryon-empty">
              暂无 Avatar。
              <Link href="/avatars/new/edit"> 先创建一个 →</Link>
            </p>
          ) : (
            <div className="selector-list">
              {avatars.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`selector-card ${selectedAvatarId === a.id ? "selected" : ""}`}
                  onClick={() => setSelectedAvatarId(a.id)}
                >
                  <strong>{a.name}</strong>
                  <span>
                    {a.baseGender} · {a.heightCm} cm
                  </span>
                </button>
              ))}
            </div>
          )}

          <h2 style={{ marginTop: "28px" }}>选择服装</h2>
          {garments.length === 0 ? (
            <p className="tryon-empty">
              暂无服装。
              <Link href="/garments"> 先上传一件 →</Link>
            </p>
          ) : (
            <div className="selector-list">
              {garments.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`selector-card garment-selector-card ${selectedGarmentId === g.id ? "selected" : ""}`}
                  onClick={() => setSelectedGarmentId(g.id)}
                >
                  {g.imageUrl && (
                    <img
                      className="selector-thumb"
                      src={g.imageUrl}
                      alt={g.name}
                    />
                  )}
                  <div className="selector-card-copy">
                    <strong>{g.name}</strong>
                    <span>
                      {CATEGORY_LABEL[g.category]} · {g.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 右栏：Viewer ── */}
        <div className="tryon-viewer-col">
          <div className="panel viewer-placeholder">
            <div className="tryon-viewer-header">
              <h2>
                {viewMode === "ai" ? "AI 试穿效果" : "3D 预览"}
                {loadingAvatar && viewMode === "3d" && (
                  <span className="loading-badge"> 加载中…</span>
                )}
              </h2>
              <div className="tryon-view-tabs">
                <button
                  type="button"
                  className={`viewer-button${viewMode === "3d" ? "" : " secondary"}`}
                  onClick={() => setViewMode("3d")}
                >
                  3D
                </button>
                <button
                  type="button"
                  className={`viewer-button${viewMode === "ai" ? "" : " secondary"}`}
                  onClick={() => setViewMode("ai")}
                  disabled={aiState.status === "idle"}
                >
                  AI
                </button>
              </div>
            </div>

            {selectedGarment && (
              <p className="tryon-garment-info">
                <strong>{selectedGarment.name}</strong>
                &ensp;{CATEGORY_LABEL[selectedGarment.category]}
                &ensp;·&ensp;
                <span className={`status-badge status-${selectedGarment.status}`}>
                  {selectedGarment.status}
                </span>
              </p>
            )}

            {viewMode === "3d" && (
              <AvatarViewerPlaceholder
                stats={avatarSchema}
                garment={
                  selectedGarment
                    ? { category: selectedGarment.category, imageUrl: selectedGarment.imageUrl }
                    : undefined
                }
              />
            )}

            {viewMode === "ai" && (
              <div className="ai-result-panel">
                {aiState.status === "loading" && (
                  <div className="ai-result-loading">
                    <span>AI 正在生成试穿效果，通常需要 30–60 秒…</span>
                  </div>
                )}
                {aiState.status === "done" && (
                  <img
                    className="ai-result-image"
                    src={aiState.imageUrl}
                    alt="AI 试穿效果"
                  />
                )}
                {aiState.status === "error" && (
                  <div className="ai-result-error">
                    <strong>生成失败</strong>
                    <span>{aiState.message}</span>
                  </div>
                )}
              </div>
            )}

            {selectedAvatarId && selectedGarmentId && (
              <div className="actions-row" style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  className="action-link"
                  onClick={handleAiTryOn}
                  disabled={aiState.status === "loading"}
                >
                  {aiState.status === "loading" ? "生成中…" : "✦ AI 试穿"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
