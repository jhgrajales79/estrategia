-- Cada sesión (S0-S7) puede tener un audio propio en "Nuestro trabajo" (p. ej. la grabación de
-- la plenaria, un resumen hablado) — un solo archivo por sesión, reemplazable, igual que el
-- resto de adjuntos multimedia que ya usan el bucket público "activity-media" (ver 0004).
alter table sessions add column if not exists audio_url text;
