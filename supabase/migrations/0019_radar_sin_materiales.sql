-- "Radar de contexto": se retira el texto de materiales físicos (ya no aplica, es 100% digital).
update activities set materials = null
where title = 'Radar de contexto';
