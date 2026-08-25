import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { isAuthenticated } from "@/lib/auth";
import { newId } from "@/lib/utils";

const MAX_SIZE_MB = 4;

/** POST /api/upload — sube una imagen a Vercel Blob (solo admin) */
export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Solo se permiten imágenes" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return Response.json(
      { error: `La imagen supera los ${MAX_SIZE_MB}MB` },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const blob = await put(`pluma/${newId()}.${ext}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  return Response.json({ url: blob.url });
}
