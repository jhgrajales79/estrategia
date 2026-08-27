-- Simplifica los roles a solo facilitador/participante. El ingreso ya no pide equipo/aspiración
-- (queda oculto y por defecto transversal para los nuevos registros).
update participants set role = 'participante' where role not in ('facilitador', 'participante');

alter table participants drop constraint if exists participants_role_check;
alter table participants add constraint participants_role_check check (role in ('facilitador', 'participante'));
