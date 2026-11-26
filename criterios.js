/* ============================================================
   ABA CRITÉRIOS — a regra da nota, "preto no branco"

   Tudo aqui é gerado a partir de regras.js, o MESMO código que
   calcula a nota (e que é repetido no banco, em calcular_resultado).
   Os valores e o exemplo são calculados ao vivo por calcularResultado(),
   então esta página não tem como divergir do cálculo real.
   ============================================================ */

function fmtN(v){ const r = Math.round(v * 100) / 100; return String(r).replace(".", ","); }

function renderCriterios(main){
  const nItens = CRITERIOS_V2.length;
  const valor = valorDoItem(CRITERIOS_V2);          // 5
  const nPerg = CRITERIOS_V2.filter(c => !c.auto).length;

  const page = el("div", {class:"page crit-page"});
  page.appendChild(el("div", {class:"page-header"}, [
    el("h1", {}, "Critérios de Avaliação"),
    el("p", {class:"page-sub"}, "Como a nota é calculada. Esta página é gerada pelo mesmo cálculo que dá a nota."),
  ]));

  // ---------- 1. A regra
  page.appendChild(el("section", {class:"card crit-regra"}, [
    el("div", {class:"crit-regra-frase"}, [
      "A nota começa em ", el("strong", {}, "100"), ". São ", el("strong", {}, `${nItens} itens`),
      " e cada item vale ", el("strong", {}, `${fmtN(valor)} pontos`), ".",
    ]),
    el("div", {class:"crit-regra-tabela"}, [
      critRegraLinha("2", "Realizou completamente", "não perde pontos", "ok"),
      critRegraLinha("1", "Parcialmente realizado", `perde ${fmtN(valor / 2)} pontos`, "meio"),
      critRegraLinha("0", "Não realizou", `perde ${fmtN(valor)} pontos`, "perde"),
      critRegraLinha("N/A", "Não se aplica a esta ligação", "não perde pontos", "na"),
    ]),
    el("ul", {class:"crit-lista-texto"}, [
      el("li", {}, [el("strong", {}, "Frase proibida: "), `perde ${fmtN(valor)} pontos (é o item B6). Usar mais de uma frase não aumenta a perda.`]),
      el("li", {}, [el("strong", {}, "Erros de português: "), "perde pontos por ocorrência (tabela abaixo)."]),
      el("li", {}, [el("strong", {}, "Todos os itens são obrigatórios. "), "Se o item não cabe na ligação, o avaliador marca N/A."]),
      el("li", {}, "A nota nunca fica abaixo de 0."),
    ]),
    critExemplo(valor),
  ]));

  // ---------- 2. Itens
  page.appendChild(el("section", {class:"card crit-secao"}, [
    el("h2", {class:"crit-secao-titulo"}, `Os ${nItens} itens avaliados — ${fmtN(valor)} pontos cada`),
    el("p", {class:"muted crit-secao-sub"}, `${nPerg} são respondidos pelo avaliador. O B6 é preenchido pelo sistema: perde ${fmtN(valor)} pontos se alguma frase proibida for marcada.`),
    critListaItens(CRITERIOS_V2),
  ]));

  // ---------- 3. Português
  page.appendChild(el("section", {class:"card crit-secao"}, [
    el("h2", {class:"crit-secao-titulo"}, "Descontos por erro de português"),
    el("p", {class:"muted crit-secao-sub"}, "Cada ocorrência tira os pontos abaixo. Não há limite de desconto."),
    el("div", {class:"table-card crit-tabela"}, [
      el("div", {class:"table-head crit-tab-2"}, ["Tipo de erro","Perde por ocorrência"].map(h => el("div",{class:"th"},h))),
      ...PORTUGUES_CATEGORIAS.map(p => el("div", {class:"table-row crit-tab-2"}, [
        el("div", {class:"td"}, p.nome), el("div", {class:"td"}, fmtN(Math.abs(p.peso)) + " pontos"),
      ])),
    ]),
    el("p", {class:"muted", style:"margin-top:8px"}, "Frases proibidas — " + FRASES_PROIBIDAS.map(f => `“${f}”`).join(" · ") + " · outra frase inadequada descrita pelo avaliador."),
  ]));

  // ---------- 4. Conceito
  page.appendChild(el("section", {class:"card crit-secao"}, [
    el("h2", {class:"crit-secao-titulo"}, "Conceito pela nota final"),
    el("div", {class:"crit-faixas"}, CONCEITO_FAIXAS.map(([lim, nome, cor], i) => el("div", {class:"crit-faixa"}, [
      el("span", {class:"crit-faixa-cor", style:`background:${cor}`}),
      el("strong", {}, nome),
      el("span", {class:"muted"}, i === 0 ? `${lim} a 100` : `${lim} a ${fmtN(CONCEITO_FAIXAS[i-1][0] - 0.1)}`),
    ]))),
  ]));

  // ---------- 5. Observações
  page.appendChild(el("section", {class:"card crit-secao"}, [
    el("h2", {class:"crit-secao-titulo"}, "Observações"),
    el("ul", {class:"crit-lista-texto"}, [
      el("li", {}, "O impacto assistencial é registrado, mas não altera a nota."),
      el("li", {}, "As notas Técnica, Comunicação, Humanização e Processo são indicadores por grupo de itens e não entram na conta da nota final."),
      el("li", {}, "Os critérios e valores são fixos no sistema; qualquer mudança é registrada no histórico. Cada avaliação mostra, no relatório, a conta que gerou a sua nota."),
    ]),
    el("details", {class:"crit-antigo"}, [
      el("summary", {}, `Avaliações do modelo antigo (${CRITERIOS_V1.length} itens)`),
      el("p", {class:"muted", style:"margin:10px 0"}, `Avaliações feitas antes de novembro/2026 usam a lista antiga de ${CRITERIOS_V1.length} itens com a mesma regra: começa em 100 e cada item vale ${fmtN(valorDoItem(CRITERIOS_V1))} pontos (parcial perde ${fmtN(valorDoItem(CRITERIOS_V1) / 2)}).`),
      critListaItens(CRITERIOS_V1),
    ]),
  ]));

  main.appendChild(page);
}

function critRegraLinha(valor, nome, efeito, tipo){
  return el("div", {class:"crit-regra-linha crit-regra-" + tipo}, [
    el("span", {class:"crit-regra-valor"}, valor),
    el("span", {class:"crit-regra-nome"}, nome),
    el("span", {class:"crit-regra-efeito"}, efeito),
  ]);
}

/* Exemplo calculado pela função oficial. */
function critExemplo(valor){
  const tudo = {}; for (const c of CRITERIOS_V2) if (!c.auto) tudo[c.cod] = 2;
  const r = calcularResultado({modelo:2, criterios:{...tudo, C2:0, B4:1, D2:"NA"}, frases:{}, portugues:{concordancia:1}});
  return el("div", {class:"crit-exemplo"}, [
    el("div", {class:"crit-exemplo-titulo"}, "Exemplo"),
    el("div", {class:"conta-nota"}, [
      ["Nota inicial", "100"],
      ["C2 — não pediu os sinais vitais (não realizou)", "− " + fmtN(valor)],
      ["B4 — escuta ativa parcial", "− " + fmtN(valor / 2)],
      ["D2 — Telemedicina não indicada (N/A)", "0"],
      ["1 erro de concordância", "− " + fmtN(r.penalizacaoPortugues)],
    ].map(([a, b]) => el("div", {class:"conta-linha"}, [el("span", {}, a), el("span", {}, b)])).concat([
      el("div", {class:"conta-linha conta-total"}, [el("span", {}, "Nota final"), el("span", {}, `${fmtN(r.notaFinal)} · ${r.conceito}`)]),
    ])),
  ]);
}

function critListaItens(lista){
  return el("div", {class:"crit-categorias"}, CATEGORIA_ORDEM.map(cat => {
    const itens = lista.filter(c => c.cat === cat);
    if (!itens.length) return null;
    return el("div", {class:"crit-categoria"}, [
      el("h3", {class:"crit-cat-titulo"}, `${cat} — ${CATEGORIAS[cat].toUpperCase()}`),
      el("div", {class:"crit-itens"}, itens.map(c => el("div", {class:"crit-item crit-item-linha"}, [
        el("span", {class:"criterio-cod"}, c.cod),
        el("span", {class:"crit-item-desc"}, c.desc + (c.auto ? " (automático)" : "")),
      ]))),
    ]);
  }));
}
