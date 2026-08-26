-- "Crazy 8 Socya": habilita la vista ampliada de nube de ideas para el facilitador.
update activities
set config = config || '{"cloudView": true}'::jsonb
where title = 'Crazy 8 Socya: ocho ideas en ocho minutos';
