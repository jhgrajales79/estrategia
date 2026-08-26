-- "Lectura comentada del acumulado anual": el participante elige la aspiración
-- sobre la que escribe, y se agregan categorías de qué se ha hecho bien / mal.
update activities
set config = '{
  "selectableAspiration": true,
  "categories": [
    {"key": "hipotesis", "label": "Hipótesis sobre la brecha planeación-ejecución"},
    {"key": "bien", "label": "Qué se ha hecho bien"},
    {"key": "mal", "label": "Qué se ha hecho mal"}
  ]
}'::jsonb
where title = 'Lectura comentada del acumulado anual';
