// Migración única — ya ejecutada contra producción el 2026-09-08, se deja como referencia.
// Convierte a JPEG las fotos HEIC/HEIF que quedaron subidas antes de que uploadMedia empezara
// a convertirlas automáticamente (ver src/lib/storage.ts). Recorre TODAS las submissions (no
// solo "El tejido de conexiones") por si aparece HEIC en otra actividad que también use
// uploadMedia (ej. NotasColectivas).
//
// Requiere una dependencia que no forma parte del runtime de la app:
//   npm install --no-save heic-convert
import { createClient } from "@supabase/supabase-js";
import convert from "heic-convert";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

const BUCKET = "activity-media";

function isHeicUrl(u) {
  return /\.hei[cf]$/i.test(u.split("?")[0]);
}

async function migrateOne(oldUrl) {
  const idx = oldUrl.indexOf(`/${BUCKET}/`);
  const oldPath = oldUrl.slice(idx + `/${BUCKET}/`.length);
  console.log("  converting", oldPath);

  const res = await fetch(oldUrl);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const inputBuffer = Buffer.from(await res.arrayBuffer());

  const outputBuffer = await convert({ buffer: inputBuffer, format: "JPEG", quality: 0.85 });

  const newPath = oldPath.replace(/\.hei[cf]$/i, ".jpg");
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(newPath, Buffer.from(outputBuffer), { contentType: "image/jpeg", upsert: false });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(newPath);

  const { error: delErr } = await supabase.storage.from(BUCKET).remove([oldPath]);
  if (delErr) console.warn("  (no se pudo borrar el HEIC original, se deja huérfano)", delErr.message);

  return pub.publicUrl;
}

async function main() {
  const { data, error } = await supabase.from("submissions").select("id,activity_id,content");
  if (error) throw error;

  let converted = 0;
  let failed = 0;

  for (const sub of data) {
    const media = sub.content?.media;
    if (!Array.isArray(media) || !media.some(isHeicUrl)) continue;

    console.log(`\nsubmission ${sub.id} (activity ${sub.activity_id}):`);
    const newMedia = [];
    let changed = false;
    for (const u of media) {
      if (!isHeicUrl(u)) {
        newMedia.push(u);
        continue;
      }
      try {
        const newUrl = await migrateOne(u);
        newMedia.push(newUrl);
        changed = true;
        converted++;
      } catch (err) {
        console.error("  FALLÓ, se conserva la URL original:", err.message);
        newMedia.push(u);
        failed++;
      }
    }
    if (changed) {
      const { error: updErr } = await supabase
        .from("submissions")
        .update({ content: { ...sub.content, media: newMedia } })
        .eq("id", sub.id);
      if (updErr) throw updErr;
      console.log("  submission actualizada.");
    }
  }

  console.log(`\nListo. Convertidas: ${converted}. Fallidas (se dejaron como estaban): ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
