import Link from "next/link";

import type { AvatarSummary } from "@choosing-clothes/shared-types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8765";

type AvatarListState = {
  avatars: AvatarSummary[];
  error: string | null;
};

async function loadAvatars(): Promise<AvatarListState> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/avatars`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Avatar API returned ${response.status}`);
    }

    const avatars = (await response.json()) as AvatarSummary[];
    return { avatars, error: null };
  } catch {
    return {
      avatars: [],
      error: "Avatar API unavailable. Start the API server to see saved avatars."
    };
  }
}

export default async function AvatarsPage() {
  const { avatars, error } = await loadAvatars();

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Avatar</p>
        <h1>Avatar Library</h1>
        <p className="lead">列表页现在已经接入真实 API，会直接展示后端保存过的 Avatar 数据。</p>
        <div className="actions-row">
          <Link className="action-link" href="/avatars/new/edit">
            Create Avatar
          </Link>
        </div>
        {error ? <p className="status-line warning-line">{error}</p> : null}
      </section>

      <section className="grid single-column">
        {avatars.length > 0 ? (
          avatars.map((avatar) => (
            <article className="panel card-row" key={avatar.id}>
              <div>
                <h2>{avatar.name}</h2>
                <p>
                  {avatar.baseGender} · {avatar.heightCm} cm
                </p>
              </div>
              <Link className="action-link secondary" href={`/avatars/${avatar.id}/edit`}>
                Edit Avatar
              </Link>
            </article>
          ))
        ) : (
          <article className="panel empty-panel">
            <h2>No avatars yet</h2>
            <p>还没有可编辑的 Avatar。你可以先创建一个，再回到这里查看真实列表数据。</p>
            <Link className="action-link" href="/avatars/new/edit">
              Create Your First Avatar
            </Link>
          </article>
        )}
      </section>
    </main>
  );
}
