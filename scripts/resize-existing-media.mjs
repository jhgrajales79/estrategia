// Migración única — ya ejecutada contra producción el 2026-09-08, se deja como referencia.
// Reescala a un lado máximo de 1920px las fotos ya subidas antes de que uploadMedia
// (src/lib/storage.ts) empezara a hacerlo automáticamente. Fotos de celular a 12MP (2-3 MB
// cada una) tardan varios segundos en decodificarse todas a la vez como miniaturas.
//
// Requiere una dependencia que no forma parte del runtime de la app:
//   npm install --no-save sharp
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

const BUCKET = "activity-media";
const MAX_DIMENSION = 1920;
const SKIP_UNDER_BYTES = 700 * 1024;

function isImageUrl(u) {
  return /\.(jpe?g|png|webp)$/i.test(u.split("?")[0]);
}

async function resizeOne(oldUrl) {
  const idx = oldUrl.indexOf(`/${BUCKET}/`);
  const path = oldUrl.slice(idx + `/${BUCKET}/`.length);

  const res = await fetch(oldUrl);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const inputBuffer = Buffer.from(await res.arrayBuffer());

  if (inputBuffer.length < SKIP_UNDER_BYTES) {
    console.log("  ya es liviana, se deja igual:", path, `(${(inputBuffer.length / 1024).toFixed(0)} KB)`);
    return null;
  }

  const meta = await sharp(inputBuffer).metadata();
  if (Math.max(meta.width ?? 0, meta.height ?? 0) <= MAX_DIMENSION) {
    console.log("  ya está en tamaño razonable, se deja igual:", path, `(${meta.width}x${meta.height})`);
    return null;
  }

  const outputBuffer = await sharp(inputBuffer)
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  console.log(
    `  reescalando ${path}: ${meta.width}x${meta.height} (${(inputBuffer.length / 1024).toFixed(0)} KB) -> máx ${MAX_DIMENSION}px (${(outputBuffer.length / 1024).toFixed(0)} KB)`
  );

  // El bucket solo tiene políticas RLS de insert/select/delete para el rol anónimo (no
  // update), así que hay que borrar y volver a subir en la misma ruta en vez de sobrescribir.
  const { error: delErr } = await supabase.storage.from(BUCKET).remove([path]);
  if (delErr) throw delErr;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, outputBuffer, { contentType: "image/jpeg", upsert: false });
  if (upErr) throw upErr;

  return oldUrl;
}

async function main() {
  const { data, error } = await supabase.from("submissions").select("id,activity_id,content");
  if (error) throw error;

  let resized = 0;
  let skipped = 0;
  let failed = 0;

  for (const sub of data) {
    const media = sub.content?.media;
    if (!Array.isArray(media) || !media.some(isImageUrl)) continue;

    console.log(`\nsubmission ${sub.id} (activity ${sub.activity_id}):`);
    for (const u of media) {
      if (!isImageUrl(u)) continue;
      try {
        const changed = await resizeOne(u);
        if (changed) resized++;
        else skipped++;
      } catch (err) {
        console.error("  FALLÓ, se conserva tal cual:", u, err.message);
        failed++;
      }
    }
  }

  console.log(`\nListo. Reescaladas: ${resized}. Ya estaban bien: ${skipped}. Fallidas: ${failed}.`);
  console.log("Nota: el bucket usa upsert en la misma ruta, así que la URL pública de cada foto no cambia.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
