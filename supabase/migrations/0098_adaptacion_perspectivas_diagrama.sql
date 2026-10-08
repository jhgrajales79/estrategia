-- "Adaptación de perspectivas al modelo Socya" (S5 id26) tenía un único campo de notas en
-- blanco. Se agrega el diagrama de apoyo (config.diagram) y se divide la nota en 4 campos, uno
-- por perspectiva (Gente, Procesos, Territorios, Autosostenibilidad) — no había datos previos
-- que migrar (sin submissions registradas).
update activities
set config = '{"diagram": "bsc_socya_perspectives", "fields": [{"key": "nota_gente", "type": "textarea", "label": "Notas · Gente y cultura Socya (antes: Aprendizaje y crecimiento)"}, {"key": "nota_procesos", "type": "textarea", "label": "Notas · Procesos internos"}, {"key": "nota_territorios", "type": "textarea", "label": "Notas · Territorios y comunidades (antes: Clientes)"}, {"key": "nota_autosostenibilidad", "type": "textarea", "label": "Notas · Autosostenibilidad y uso de recursos (antes: Financiera)"}]}'::jsonb
where id = 26;
