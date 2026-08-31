-- Matriz EFI: agrega las etiquetas estándar de la calificación (metodología Fred David)
-- para que el facilitador y los equipos elijan un significado, no un número sin contexto.
update activities
set config = config || '{"ratingLabels": [
  {"value": 1, "label": "Debilidad mayor"},
  {"value": 2, "label": "Debilidad menor"},
  {"value": 3, "label": "Fortaleza menor"},
  {"value": 4, "label": "Fortaleza mayor"}
]}'::jsonb
where id = 9 and title = 'Matriz EFI';

-- Limpia la fila de prueba vacía (factor sin texto) que no es un aporte real del taller.
update submissions
set content = jsonb_set(content, '{rows}', '[]'::jsonb)
where activity_id = 9;
