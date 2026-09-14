import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { isAuthenticated } from "@/lib/auth";
import { ALLOWED_IMAGE_TYPES, detectImageType } from "@/lib/image-type";
import { newId } from "@/lib/utils";

const MAX_SIZE_MB = 4;
const INVALID_TYPE = "Solo se permiten imágenes PNG, JPG, WebP o GIF.";

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
  // Primer filtro barato: el tipo declarado (si viene) tiene que estar permitido
  if (file.type && !(file.type in ALLOWED_IMAGE_TYPES)) {
    return Response.json({ error: INVALID_TYPE }, { status: 400 });
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return Response.json(
      { error: `La imagen supera los ${MAX_SIZE_MB}MB` },
      { status: 400 },
    );
  }

  // El tipo real sale del contenido, nunca del nombre ni del Content-Type
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return Response.json({ error: INVALID_TYPE }, { status: 400 });
  }

  const blob = await put(`pluma/${newId()}.${ALLOWED_IMAGE_TYPES[type]}`, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: type,
  });

  return Response.json({ url: blob.url });
}
