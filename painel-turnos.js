/* ============================================================
   DASHBOARD — FILTROS + ANÁLISE POR TURNO (EQUIPE TÉCNICA)

   Turno de cada avaliação = turno CADASTRADO da colaboradora:
     1) o turno gravado na própria avaliação no momento do registro
        (avaliações feitas a partir desta atualização), ou
     2) o turno atual do cadastro (avaliações anteriores).
   Nunca pelo horário da ligação ou da monitoria.
   Quem não tem turno Diurno/Noturno vai para "Pendências" e não é
   contado em nenhum dos dois grupos.
   ============================================================ */

var FILTROS_DASH = {de:"", ate:"", mes:"", colaboradorId:"", turno:""};
var COR_TURNO = {Diurno:"#D9772E", Noturno:"#6B2FA0"};   // validadas (daltonismo/contraste)
var ICONE_TURNO = {Diurno:"☀️", Noturno:"🌙"};

function normalizarTurno(t){
  const s = String(t || "").trim().toLowerCase();
  if (s === "diurno") return "Diurno";
  if (s === "noturno") return "Noturno";
  return null;
}
function turnoBrutoDaAvaliacao(a){
  if (a && a.turnoColaborador !== undefined && a.turnoColaborador !== null) return a.turnoColaborador;
  const c = colaboradorPorId(a.colaboradorId);
  return c ? c.turno : "";
}
function turnoDaAvaliacao(a){ return normalizarTurno(turnoBrutoDaAvaliacao(a)); }
function funcaoDaAvaliacao(a){
  if (a && a.funcaoColaborador) return a.funcaoColaborador;
  const c = colaboradorPorId(a.colaboradorId);
  return c ? c.funcao : "";
}
function ehFuncaoTecnica(f){ return /t[ée]cnic/i.test(String(f || "")); }

function filtrarAvaliacoesDash(avals){
  const f = FILTROS_DASH;
  return avals.filter(a => {
    const d = a.dataMonitoria || "";
    if (f.de && (!d || d < f.de)) return false;
    if (f.ate && (!d || d > f.ate)) return false;
    if (f.mes && d.slice(0,7) !== f.mes) return false;
    if (f.colaboradorId && a.colaboradorId !== f.colaboradorId) return false;
    if (f.turno){
      const t = turnoDaAvaliacao(a);
      if (f.turno === "pendente" ? t !== null : t !== f.turno) return false;
    }
    return true;
  });
}

function nomeMes(chave){
  const [y, m] = chave.split("-");
  const nomes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${nomes[Number(m)-1] || m}/${y}`;
}

function barraFiltrosDash(){
  const f = FILTROS_DASH;
  const meses = [...new Set(STATE.avaliacoes.map(a => (a.dataMonitoria||"").slice(0,7)).filter(Boolean))].sort().reverse();
  const inDe = el("input", {type:"date", class:"input", value:f.de});
  const inAte = el("input", {type:"date", class:"input", value:f.ate});
  inDe.addEventListener("change", e => { f.de = e.target.value; renderApp(); });
  inAte.addEventListener("change", e => { f.ate = e.target.value; renderApp(); });
  const selMes = el("select", {class:"input"}, [el("option", {value:""}, "Todos"), ...meses.map(m => el("option", {value:m, selected: m === f.mes ? "selected" : undefined}, nomeMes(m)))]);
  selMes.addEventListener("change", e => { f.mes = e.target.value; renderApp(); });
  const selTurno = el("select", {class:"input"}, [["","Todos"],["Diurno","☀️ Diurno"],["Noturno","🌙 Noturno"],["pendente","Sem turno definido"]]
    .map(([v,l]) => el("option", {value:v, selected: v === f.turno ? "selected" : undefined}, l)));
  selTurno.addEventListener("change", e => { f.turno = e.target.value; renderApp(); });
  const ativos = Object.values(f).some(Boolean);
  return el("div", {class:"filter-bar dash-filtros"}, [
    campoFiltro("Período de", inDe),
    campoFiltro("Até", inAte),
    campoFiltro("Mês", selMes),
    campoFiltro("Colaborador", selectColaboradorFiltro(f.colaboradorId, v => { f.colaboradorId = v; renderApp(); })),
    campoFiltro("Turno", selTurno),
    ativos ? el("button", {class:"btn btn-ghost", onclick:()=>{ Object.assign(FILTROS_DASH, {de:"", ate:"", mes:"", colaboradorId:"", turno:""}); renderApp(); }}, "Limpar filtros") : null,
  ]);
}

/* ---------------- cálculos ---------------- */
function resumoTurnos(avals){
  const grupos = {Diurno: [], Noturno: []};
  const pendentes = [];
  const mudaramTurno = [];
  for (const a of avals){
    if (!ehFuncaoTecnica(funcaoDaAvaliacao(a))) continue;
    const t = turnoDaAvaliacao(a);
    if (!t){ pendentes.push(a); continue; }
    grupos[t].push(a);
    const c = colaboradorPorId(a.colaboradorId);
    const atual = c ? normalizarTurno(c.turno) : null;
    if (a.turnoColaborador !== undefined && atual && atual !== t) mudaramTurno.push({a, de:t, para:atual});
  }
  const stats = {};
  for (const t of ["Diurno","Noturno"]){
    const lista = grupos[t];
    const porColab = {};
    for (const a of lista){
      (porColab[a.colaboradorId] = porColab[a.colaboradorId] || {soma:0, n:0});
      porColab[a.colaboradorId].soma += a.resultado.notaFinal; porColab[a.colaboradorId].n++;
    }
    const ranking = Object.entries(porColab).map(([id, v]) => ({id, nome: colaboradorNome(id), media: v.soma / v.n, n: v.n}))
      .sort((x, y) => y.media - x.media || y.n - x.n);
    const equipe = STATE.colaboradores.filter(c => naEquipe(c) && ehFuncaoTecnica(c.funcao) && normalizarTurno(c.turno) === t);
    stats[t] = {
      lista, ranking, equipe,
      n: lista.length,
      media: lista.length ? lista.reduce((s, a) => s + a.resultado.notaFinal, 0) / lista.length : null,
    };
  }
  const tecnicasSemTurno = STATE.colaboradores.filter(c => naEquipe(c) && ehFuncaoTecnica(c.funcao) && !normalizarTurno(c.turno));
  return {stats, pendentes, mudaramTurno, tecnicasSemTurno};
}

/* ---------------- tela ---------------- */
function renderPainelTurnos(avals){
  const r = resumoTurnos(avals);
  const D = r.stats.Diurno, N = r.stats.Noturno;
  const sec = el("section", {class:"turnos-secao"}, [
    el("div", {class:"turnos-cabecalho"}, [
      el("h2", {class:"section-title", style:"margin:0"}, "Análise por Turno — Equipe Técnica"),
      el("p", {class:"muted"}, "Técnicas de enfermagem, separadas pelo turno cadastrado de cada colaboradora (não pelo horário da ligação)."),
    ]),
  ]);

  // comparação
  let difTexto = "—", difSub = "precisa de avaliações nos dois turnos";
  if (D.media !== null && N.media !== null){
    const d = D.media - N.media;
    difTexto = (d > 0 ? "+" : d < 0 ? "−" : "") + Math.abs(d).toFixed(1).replace(".", ",");
    difSub = Math.abs(d) < 0.05 ? "médias iguais" : (d > 0 ? "Diurno acima do Noturno" : "Noturno acima do Diurno");
  }
  sec.appendChild(el("div", {class:"turnos-grid"}, [
    cartaoTurno("Diurno", D),
    el("div", {class:"turno-comparacao"}, [
      el("div", {class:"turno-comp-rotulo"}, "Diferença entre as médias"),
      el("div", {class:"turno-comp-valor"}, difTexto),
      el("div", {class:"muted"}, difSub),
      el("div", {class:"turno-comp-linha"}, [
        el("span", {}, `${ICONE_TURNO.Diurno} ${D.n} aval.`), el("span", {}, `${ICONE_TURNO.Noturno} ${N.n} aval.`),
      ]),
    ]),
    cartaoTurno("Noturno", N),
  ]));

  if (D.n + N.n > 0){
    sec.appendChild(el("div", {class:"chart-grid"}, [
      chartCard("Evolução da nota média por mês", "lineTurnos"),
      chartCard("Avaliações por mês", "barTurnosMes"),
      chartCard("Distribuição por faixa de desempenho (% das avaliações do turno)", "barTurnosFaixa"),
    ]));
  } else {
    sec.appendChild(el("div", {class:"empty-state", style:"padding:20px"}, el("p", {}, "Nenhuma avaliação de técnica no filtro selecionado.")));
  }

  sec.appendChild(blocoPendencias(r));
  setTimeout(() => desenharGraficosTurnos(r), 0);
  return sec;
}

function cartaoTurno(t, s){
  // quantas da equipe ATUAL do turno têm avaliação no filtro
  const avaliadas = s.equipe.filter(c => s.ranking.some(x => x.id === c.id)).length;
  return el("div", {class:"turno-card turno-" + t.toLowerCase()}, [
    el("div", {class:"turno-titulo"}, [el("span", {class:"turno-icone"}, ICONE_TURNO[t]), `Técnicas ${t === "Diurno" ? "diurnas" : "noturnas"}`]),
    el("div", {class:"turno-kpis"}, [
      el("div", {}, [el("div", {class:"turno-kpi-valor"}, s.media === null ? "—" : s.media.toFixed(1)), el("div", {class:"turno-kpi-rot"}, "nota média")]),
      el("div", {}, [el("div", {class:"turno-kpi-valor"}, String(s.n)), el("div", {class:"turno-kpi-rot"}, "avaliações")]),
      el("div", {}, [el("div", {class:"turno-kpi-valor"}, `${avaliadas}/${s.equipe.length}`), el("div", {class:"turno-kpi-rot"}, "da equipe avaliadas")]),
    ]),
    el("div", {class:"turno-rank-titulo"}, "Ranking (nota média)"),
    s.ranking.length
      ? el("ol", {class:"turno-ranking"}, s.ranking.map(x => el("li", {}, [
          el("span", {class:"turno-rank-nome"}, x.nome),
          el("span", {class:"turno-rank-n"}, `${x.n} aval.`),
          el("span", {class:"turno-rank-nota", style:`color:${conceitoDe(x.media).cor}`}, x.media.toFixed(1)),
        ])))
      : el("p", {class:"muted"}, "Sem avaliações no filtro."),
    (function(){
      const semAval = s.equipe.filter(c => !s.ranking.some(x => x.id === c.id));
      return semAval.length ? el("p", {class:"muted turno-sem-aval"}, "Sem avaliação no filtro: " + semAval.map(c => c.nome.split(" ")[0]).join(", ")) : null;
    })(),
  ]);
}

function blocoPendencias(r){
  const itens = [];
  if (r.tecnicasSemTurno.length){
    itens.push(el("li", {}, [el("strong", {}, "Técnicas sem turno Diurno/Noturno no cadastro: "),
      r.tecnicasSemTurno.map(c => `${c.nome} (turno: “${c.turno || "vazio"}”)`).join("; "),
      ehAdmin() ? el("span", {class:"muted"}, " — corrija em Configurações → Colaboradores.") : null]));
  }
  if (r.pendentes.length){
    const nomes = [...new Set(r.pendentes.map(a => colaboradorNome(a.colaboradorId)))];
    itens.push(el("li", {}, [el("strong", {}, `${r.pendentes.length} avaliação(ões) de técnica sem turno definido `),
      "(não entram em Diurno nem Noturno): " + nomes.join(", ")]));
  }
  if (r.mudaramTurno.length){
    const nomes = [...new Set(r.mudaramTurno.map(x => `${colaboradorNome(x.a.colaboradorId)} (${x.de} → hoje ${x.para})`))];
    itens.push(el("li", {}, [el("strong", {}, "Mudança de turno (informativo): "),
      "estas avaliações contam no turno em que a colaboradora estava na data da avaliação — " + nomes.join("; ")]));
  }
  return el("div", {class:"turno-pendencias" + (itens.length ? " turno-pendencias-ativa" : "")}, [
    el("div", {class:"turno-pend-titulo"}, itens.length ? "⚠️ Pendências de classificação" : "✓ Sem pendências de classificação de turno"),
    itens.length ? el("ul", {}, itens) : null,
  ]);
}

/* ---------------- gráficos ---------------- */
function desenharGraficosTurnos(r){
  if (!document.getElementById("lineTurnos")) return;
  const turnos = ["Diurno","Noturno"];
  const meses = [...new Set(turnos.flatMap(t => r.stats[t].lista.map(a => (a.dataMonitoria||"").slice(0,7))).filter(Boolean))].sort();
  const porMes = (t, fn) => meses.map(m => fn(r.stats[t].lista.filter(a => (a.dataMonitoria||"").slice(0,7) === m)));
  const rotulo = t => `${ICONE_TURNO[t]} ${t}`;
  const tooltipNota = {callbacks:{label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y === null ? "sem avaliação" : ctx.parsed.y.toFixed(1)}`}};
  const eixoCinza = {grid:{color:"#E4DFEE"}, ticks:{color:"#6E6580"}};

  criarChart("lineTurnos", "line", {
    labels: meses.map(nomeMes),
    datasets: turnos.map(t => ({
      label: rotulo(t),
      data: porMes(t, l => l.length ? Number((l.reduce((s,a)=>s+a.resultado.notaFinal,0)/l.length).toFixed(1)) : null),
      borderColor: COR_TURNO[t], backgroundColor: COR_TURNO[t], borderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
      pointBorderColor: "#fff", pointBorderWidth: 2, tension: 0.25, spanGaps: true,
    })),
  }, {interaction:{mode:"index", intersect:false}, plugins:{tooltip: tooltipNota, legend:{position:"bottom"}},
      scales:{y:{...eixoCinza, suggestedMin: 50, suggestedMax: 100}, x:{...eixoCinza, grid:{display:false}}}});

  criarChart("barTurnosMes", "bar", {
    labels: meses.map(nomeMes),
    datasets: turnos.map(t => ({label: rotulo(t), data: porMes(t, l => l.length), backgroundColor: COR_TURNO[t], borderRadius: 4, maxBarThickness: 28})),
  }, {plugins:{legend:{position:"bottom"}}, scales:{y:{...eixoCinza, beginAtZero:true, ticks:{...eixoCinza.ticks, precision:0}}, x:{...eixoCinza, grid:{display:false}}}});

  const faixas = CONCEITO_FAIXAS.map(f => f[1]);
  criarChart("barTurnosFaixa", "bar", {
    labels: faixas,
    datasets: turnos.map(t => {
      const l = r.stats[t].lista;
      return {label: rotulo(t), backgroundColor: COR_TURNO[t], borderRadius: 4, maxBarThickness: 28,
        contagens: faixas.map(f => l.filter(a => a.resultado.conceito === f).length),
        data: faixas.map(f => l.length ? Number((l.filter(a => a.resultado.conceito === f).length / l.length * 100).toFixed(1)) : 0)};
    }),
  }, {plugins:{legend:{position:"bottom"}, tooltip:{callbacks:{label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}% (${ctx.dataset.contagens[ctx.dataIndex]} aval.)`}}},
      scales:{y:{...eixoCinza, beginAtZero:true, max:100, ticks:{...eixoCinza.ticks, callback: v => v + "%"}}, x:{...eixoCinza, grid:{display:false}}}});
}
