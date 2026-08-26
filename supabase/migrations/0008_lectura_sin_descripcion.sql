-- "Lectura comentada del acumulado anual": se retira el texto descriptivo.
update activities
set description = null
where title = 'Lectura comentada del acumulado anual';
