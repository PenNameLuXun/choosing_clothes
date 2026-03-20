from typing import Any

avatars: list[dict[str, Any]] = []


def reset_avatar_store() -> None:
    avatars.clear()


def list_avatar_records() -> list[dict[str, Any]]:
    return avatars


def add_avatar_record(record: dict[str, Any]) -> dict[str, Any]:
    avatars.append(record)
    return record


def find_avatar_record(avatar_id: str) -> dict[str, Any] | None:
    for avatar in avatars:
        if avatar["id"] == avatar_id:
            return avatar
    return None


def replace_avatar_record(avatar_id: str, record: dict[str, Any]) -> dict[str, Any] | None:
    for index, avatar in enumerate(avatars):
        if avatar["id"] == avatar_id:
            avatars[index] = record
            return record
    return None
