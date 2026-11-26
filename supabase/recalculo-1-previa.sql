-- =====================================================================
-- RECÁLCULO PELA REGRA 2 — PASSO 1: PRÉVIA (NÃO ALTERA NADA)
-- Mostra, para cada avaliação ainda na regra antiga, a nota atual e a nota
-- pela regra nova ("começa em 100; cada item vale 5; parcial perde 2,5;
-- N/A e item em branco não perdem"). Rode no SQL Editor e confira.
-- =====================================================================

-- Resumo
select count(*)                                                                  as avaliacoes_a_recalcular,
       count(*) filter (where (calcular_resultado(data)->>'notaFinal')::numeric
                            <> (data->'resultado'->>'notaFinal')::numeric)        as notas_que_mudam,
       count(*) filter (where (calcular_resultado(data)->>'emBranco')::int > 0)   as com_itens_em_branco,
       round(avg((data->'resultado'->>'notaFinal')::numeric), 1)                as media_atual,
       round(avg((calcular_resultado(data)->>'notaFinal')::numeric), 1)          as media_nova
from avaliacoes
where coalesce(data->'resultado'->>'regra', '1') <> '2';

-- Detalhe (maiores diferenças primeiro)
select coalesce(c.data->>'nome', '(removido)')                         as colaborador,
       a.data->>'dataMonitoria'                                         as data,
       case when coalesce(a.data->>'modelo','1') = '2' then 'atual (20 itens)' else 'antigo (30 itens)' end as modelo,
       (a.data->'resultado'->>'notaFinal')::numeric                     as nota_atual,
       (calcular_resultado(a.data)->>'notaFinal')::numeric              as nota_nova,
       (calcular_resultado(a.data)->>'notaFinal')::numeric
         - (a.data->'resultado'->>'notaFinal')::numeric                 as diferenca,
       (calcular_resultado(a.data)->>'emBranco')::int                   as itens_em_branco,
       a.id
from avaliacoes a left join colaboradores c on c.id = a.data->>'colaboradorId'
where coalesce(a.data->'resultado'->>'regra', '1') <> '2'
order by abs((calcular_resultado(a.data)->>'notaFinal')::numeric - (a.data->'resultado'->>'notaFinal')::numeric) desc;
