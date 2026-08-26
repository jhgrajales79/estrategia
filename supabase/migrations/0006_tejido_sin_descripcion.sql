-- "El tejido de conexiones": se retira el texto de la dinámica física (ovillo de lana).
update activities
set description = null
where title = 'El tejido de conexiones';
