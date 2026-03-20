import AvatarEditorClient from "./avatar-editor-client";

export default function AvatarEditPage({ params }: { params: { id: string } }) {
  return <AvatarEditorClient avatarId={params.id} />;
}
