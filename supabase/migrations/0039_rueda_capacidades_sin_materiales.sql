update activities
set materials = null
where session_id = (select id from sessions where code = 'S1')
  and title = 'Rueda de capacidades por aspiración';
