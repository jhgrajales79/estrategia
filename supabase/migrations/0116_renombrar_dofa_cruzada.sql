-- Renombra la actividad de S4 "Tres DOFA cruzados (uno por aspiración)" a "Dofa Cruzada".
update activities
set title = 'Dofa Cruzada'
where title = 'Tres DOFA cruzados (uno por aspiración)'
  and session_id = (select id from sessions where code = 'S4');
