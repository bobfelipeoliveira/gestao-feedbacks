/* Regras de pontuação — compartilhadas entre navegador e servidor (o servidor recalcula a nota). */
/* ============================================================
   SISTEMA DE GESTÃO DE FEEDBACKS — MODELO DE DADOS E CRITÉRIOS
   ============================================================ */

/* Modelo 1 (até nov/2026): 30 critérios. Mantido para as avaliações antigas — a nota delas não muda. */
var CRITERIOS_V1 = [
  {cod:"A1",cat:"A",desc:"Utilizou corretamente o script inicial"},
  {cod:"A2",cat:"A",desc:"Apresentou-se corretamente (nome e setor)"},
  {cod:"A3",cat:"A",desc:"Confirmou nome completo do paciente"},
  {cod:"A4",cat:"A",desc:"Confirmou endereço ou outro dado de segurança"},

  {cod:"B1",cat:"B",desc:"Descreveu fatos sem julgamento"},
  {cod:"B2",cat:"B",desc:"Validou o sentimento do familiar"},
  {cod:"B3",cat:"B",desc:"Demonstrou empatia durante toda a ligação"},
  {cod:"B4",cat:"B",desc:"Identificou claramente a necessidade do familiar"},
  {cod:"B5",cat:"B",desc:"Utilizou escuta ativa"},
  {cod:"B6",cat:"B",desc:"Evitou frases proibidas"},
  {cod:"B7",cat:"B",desc:"Quando a demanda não era da Intercorrência, orientou e direcionou corretamente"},

  {cod:"C1",cat:"C",desc:"Investigou alterações do quadro clínico"},
  {cod:"C2",cat:"C",desc:"Investigou sintomas associados"},
  {cod:"C3",cat:"C",desc:"Solicitou sinais vitais quando pertinente"},
  {cod:"C4",cat:"C",desc:"Investigou medidas já realizadas"},
  {cod:"C5",cat:"C",desc:"Demonstrou compreensão da gravidade"},

  {cod:"D1",cat:"D",desc:"Explicou claramente o fluxo"},
  {cod:"D2",cat:"D",desc:"Apresentou Telemedicina quando indicada"},
  {cod:"D3",cat:"D",desc:"Apresentou TytoCare quando indicado"},
  {cod:"D4",cat:"D",desc:"Transmitiu segurança durante toda a condução"},

  {cod:"E1",cat:"E",desc:"Garantiu continuidade do cuidado"},
  {cod:"E2",cat:"E",desc:"Orientou novo contato em caso de piora"},
  {cod:"E3",cat:"E",desc:"Confirmou ausência de dúvidas"},
  {cod:"E4",cat:"E",desc:"Informou o número do protocolo"},
  {cod:"E5",cat:"E",desc:"Realizou despedida acolhedora"},

  {cod:"F1",cat:"F",desc:"Clareza na comunicação"},
  {cod:"F2",cat:"F",desc:"Boa dicção"},
  {cod:"F3",cat:"F",desc:"Ritmo adequado"},
  {cod:"F4",cat:"F",desc:"Segurança na fala"},
  {cod:"F5",cat:"F",desc:"Organização das informações"},
];

/* Modelo 2 (atual): 19 perguntas + B6 automático (calculado a partir das frases proibidas). */
var CRITERIOS_V2 = [
  {cod:"A1",cat:"A",desc:"Seguiu o script de abertura (apresentou-se com nome e setor)"},
  {cod:"A2",cat:"A",desc:"Confirmou 2 identificadores do paciente (nome completo + dado de segurança)"},

  {cod:"B1",cat:"B",desc:"Descreveu fatos sem julgamento"},
  {cod:"B2",cat:"B",desc:"Acolheu e validou o sentimento do familiar com empatia"},
  {cod:"B3",cat:"B",desc:"Identificou claramente a necessidade do familiar"},
  {cod:"B4",cat:"B",desc:"Utilizou escuta ativa"},
  {cod:"B5",cat:"B",desc:"Quando a demanda não era da Intercorrência, orientou e direcionou corretamente"},
  {cod:"B6",cat:"B",desc:"Evitou frases proibidas", auto:true},

  {cod:"C1",cat:"C",desc:"Investigou o quadro atual e os sintomas associados"},
  {cod:"C2",cat:"C",desc:"Solicitou sinais vitais quando pertinente"},
  {cod:"C3",cat:"C",desc:"Investigou medidas já realizadas"},
  {cod:"C4",cat:"C",desc:"Demonstrou compreensão da gravidade"},

  {cod:"D1",cat:"D",desc:"Explicou claramente o fluxo"},
  {cod:"D2",cat:"D",desc:"Ofereceu o recurso adequado (Telemedicina/TytoCare) quando indicado"},
  {cod:"D3",cat:"D",desc:"Transmitiu segurança durante a condução"},

  {cod:"E1",cat:"E",desc:"Garantiu a continuidade e orientou novo contato em caso de piora"},
  {cod:"E2",cat:"E",desc:"Informou o número do protocolo"},
  {cod:"E3",cat:"E",desc:"Encerrou confirmando dúvidas, com despedida acolhedora"},

  {cod:"F1",cat:"F",desc:"Comunicação clara e organizada"},
  {cod:"F2",cat:"F",desc:"Dicção e ritmo adequados"},
];

var MODELO_ATUAL = 2;
var CRITERIOS = CRITERIOS_V2;   // modelo usado nas novas avaliações

function modeloDe(av){ return (av && Number(av.modelo) === 2) ? 2 : 1; }
function criteriosDe(av){ return modeloDe(av) === 2 ? CRITERIOS_V2 : CRITERIOS_V1; }
/* Critérios que o avaliador responde (sem os automáticos). */
function criteriosPerguntaDe(av){ return criteriosDe(av).filter(function(c){ return !c.auto; }); }

function usouFraseProibida(av){
  const f = (av && av.frases) || {};
  if (f.outraFlag) return true;
  for (const k of Object.keys(f)) if (/^\d+$/.test(k) && f[k] === true) return true;
  return false;
}
/* Respostas efetivas: no modelo 2, B6 é derivado das frases proibidas. */
function respostasEfetivas(av){
  const r = Object.assign({}, (av && av.criterios) || {});
  if (modeloDe(av) === 2){
    for (const k of Object.keys(r)) if (!CRITERIOS_V2.some(function(c){ return c.cod === k && !c.auto; })) delete r[k];
    r.B6 = usouFraseProibida(av) ? 0 : 2;
  }
  return r;
}

var CATEGORIAS = {
  A: "Abertura e Identificação",
  B: "Comunicação Humanizada",
  C: "Investigação Clínica",
  D: "Condução da Ocorrência",
  E: "Encerramento",
  F: "Qualidade Geral",
};

var CATEGORIA_ORDEM = ["A","B","C","D","E","F"];

// Premissa documentada: mapeamento das 4 sub-notas do resultado final às 6 categorias de critérios.
var SUBNOTA_MAP = {
  tecnica:     {label: "Nota Técnica",      cats: ["C"]},
  comunicacao: {label: "Nota Comunicação",  cats: ["F"]},
  humanizacao: {label: "Nota Humanização",  cats: ["B"]},
  processo:    {label: "Nota Processo",     cats: ["A","D","E"]},
};

var PORTUGUES_CATEGORIAS = [
  {chave:"concordancia", nome:"Concordância verbal/nominal", peso:-2},
  {chave:"pronomes",     nome:"Uso inadequado de pronomes",   peso:-1},
  {chave:"regencia",     nome:"Regência verbal",              peso:-1.5},
  {chave:"vocabulario",  nome:"Vocabulário inadequado",       peso:-1},
  {chave:"conjugacao",   nome:"Erros graves de conjugação",   peso:-2},
];

var FRASES_PROIBIDAS = [
  "Não é assim que funciona",
  "Precisa ter calma",
  "Sem sinais vitais não atendo",
  "A senhora não entende",
  "Não posso fazer nada",
  "Seu plano não dá direito",
];

var IMPACTO_OPCOES = [
  {chave:"sem",   emoji:"🟢", label:"Sem impacto assistencial",                                  cor:"#1F9254"},
  {chave:"baixo", emoji:"🟡", label:"Baixo impacto (oportunidade de melhoria)",                   cor:"#E0A83E"},
  {chave:"medio", emoji:"🟠", label:"Médio impacto (poderia gerar atraso, retrabalho ou insatisfação)", cor:"#E8874A"},
  {chave:"alto",  emoji:"🔴", label:"Alto impacto (potencial risco ao paciente ou falha crítica)", cor:"#D64550"},
];

// Faixas de conceito: [limiteInferior, nome, corHex]
var CONCEITO_FAIXAS = [
  [95, "Excelente",                     "#1F9254"],
  [90, "Muito Bom",                     "#2E6FD9"],
  [80, "Bom",                           "#E0A83E"],
  [70, "Em Desenvolvimento",            "#E8874A"],
  [0,  "Necessita Intervenção Imediata","#D64550"],
];

var STATUS_MONITORIA_OPCOES = ["Pendente","Em andamento","Finalizada","Reavaliada"];

function conceitoDe(nota){
  for (const [limite, nome, cor] of CONCEITO_FAIXAS){
    if (nota >= limite) return {nome, cor};
  }
  return {nome:"Necessita Intervenção Imediata", cor:"#D64550"};
}

/* ---------------- Cálculo de resultado de uma avaliação ---------------- */
// avaliacao.criterios = { "A1": 2, "A2": 1, "A3": "NA", ... }
// avaliacao.portugues  = { concordancia:0, pronomes:1, regencia:0, vocabulario:0, conjugacao:0 }

function calcularSubnota(criteriosResp, cats, lista){
  let soma = 0, count = 0;
  for (const crit of (lista || CRITERIOS_V1)){
    if (!cats.includes(crit.cat)) continue;
    const v = criteriosResp[crit.cod];
    if (v === undefined || v === null || v === "NA" || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    soma += n; count += 1;
  }
  if (count === 0) return null;
  return Math.round((soma/(count*2))*1000)/10;
}

function calcularPenalizacaoPortugues(portuguesResp){
  let total = 0;
  for (const p of PORTUGUES_CATEGORIAS){
    const qtd = Number(portuguesResp && portuguesResp[p.chave] || 0);
    total += qtd * p.peso;
  }
  return Math.round(total*10)/10; // negativo ou zero
}

function calcularResultado(avaliacao){
  const lista = criteriosDe(avaliacao);
  const criteriosResp = respostasEfetivas(avaliacao);
  let pontosObtidos = 0, pontosMax = 0;
  for (const crit of lista){
    const v = criteriosResp[crit.cod];
    if (v === undefined || v === null || v === "NA" || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    pontosObtidos += n;
    pontosMax += 2;
  }
  const subnotas = {};
  for (const [chave, info] of Object.entries(SUBNOTA_MAP)){
    subnotas[chave] = calcularSubnota(criteriosResp, info.cats, lista);
  }
  const totalDescontado = calcularPenalizacaoPortugues(avaliacao.portugues);
  const penalizacao = -totalDescontado; // positivo
  let notaBase = pontosMax > 0 ? (pontosObtidos/pontosMax)*100 : 0;
  let notaFinal = Math.max(0, Math.round((notaBase - penalizacao)*10)/10);
  const conceito = conceitoDe(notaFinal);
  return {
    pontosObtidos, pontosMax,
    notaTecnica: subnotas.tecnica,
    notaComunicacao: subnotas.comunicacao,
    notaHumanizacao: subnotas.humanizacao,
    notaProcesso: subnotas.processo,
    totalDescontadoPortugues: totalDescontado,
    penalizacaoPortugues: penalizacao,
    notaFinal,
    conceito: conceito.nome,
    conceitoCor: conceito.cor,
  };
}

function percentualPorCategoria(av){
  const out = {};
  for (const cat of CATEGORIA_ORDEM){
    out[cat] = calcularSubnota(respostasEfetivas(av), [cat], criteriosDe(av));
  }
  return out;
}

if (typeof module !== "undefined" && module.exports){
  module.exports = { CRITERIOS, CRITERIOS_V1, CRITERIOS_V2, MODELO_ATUAL, modeloDe, criteriosDe, criteriosPerguntaDe,
    usouFraseProibida, respostasEfetivas, CATEGORIAS, CATEGORIA_ORDEM, SUBNOTA_MAP, PORTUGUES_CATEGORIAS, FRASES_PROIBIDAS,
    IMPACTO_OPCOES, CONCEITO_FAIXAS, STATUS_MONITORIA_OPCOES, conceitoDe, calcularSubnota,
    calcularPenalizacaoPortugues, calcularResultado, percentualPorCategoria };
}
