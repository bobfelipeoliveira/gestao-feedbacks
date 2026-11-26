/* ============================================================
   ABA CRITÉRIOS — regras oficiais de pontuação (somente leitura)

   Tudo nesta tela é gerado a partir de regras.js, o MESMO arquivo
   que calcula a nota no navegador e cuja lógica é repetida no banco
   (função calcular_resultado em supabase/schema.sql). Os exemplos
   são calculados ao vivo por calcularResultado(). Assim a página
   não pode divergir do cálculo real.
   ============================================================ */

var CRIT_ABERTOS = {modeloAntigo: false};

function fmtPts(n){ const v = Math.abs(Number(n)); return (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",")) + (v === 1 ? " ponto" : " pontos"); }
function fmtNum(n){ return Number(n).toFixed(1).replace(".", ","); }

function renderCriterios(main){
  const page = el("div", {class:"page crit-page"});
  page.appendChild(el("div", {class:"page-header"}, [
    el("h1", {}, "Critérios de Avaliação"),
    el("p", {class:"page-sub"}, "Regras oficiais de pontuação usadas no cálculo das notas. Esta página é gerada a partir do próprio cálculo do sistema."),
  ]));

  const nItens = CRITERIOS_V2.length, nPerg = CRITERIOS_V2.filter(c => !c.auto).length;
  const pesoItem = 100 / (nItens * 2) * 2;

  // ---- resumo
  page.appendChild(el("div", {class:"crit-resumo"}, [
    critTile(String(nPerg) + " perguntas", "que o avaliador responde (0, 1, 2 ou N/A)"),
    critTile("+ 1 automático", "“Evitou frases proibidas” (B6): o sistema preenche sozinho — 0 se alguma frase foi marcada, 2 se nenhuma"),
    critTile(String(nItens * 2) + " pontos", `pontuação máxima: ${nItens} itens × 2 pontos (quando todos se aplicam)`),
    critTile(fmtNum(pesoItem).replace(",0", "") + " pontos", `peso de cada item na nota de 0 a 100: item não realizado tira ${fmtNum(pesoItem).replace(",0","")}; parcialmente realizado tira ${fmtNum(pesoItem / 2)}`),
  ]));
  page.appendChild(el("p", {class:"muted crit-resumo-exemplo"},
    `Exemplo: fez tudo certo = 100. Esqueceu um item = ${fmtNum(100 - pesoItem).replace(",0","")}. Fez um item pela metade = ${fmtNum(100 - pesoItem / 2)}. Item marcado como N/A sai da conta e os demais passam a pesar um pouco mais.`));

  // ---- 1. escala
  page.appendChild(critSecao("1. Escala de pontuação", "Vale para todos os itens.", [
    el("div", {class:"crit-escala"}, OPCOES_PONTUACAO.map(op => el("div", {class:"crit-escala-item crit-escala-" + op.valor}, [
      el("div", {class:"crit-escala-valor"}, op.valor === "NA" ? "N/A" : op.valor),
      el("div", {class:"crit-escala-nome"}, op.label),
      el("div", {class:"muted"}, op.valor === "NA" ? "Não entra na conta (nem nos pontos obtidos, nem no máximo)" : (op.valor + (op.valor === "1" ? " ponto" : " pontos"))),
    ]))),
  ]));

  // ---- 2. itens
  page.appendChild(critSecao("2. Itens avaliados (modelo atual — " + nPerg + " perguntas + 1 automático)",
    "Usado em todas as avaliações registradas a partir da atualização de novembro/2026.",
    [critListaItens(CRITERIOS_V2)]));

  // ---- 3. descontos
  page.appendChild(critSecao("3. Descontos e penalizações", "Regras reais configuradas no sistema. Não há outros descontos além destes.", critDescontos()));

  // ---- 4. cálculo
  page.appendChild(critSecao("4. Como a nota final é calculada", null, critCalculo()));

  // ---- 5. conceitos
  page.appendChild(critSecao("5. Conceito (faixa de desempenho)", "Definido pela nota final.", [
    el("div", {class:"crit-faixas"}, CONCEITO_FAIXAS.map(([lim, nome, cor], i) => {
      const sup = i === 0 ? 100 : CONCEITO_FAIXAS[i-1][0];
      return el("div", {class:"crit-faixa"}, [
        el("span", {class:"crit-faixa-cor", style:`background:${cor}`}),
        el("strong", {}, nome),
        el("span", {class:"muted"}, i === 0 ? `de ${lim} a 100` : `de ${lim} até abaixo de ${sup}`),
      ]);
    })),
  ]));

  // ---- 6. transparência e histórico
  page.appendChild(critSecao("6. Alterações e avaliações antigas", null, [
    el("ul", {class:"crit-lista-texto"}, [
      el("li", {}, "Os critérios, pesos e descontos são fixos no sistema. Não existe tela para alterá-los: qualquer mudança exige uma nova versão do modelo, feita no código e registrada no histórico do GitHub."),
      el("li", {}, "Cada avaliação guarda a versão do modelo usada (atual ou antigo) e a nota calculada na data em que foi registrada. Uma mudança futura nas regras não altera, de forma silenciosa, avaliações já concluídas."),
      el("li", {}, "Ao editar uma avaliação, a nota é recalculada pelo banco com as regras do mesmo modelo em que ela foi feita."),
    ]),
    el("details", {class:"crit-antigo", open: CRIT_ABERTOS.modeloAntigo ? "open" : undefined}, [
      el("summary", {}, `Ver o modelo antigo (${CRITERIOS_V1.length} critérios), usado nas avaliações anteriores a novembro/2026`),
      el("p", {class:"muted", style:"margin:10px 0"}, "Mesma escala (0, 1, 2, N/A), mesmos descontos de português e mesma fórmula. Diferenças: no modelo antigo o item B6 (frases proibidas) era respondido manualmente pelo avaliador, e a lista de frases não alterava a nota sozinha."),
      critListaItens(CRITERIOS_V1),
    ]),
  ]));

  main.appendChild(page);
  const det = page.querySelector(".crit-antigo");
  if (det) det.addEventListener("toggle", () => { CRIT_ABERTOS.modeloAntigo = det.open; });
}

function critTile(valor, texto){
  return el("div", {class:"crit-tile"}, [el("div", {class:"crit-tile-valor"}, valor), el("div", {class:"crit-tile-texto"}, texto)]);
}

function critSecao(titulo, sub, conteudo){
  return el("section", {class:"card crit-secao"}, [
    el("h2", {class:"crit-secao-titulo"}, titulo),
    sub ? el("p", {class:"muted crit-secao-sub"}, sub) : null,
    ...(Array.isArray(conteudo) ? conteudo : [conteudo]),
  ]);
}

function critListaItens(lista){
  return el("div", {class:"crit-categorias"}, CATEGORIA_ORDEM.map(cat => {
    const itens = lista.filter(c => c.cat === cat);
    if (!itens.length) return null;
    const subnota = Object.values(SUBNOTA_MAP).find(s => s.cats.includes(cat));
    return el("div", {class:"crit-categoria"}, [
      el("h3", {class:"crit-cat-titulo"}, [
        `${cat} — ${CATEGORIAS[cat].toUpperCase()}`,
        el("span", {class:"crit-cat-meta"}, `${itens.length} ${itens.length === 1 ? "item" : "itens"} · até ${itens.length * 2} pontos${subnota ? " · compõe a " + subnota.label : ""}`),
      ]),
      el("div", {class:"crit-itens"}, itens.map(c => el("div", {class:"crit-item"}, [
        el("div", {class:"crit-item-topo"}, [
          el("span", {class:"criterio-cod"}, c.cod),
          el("span", {class:"crit-item-desc"}, c.desc),
          el("span", {class:"crit-max"}, "Máx. 2 pontos"),
        ]),
        c.auto
          ? el("div", {class:"crit-item-regra"}, "Automático: 2 pontos se nenhuma frase proibida foi marcada; 0 ponto se qualquer frase da lista (ou “outra frase inadequada”) foi marcada. Não tem N/A.")
          : el("div", {class:"crit-item-regra"}, "Não realizou: 0 · Parcialmente realizado: 1 · Realizou completamente: 2 · Não se aplica: N/A"),
      ]))),
    ]);
  }));
}

function critDescontos(){
  const ex = PORTUGUES_CATEGORIAS.map(p => ({...p}));
  return [
    el("h3", {class:"crit-sub"}, "3.1 Erros de português do colaborador (desconto direto na nota)"),
    el("p", {}, "Cada ocorrência registrada desconta pontos diretamente da nota final (escala de 0 a 100), depois do cálculo percentual dos itens."),
    el("div", {class:"table-card crit-tabela"}, [
      el("div", {class:"table-head crit-tab-3"}, ["Tipo de erro","Desconto por ocorrência","Exemplo: 2 ocorrências"].map(h => el("div",{class:"th"},h))),
      ...ex.map(p => el("div", {class:"table-row crit-tab-3"}, [
        el("div", {class:"td"}, p.nome),
        el("div", {class:"td"}, "− " + fmtPts(p.peso)),
        el("div", {class:"td"}, "− " + fmtPts(p.peso * 2)),
      ])),
    ]),
    el("ul", {class:"crit-lista-texto"}, [
      el("li", {}, "Quando aplica: só quando o avaliador marca “Sim” em “Houve erro de português?” e informa a quantidade de cada tipo."),
      el("li", {}, "Limite máximo: não há limite por tipo nem limite total de desconto. A única trava é que a nota final nunca fica abaixo de 0."),
      el("li", {}, "Os descontos são somados e o total é arredondado para 1 casa decimal."),
    ]),
    el("h3", {class:"crit-sub"}, "3.2 Frases proibidas (modelo atual: via item B6)"),
    el("p", {}, "Não é um desconto separado: qualquer frase proibida marcada zera o item B6, que vale 2 pontos. Na prática, a nota cai cerca de " + fmtNum(100 / (CRITERIOS_V2.length * 2) * 2) + " pontos quando todos os itens se aplicam. Marcar mais de uma frase não aumenta a perda."),
    el("div", {class:"crit-frases"}, FRASES_PROIBIDAS.map(f => el("span", {class:"pill"}, `“${f}”`)).concat([el("span", {class:"pill pill-muted"}, "Outra frase inadequada (descrita pelo avaliador)")])),
    el("h3", {class:"crit-sub"}, "3.3 O que NÃO desconta"),
    el("ul", {class:"crit-lista-texto"}, [
      el("li", {}, "Impacto assistencial (sem impacto, baixo, médio, alto): é registrado para acompanhamento, mas não altera a nota."),
      el("li", {}, "Notas Técnica, Comunicação, Humanização e Processo: são indicadores por grupo de itens. Não somam nem descontam na nota final."),
      el("li", {}, "Não existem outros descontos ou penalizações configurados no sistema."),
    ]),
  ];
}

function critCalculo(){
  // exemplos calculados pela função oficial
  const tudo2 = {}; for (const c of CRITERIOS_V2) if (!c.auto) tudo2[c.cod] = 2;
  const exA = {modelo:2, criterios:{...tudo2}, frases:{}, portugues:{}};
  const exB = {modelo:2, criterios:{...tudo2, C2:0, B4:1, D2:"NA"}, frases:{"1":true}, portugues:{concordancia:1}};
  const rA = calcularResultado(exA), rB = calcularResultado(exB);
  const base = rB.pontosMax ? rB.pontosObtidos / rB.pontosMax * 100 : 0;

  return [
    el("ol", {class:"crit-passos"}, [
      el("li", {}, [el("strong", {}, "Pontos obtidos: "), "soma dos pontos dos itens respondidos com 0, 1 ou 2 (incluindo o B6 automático)."]),
      el("li", {}, [el("strong", {}, "Pontuação máxima possível: "), "2 pontos × número de itens que se aplicam. Itens N/A saem da conta — não contam nem nos pontos obtidos nem no máximo — e por isso nunca prejudicam a nota."]),
      el("li", {}, [el("strong", {}, "Percentual: "), "(pontos obtidos ÷ pontuação máxima) × 100."]),
      el("li", {}, [el("strong", {}, "Descontos: "), "subtrai o total de erros de português."]),
      el("li", {}, [el("strong", {}, "Nota final: "), "resultado arredondado para 1 casa decimal, nunca abaixo de 0. O conceito sai da tabela da seção 5."]),
    ]),
    el("div", {class:"crit-formula"}, "Nota final = (pontos obtidos ÷ pontuação máxima aplicável) × 100 − descontos de português"),
    el("div", {class:"banner-aviso"}, [
      el("strong", {}, "Atenção — item sem resposta: "),
      "hoje o sistema trata um item deixado em branco da mesma forma que N/A (ele sai da conta). Por isso, ao finalizar, confira se todos os itens foram respondidos. Essa regra pode ser revista, se a coordenação desejar.",
    ]),
    el("h3", {class:"crit-sub"}, "Exemplos calculados pelo sistema"),
    el("div", {class:"crit-exemplos"}, [
      critExemplo("Exemplo 1 — tudo realizado", [
        `${CRITERIOS_V2.length} itens aplicáveis → máximo ${rA.pontosMax} pontos`,
        `Pontos obtidos: ${rA.pontosObtidos}`,
        "Sem frases proibidas e sem erros de português",
      ], rA),
      critExemplo("Exemplo 2 — com falhas, N/A e descontos", [
        "C2 (sinais vitais) = 0 · B4 (escuta ativa) = 1 · D2 (Telemedicina/TytoCare) = N/A",
        "1 frase proibida marcada → B6 = 0",
        `Itens aplicáveis: ${rB.pontosMax / 2} → máximo ${rB.pontosMax} pontos · obtidos ${rB.pontosObtidos}`,
        `Percentual: ${rB.pontosObtidos} ÷ ${rB.pontosMax} × 100 = ${fmtNum(base)}`,
        `1 erro de concordância: − ${fmtPts(rB.penalizacaoPortugues)}`,
        `Nota final: ${fmtNum(base)} − ${fmtNum(rB.penalizacaoPortugues)} = ${fmtNum(rB.notaFinal)}`,
      ], rB),
    ]),
  ];
}

function critExemplo(titulo, linhas, r){
  return el("div", {class:"crit-exemplo"}, [
    el("div", {class:"crit-exemplo-titulo"}, titulo),
    el("ul", {}, linhas.map(l => el("li", {}, l))),
    el("div", {class:"crit-exemplo-nota", style:`color:${r.conceitoCor}`}, [
      el("strong", {}, fmtNum(r.notaFinal)), " · ", r.conceito,
    ]),
  ]);
}
