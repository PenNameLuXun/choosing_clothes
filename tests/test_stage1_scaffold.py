import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class Stage1ScaffoldTests(unittest.TestCase):
    def test_root_structure_exists(self) -> None:
        expected_paths = [
            ROOT / "apps" / "web",
            ROOT / "apps" / "api",
            ROOT / "apps" / "worker",
            ROOT / "packages" / "shared-types",
            ROOT / "docs",
            ROOT / "docker-compose.yml",
            ROOT / ".env.example",
        ]

        for path in expected_paths:
            with self.subTest(path=path):
                self.assertTrue(path.exists(), f"Missing required path: {path}")

    def test_root_package_has_workspace_and_test_scripts(self) -> None:
        package_json = json.loads((ROOT / "package.json").read_text())

        self.assertEqual(package_json["name"], "choosing-clothes")
        self.assertIn("apps/web", package_json["workspaces"])
        self.assertIn("packages/shared-types", package_json["workspaces"])
        self.assertIn("dev:web", package_json["scripts"])
        self.assertIn("test:stage1", package_json["scripts"])

    def test_web_package_has_required_dependencies(self) -> None:
        web_package = json.loads((ROOT / "apps" / "web" / "package.json").read_text())

        self.assertEqual(web_package["name"], "@choosing-clothes/web")
        self.assertEqual(web_package["scripts"]["dev"], "next dev")
        self.assertIn("next", web_package["dependencies"])
        self.assertIn("react", web_package["dependencies"])
        self.assertIn("react-dom", web_package["dependencies"])
        self.assertIn("@choosing-clothes/shared-types", web_package["dependencies"])

    def test_web_homepage_keeps_project_identity(self) -> None:
        homepage = (ROOT / "apps" / "web" / "app" / "page.tsx").read_text()

        self.assertIn("Choosing Clothes", homepage)
        self.assertIn("Avatar", homepage)

    def test_api_scaffold_exposes_health_and_meta_routes(self) -> None:
        api_main = (ROOT / "apps" / "api" / "app" / "main.py").read_text()

        self.assertIn('@app.get("/health")', api_main)
        self.assertIn('@app.get("/api/meta")', api_main)
        self.assertIn('"stage": "stage-', api_main)

    def test_worker_scaffold_has_boot_entry(self) -> None:
        worker_main = (ROOT / "apps" / "worker" / "worker" / "main.py").read_text()

        self.assertIn("def main()", worker_main)
        self.assertIn("booted", worker_main)

    def test_local_infra_declares_required_services(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text()

        for service_name in ["postgres:", "redis:", "minio:"]:
            with self.subTest(service_name=service_name):
                self.assertIn(service_name, compose)


if __name__ == "__main__":
    unittest.main()
