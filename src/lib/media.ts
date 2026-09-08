export function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
}

// Solo debería quedar algún HEIC/HEIF en producción si se subió antes de que uploadMedia
// empezara a convertirlos a JPEG (ver lib/storage.ts) — ningún navegador de escritorio los
// puede mostrar en un <img>, así que se detectan para avisar en vez de dejar un cuadro vacío.
export function isHeicUrl(url: string) {
  return /\.hei[cf]$/i.test(url.split("?")[0]);
}
