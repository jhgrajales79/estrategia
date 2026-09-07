-- El Cierre por votación ponderada pasa a importar las debilidades ya trabajadas en la
-- Matriz EFI (id 9) — con el ajuste que el equipo les dio en esa sesión — en vez de
-- traer otra vez las notas crudas de "PCI consolidado" (id 8), que ignoraban ese paso
-- intermedio de refinamiento.
--
-- Para que el filtro por categoría funcione también en filas de la EFI que ya se
-- hubieran importado antes de este cambio (sin el campo 'category'), se backfillea
-- 'category'/'sourceAuthor' cruzando por texto contra las notas originales de PCI.
do $$
declare
  efi_row record;
  pci_notes jsonb;
  new_rows jsonb;
  r jsonb;
  note jsonb;
  matched_category text;
  matched_author text;
begin
  select content -> 'notes' into pci_notes
  from submissions
  where activity_id = 8 and aspiration_id is null;

  for efi_row in select id, content from submissions where activity_id = 9 loop
    new_rows := '[]'::jsonb;
    for r in select * from jsonb_array_elements(coalesce(efi_row.content -> 'rows', '[]'::jsonb)) loop
      if r ? 'category' then
        new_rows := new_rows || jsonb_build_array(r);
      else
        matched_category := null;
        matched_author := null;
        for note in select * from jsonb_array_elements(coalesce(pci_notes, '[]'::jsonb)) loop
          if lower(trim(note ->> 'text')) = lower(trim(r ->> 'factor')) then
            matched_category := note ->> 'category';
            matched_author := note ->> 'author';
            exit;
          end if;
        end loop;
        if matched_category is not null then
          r := r || jsonb_build_object('category', matched_category, 'sourceAuthor', matched_author);
        end if;
        new_rows := new_rows || jsonb_build_array(r);
      end if;
    end loop;
    update submissions set content = jsonb_set(efi_row.content, '{rows}', new_rows) where id = efi_row.id;
  end loop;
end $$;

update activities
set config = config || jsonb_build_object('importCandidatesFrom', 9)
where activity_type = 'votacion_fichas'
  and title = 'Cierre: priorización por votación ponderada';
