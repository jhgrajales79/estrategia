import { supabase } from "./supabase";

const BUCKET = "activity-media";

// Fotos de celular modernas salen en 12+ MP (varios MB cada una). Mostrar varias así de
// pesadas a la vez como miniaturas de 80-140px (el mural, el panel de fotos del facilitador)
// satura el hilo principal del navegador decodificándolas — con 10-15 fotos el mural llega a
// congelarse varios segundos, indistinguible de "no funciona" para quien lo usa. Se
// reescalan a un lado máximo razonable antes de subir; nadie necesita el original a 12MP para
// verlo en un recuadro de 100px o proyectado en una pantalla de taller.
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;
// Si el archivo ya es chico, no vale la pena volver a codificarlo (pérdida de calidad gratis).
const SKIP_RESIZE_UNDER_BYTES = 700 * 1024;

function isHeicFile(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || isHeicFile(file);
}

// Las fotos de iPhone en formato HEIC/HEIF suben sin error (el archivo es válido y llega
// completo a Storage), pero ningún navegador de escritorio (Chrome, Firefox, Edge) sabe
// mostrarlas en un <img> — el resultado es un recuadro en blanco, sin ningún mensaje que
// explique por qué. Se convierten a JPEG en el navegador antes de subir para que se vean en
// cualquier dispositivo, sin depender de qué teléfono tomó la foto.
async function convertHeicToJpeg(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;
  try {
    const { default: heic2any } = await import("heic2any");
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    const blob = Array.isArray(result) ? result[0] : result;
    const newName = file.name.replace(/\.hei[cf]$/i, ".jpg");
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (err) {
    // Si la conversión falla (formato HEIC atípico, memoria insuficiente en el celular, etc.)
    // se sube el original igual: es mejor tener el archivo guardado sin previsualización que
    // perderlo por completo.
    console.error("No se pudo convertir HEIC a JPEG, se sube el original", err);
    return file;
  }
}

async function resizeImage(file: File): Promise<File> {
  if (!isImageFile(file) || file.size < SKIP_RESIZE_UNDER_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("canvas.toBlob devolvió null");
    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (err) {
    // Igual que con HEIC: si el reescalado falla se sube el original tal cual — puede pesar
    // más y tardar en mostrarse, pero sigue siendo mejor que perder la foto.
    console.error("No se pudo reescalar la imagen, se sube el original", err);
    return file;
  }
}

async function toUploadableFile(file: File): Promise<File> {
  const jpeg = await convertHeicToJpeg(file);
  return resizeImage(jpeg);
}

export async function uploadMedia(file: File, scope: string): Promise<string> {
  const uploadable = await toUploadableFile(file);
  const ext = uploadable.name.split(".").pop() ?? "jpg";
  const path = `${scope}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, uploadable, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
