-- Reescribe la descripción de "Matriz PEEA" (S4, id22) para explicar qué es la matriz, no solo
-- cómo se califica.
update activities
set description = 'La Matriz PEEA (Posición Estratégica y Evaluación de la Acción) indica qué postura estratégica le conviene a la Fundación —agresiva, conservadora, defensiva o competitiva— cruzando dos dimensiones internas (sostenibilidad financiera y ventaja de reputación e impacto) con dos externas (estabilidad del entorno social-normativo y dinámica del sector). Cada persona califica las cuatro dimensiones y, con el promedio de los votos, se grafica un vector que señala la postura general.'
where id = 22;
