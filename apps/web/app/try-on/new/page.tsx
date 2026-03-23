import type { AvatarSummary, Garment } from "@choosing-clothes/shared-types";
import TryOnClient from "./try-on-client";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8765";

async function loadData(): Promise<{
  avatars: AvatarSummary[];
  garments: Garment[];
}> {
  try {
    const [avatarRes, garmentRes] = await Promise.all([
      fetch(`${apiBaseUrl}/api/avatars`, { cache: "no-store" }),
      fetch(`${apiBaseUrl}/api/garments`, { cache: "no-store" }),
    ]);
    const avatars = avatarRes.ok ? ((await avatarRes.json()) as AvatarSummary[]) : [];
    const garments = garmentRes.ok ? ((await garmentRes.json()) as Garment[]) : [];
    return { avatars, garments };
  } catch {
    return { avatars: [], garments: [] };
  }
}

export default async function TryOnPage() {
  const { avatars, garments } = await loadData();
  return <TryOnClient avatars={avatars} garments={garments} />;
}
