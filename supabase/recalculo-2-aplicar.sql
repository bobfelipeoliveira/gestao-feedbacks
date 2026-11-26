-- =====================================================================
-- RECÁLCULO PELA REGRA 2 — PASSO 2: APLICAR
-- Decisão da coordenação (26/11/2026): a regra nova vale para TODAS as
-- avaliações. Rode SOMENTE depois de conferir a prévia (passo 1).
--  * Só mexe em avaliações que ainda não estão na regra 2 (rodar de novo não faz nada).
--  * Guarda a versão anterior de cada avaliação em avaliacoes_versoes.
--  * Registra um resumo na Auditoria ("notas.recalculadas").
--  * Não marca as avaliações como "editadas" e não muda avaliador, datas ou respostas.
-- =====================================================================
do $$
declare n int;
begin
  perform set_config('sgf.recalculo', 'on', true);
  insert into avaliacoes_versoes (avaliacao_id, data_anterior, editado_por)
    select id, data, null from avaliacoes where coalesce(data->'resultado'->>'regra', '1') <> '2';
  get diagnostics n = row_count;
  if n > 0 then
    update avaliacoes set data = data where coalesce(data->'resultado'->>'regra', '1') <> '2';
    insert into auditoria (acao, alvo, detalhes)
      values ('notas.recalculadas', 'regra 2', jsonb_build_object('avaliacoes', n,
              'regra', 'começa em 100; item = 100 ÷ nº de itens; parcial perde metade; N/A e em branco não perdem'));
  end if;
  perform set_config('sgf.recalculo', 'off', true);
  raise notice 'Avaliações recalculadas: %', n;
end $$;

-- Conferência: deve dar 0
select count(*) as ainda_na_regra_antiga from avaliacoes where coalesce(data->'resultado'->>'regra', '1') <> '2';
