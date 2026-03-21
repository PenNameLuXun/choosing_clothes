import os
import sys
import unittest
from io import BytesIO
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./storage-data/test_avatar_api.db"

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.db import reset_db
from app.main import app


class AvatarApiTests(unittest.TestCase):
    def setUp(self) -> None:
        (ROOT / "storage-data").mkdir(exist_ok=True)
        reset_db()
        self.client = TestClient(app)

    def make_payload(self, *, name: str = "Daily Body", base_gender: str = "female") -> dict:
        return {
            "name": name,
            "baseGender": base_gender,
            "heightCm": 168,
            "weightKg": 54,
            "shoulderCm": 39,
            "chestCm": 84,
            "waistCm": 66,
            "hipCm": 90,
            "legLengthCm": 98,
            "armLengthCm": 56,
            "morphParams": {
                "bodyFat": 0.32,
                "muscle": 0.18,
                "torsoScale": 1.03
            }
        }

    def test_list_avatars_starts_empty(self) -> None:
        response = self.client.get("/api/avatars")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_create_avatar_returns_saved_payload(self) -> None:
        payload = self.make_payload()

        response = self.client.post("/api/avatars", json=payload)

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["name"], payload["name"])
        self.assertEqual(data["baseGender"], payload["baseGender"])
        self.assertEqual(data["heightCm"], payload["heightCm"])
        self.assertIn("id", data)
        self.assertIn("createdAt", data)
        self.assertIn("updatedAt", data)

    def test_created_avatar_appears_in_list(self) -> None:
        payload = self.make_payload(name="Fit Model", base_gender="neutral")

        create_response = self.client.post("/api/avatars", json=payload)
        list_response = self.client.get("/api/avatars")

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(list_response.status_code, 200)
        avatars = list_response.json()
        self.assertEqual(len(avatars), 1)
        self.assertEqual(avatars[0]["name"], payload["name"])

    def test_get_avatar_by_id_returns_saved_avatar(self) -> None:
        created = self.client.post("/api/avatars", json=self.make_payload()).json()

        response = self.client.get(f"/api/avatars/{created['id']}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], created["id"])
        self.assertEqual(response.json()["name"], "Daily Body")

    def test_get_unknown_avatar_returns_404(self) -> None:
        response = self.client.get("/api/avatars/missing-id")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Avatar not found")

    def test_update_avatar_changes_measurements(self) -> None:
        created = self.client.post("/api/avatars", json=self.make_payload()).json()
        updated_payload = self.make_payload(name="Updated Body")
        updated_payload["heightCm"] = 172
        updated_payload["waistCm"] = 70
        updated_payload["morphParams"] = {
            "bodyFat": 0.28,
            "muscle": 0.24,
            "torsoScale": 1.05
        }

        response = self.client.put(f"/api/avatars/{created['id']}", json=updated_payload)

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["id"], created["id"])
        self.assertEqual(data["name"], "Updated Body")
        self.assertEqual(data["heightCm"], 172)
        self.assertEqual(data["waistCm"], 70)
        self.assertNotEqual(data["updatedAt"], created["updatedAt"])


class GarmentApiTests(unittest.TestCase):
    def setUp(self) -> None:
        (ROOT / "storage-data").mkdir(exist_ok=True)
        reset_db()
        self.client = TestClient(app)

    def make_payload(self, *, name: str = "White T-Shirt", category: str = "tshirt") -> dict:
        return {
            "name": name,
            "category": category,
            "imageUrl": "https://images.example.com/garments/white-tshirt.png",
        }

    def test_list_garments_starts_empty(self) -> None:
        response = self.client.get("/api/garments")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_create_garment_returns_saved_payload(self) -> None:
        payload = self.make_payload()

        response = self.client.post("/api/garments", json=payload)

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["name"], payload["name"])
        self.assertEqual(data["category"], payload["category"])
        self.assertEqual(data["imageUrl"], payload["imageUrl"])
        self.assertEqual(data["status"], "uploaded")
        self.assertEqual(data["parsedMeta"], {})
        self.assertIn("id", data)

    def test_get_garment_by_id_returns_saved_garment(self) -> None:
        created = self.client.post("/api/garments", json=self.make_payload()).json()

        response = self.client.get(f"/api/garments/{created['id']}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], created["id"])
        self.assertEqual(response.json()["name"], "White T-Shirt")

    def test_get_unknown_garment_returns_404(self) -> None:
        response = self.client.get("/api/garments/missing-id")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Garment not found")

    def test_upload_garment_image_returns_accessible_path(self) -> None:
        response = self.client.post(
            "/api/uploads/garments",
            files={"file": ("shirt.png", BytesIO(b"fake-image-bytes"), "image/png")},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("/uploads/garments/", data["imageUrl"])
        self.assertTrue(data["filename"].endswith(".png"))


class AvatarWebScaffoldTests(unittest.TestCase):
    def test_avatar_routes_exist(self) -> None:
        avatar_list_page = ROOT / "apps" / "web" / "app" / "avatars" / "page.tsx"
        avatar_edit_page = ROOT / "apps" / "web" / "app" / "avatars" / "[id]" / "edit" / "page.tsx"
        avatar_editor_client = ROOT / "apps" / "web" / "app" / "avatars" / "[id]" / "edit" / "avatar-editor-client.tsx"
        avatar_viewer = ROOT / "apps" / "web" / "components" / "avatar-viewer-placeholder.tsx"
        garment_list_page = ROOT / "apps" / "web" / "app" / "garments" / "page.tsx"
        garment_create_form = ROOT / "apps" / "web" / "app" / "garments" / "create-garment-form.tsx"

        self.assertTrue(avatar_list_page.exists())
        self.assertTrue(avatar_edit_page.exists())
        self.assertTrue(avatar_editor_client.exists())
        self.assertTrue(avatar_viewer.exists())
        self.assertTrue(garment_list_page.exists())
        self.assertTrue(garment_create_form.exists())

    def test_avatar_pages_have_expected_copy(self) -> None:
        avatar_list_content = (ROOT / "apps" / "web" / "app" / "avatars" / "page.tsx").read_text()
        avatar_edit_content = (ROOT / "apps" / "web" / "app" / "avatars" / "[id]" / "edit" / "page.tsx").read_text()
        avatar_editor_client = (ROOT / "apps" / "web" / "app" / "avatars" / "[id]" / "edit" / "avatar-editor-client.tsx").read_text()
        avatar_viewer = (ROOT / "apps" / "web" / "components" / "avatar-viewer-placeholder.tsx").read_text()
        procedural_body = (ROOT / "apps" / "web" / "components" / "procedural-avatar-body.tsx").read_text()
        real_body = (ROOT / "apps" / "web" / "components" / "real-avatar-body.tsx").read_text()
        garment_list_content = (ROOT / "apps" / "web" / "app" / "garments" / "page.tsx").read_text()
        garment_form_content = (ROOT / "apps" / "web" / "app" / "garments" / "create-garment-form.tsx").read_text()

        self.assertIn("Avatar Library", avatar_list_content)
        self.assertIn("Create Avatar", avatar_list_content)
        self.assertIn("loadAvatars", avatar_list_content)
        self.assertIn("No avatars yet", avatar_list_content)
        self.assertIn("Avatar API unavailable", avatar_list_content)
        self.assertIn("AvatarEditorClient", avatar_edit_content)
        self.assertIn("AvatarViewerPlaceholder", avatar_editor_client)
        self.assertIn("Avatar Editor", avatar_editor_client)
        self.assertIn("Live Sync", avatar_editor_client)
        self.assertIn("saveAvatar", avatar_editor_client)
        self.assertIn("fetchAvatar", avatar_editor_client)
        self.assertIn("Save Avatar", avatar_editor_client)
        self.assertIn("Canvas", avatar_viewer)
        self.assertIn("useFrame", avatar_viewer)
        self.assertIn("morphAttributes", procedural_body)
        self.assertIn("morphTargetInfluences", procedural_body)
        self.assertIn("GLTFLoader", real_body)
        self.assertIn("fallback", real_body)
        self.assertIn("MathUtils.damp", avatar_viewer)
        self.assertIn("meshStandardMaterial", avatar_viewer)
        self.assertIn("Rotate Left", avatar_viewer)
        self.assertIn("Front View", avatar_viewer)
        self.assertIn("Garment Library", garment_list_content)
        self.assertIn("Create Garment", garment_list_content)
        self.assertIn("loadGarments", garment_list_content)
        self.assertIn("Saved Garments", garment_list_content)
        self.assertIn("Save Garment", garment_form_content)
        self.assertIn("Garment saved", garment_form_content)
        self.assertIn("Uploading garment image", garment_form_content)
        self.assertIn("api/uploads/garments", garment_form_content)
        self.assertIn("router.refresh", garment_form_content)


if __name__ == "__main__":
    unittest.main()
