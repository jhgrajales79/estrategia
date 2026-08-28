-- "Lectura comentada del acumulado anual": el facilitador puede guardar un enlace
-- (por defecto el informe explicativo del POA) y abrirlo cuando lo necesite en la sesión.
update activities
set config = config || '{"linkOnly": true, "defaultLink": "https://informe-explicativo-poa.netlify.app/", "externalLinkLabel": "Informe explicativo POA"}'::jsonb
where title = 'Lectura comentada del acumulado anual';
