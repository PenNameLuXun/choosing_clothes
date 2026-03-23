import Link from "next/link";

import type { Garment } from "@choosing-clothes/shared-types";

import CreateGarmentForm from "./create-garment-form";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8765";

type GarmentListState = {
  garments: Garment[];
  error: string | null;
};

async function loadGarments(): Promise<GarmentListState> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/garments`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Garment API returned ${response.status}`);
    }

    const garments = (await response.json()) as Garment[];
    return { garments, error: null };
  } catch {
    return {
      garments: [],
      error: "Garment API unavailable. Start the API server to view saved garments."
    };
  }
}

export default async function GarmentsPage() {
  const { garments, error } = await loadGarments();

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Garment</p>
        <h1>Garment Library</h1>
        <p className="lead">这是阶段 3 的最小闭环：先把服装记录、分类和图片地址保存起来，为后续解析和试穿任务打底。</p>
        <div className="actions-row">
          <Link className="action-link" href="/try-on/new">
            开始试穿
          </Link>
          <Link className="action-link secondary" href="/avatars">
            Avatar Library
          </Link>
        </div>
        {error ? <p className="status-line warning-line">{error}</p> : null}
      </section>

      <section className="editor-grid">
        <article className="panel">
          <h2>Create Garment</h2>
          <p>先录入服装基础信息和图片地址。后续我们会在这里接入真实上传、去背景和解析状态。</p>
          <CreateGarmentForm />
        </article>

        <article className="panel">
          <h2>Saved Garments</h2>
          {garments.length > 0 ? (
            <div className="garment-list">
              {garments.map((garment) => (
                <article className="garment-card" key={garment.id}>
                  <div className="garment-card-copy">
                    <strong>{garment.name}</strong>
                    <span>
                      {garment.category} · {garment.status}
                    </span>
                    <img className="garment-preview" src={garment.imageUrl} alt={garment.name} />
                    <span className="garment-url">{garment.imageUrl}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <p>还没有服装记录。先在左侧创建一条，确认前后端数据链路已经打通。</p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
