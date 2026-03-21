"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { GarmentCategory, GarmentCreateInput } from "@choosing-clothes/shared-types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8765";

type CreateGarmentFormState = {
  name: string;
  category: GarmentCategory;
  file: File | null;
};

const defaultForm: CreateGarmentFormState = {
  name: "White T-Shirt",
  category: "tshirt",
  file: null
};

export default function CreateGarmentForm() {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready to create garment");

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    if (name === "category") {
      setForm((current) => ({ ...current, category: value as GarmentCategory }));
      return;
    }

    setForm((current) => ({ ...current, name: value }));
  }

  function updateFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setForm((current) => ({ ...current, file: nextFile }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.file) {
      setStatusMessage("Please choose an image file first.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Uploading garment image...");

    try {
      const uploadPayload = new FormData();
      uploadPayload.append("file", form.file);

      const uploadResponse = await fetch(`${apiBaseUrl}/api/uploads/garments`, {
        method: "POST",
        body: uploadPayload
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload garment image");
      }

      const uploadResult = (await uploadResponse.json()) as { imageUrl: string };
      setStatusMessage("Saving garment...");

      const garmentPayload: GarmentCreateInput = {
        name: form.name,
        category: form.category,
        imageUrl: uploadResult.imageUrl
      };

      const response = await fetch(`${apiBaseUrl}/api/garments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(garmentPayload)
      });

      if (!response.ok) {
        throw new Error("Failed to save garment");
      }

      const saved = (await response.json()) as { name: string; status: string };
      setStatusMessage(`Garment saved: ${saved.name} (${saved.status})`);
      setForm(defaultForm);
      router.refresh();
    } catch {
      setStatusMessage("Garment save failed. Check API server and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="control-list" onSubmit={handleSubmit}>
      <label className="control-item">
        <span>Name</span>
        <input className="text-input" name="name" value={form.name} onChange={updateField} />
      </label>

      <label className="control-item">
        <span>Category</span>
        <select className="text-input" name="category" value={form.category} onChange={updateField}>
          <option value="tshirt">tshirt</option>
          <option value="shirt">shirt</option>
          <option value="dress">dress</option>
          <option value="pants">pants</option>
          <option value="unknown">unknown</option>
        </select>
      </label>

      <label className="control-item">
        <span>Image File</span>
        <input className="text-input file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={updateFile} />
      </label>

      <button className="action-link button-link" type="submit" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Garment"}
      </button>
      <p className="status-line">{statusMessage}</p>
    </form>
  );
}
