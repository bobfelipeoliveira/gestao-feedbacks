/* ============================================================
   MEU ACOMPANHAMENTO INDIVIDUAL
   Caderno PRIVADO de cada avaliador sobre cada colaborador.

   A privacidade é garantida no BANCO (Row Level Security, seção 10
   do supabase/schema.sql): cada pessoa só recebe do servidor as
   próprias anotações. Esta tela apenas organiza o que o banco devolve.
   Só quem tem a permissão especial de supervisão (dada pelo SQL Editor
   do Supabase) recebe as anotações de todos.
   ============================================================ */

var ACOMP = {
  supervisor: null,         // null = ainda não consultado
  modo: "minhas",           // "minhas" | "todas" (só supervisor)
  colabId: "",
  busca: "",
  mostrarDesligados: false,
  contagem: null,           // {colaboradorId: n} das MINHAS anotações
  notas: null,              // lista carregada para a seleção atual
  chaveNotas: "",           // identifica a consulta que gerou "notas"
  carregando: false,
  erro: "",
  rascunho: "",
  salvando: false,
  editandoId: null,
  editTexto: "",
  filtroAutor: "",
  filtroColab: "",
};
var ACOMP_LIMITE = 20000;

function acompChave(){
  return ACOMP.modo === "todas"
    ? "todas|" + ACOMP.filtroAutor + "|" + ACOMP.filtroColab
    : "minhas|" + ACOMP.colabId;
}

async function acompCarregar(forcar){
  const chave = acompChave();
  if (!forcar && ACOMP.chaveNotas === chave && ACOMP.notas) return;
  if (ACOMP.modo === "minhas" && !ACOMP.colabId){ ACOMP.notas = null; ACOMP.chaveNotas = chave; return; }
  ACOMP.carregando = true; ACOMP.erro = "";
  try{
    ACOMP.notas = await api("POST", "/api/anotacoes/listar", ACOMP.modo === "todas"
      ? {escopo:"todas", autor: ACOMP.filtroAutor || undefined, colaboradorId: ACOMP.filtroColab || undefined}
      : {escopo:"minhas", colaboradorId: ACOMP.colabId});
    ACOMP.chaveNotas = chave;
  }catch(e){
    ACOMP.erro = e.message; ACOMP.notas = [];
  }finally{
    ACOMP.carregando = false;
  }
}

async function acompIniciar(){
  try{
    const [ctx, cont] = await Promise.all([api("GET", "/api/anotacoes/contexto"), api("GET", "/api/anotacoes/minhas-contagem")]);
    ACOMP.supervisor = ctx.supervisor; ACOMP.contagem = cont;
    if (!ACOMP.supervisor) ACOMP.modo = "minhas";
  }catch(e){
    ACOMP.supervisor = false; ACOMP.contagem = {}; ACOMP.erro = e.message;
  }
  await acompCarregar(true);
  if (ROUTE.view === "acompanhamento") renderApp();
}

function acompTrocar(mudancas){
  Object.assign(ACOMP, mudancas, {editandoId: null});
  acompCarregar(false).then(() => { if (ROUTE.view === "acompanhamento") renderApp(); });
  renderApp();
}

/* ---------------- ações ---------------- */
async function acompSalvarNova(){
  const texto = ACOMP.rascunho.trim();
  if (!texto || ACOMP.salvando) return;
  if (texto.length > ACOMP_LIMITE){ alert(`A anotação passou de ${ACOMP_LIMITE} caracteres.`); return; }
  ACOMP.salvando = true; renderApp();
  try{
    const nova = await api("POST", "/api/anotacoes", {colaboradorId: ACOMP.colabId, texto});
    ACOMP.rascunho = "";
    if (ACOMP.notas && ACOMP.chaveNotas === acompChave()) ACOMP.notas.unshift(nova);
    ACOMP.contagem[ACOMP.colabId] = (ACOMP.contagem[ACOMP.colabId] || 0) + 1;
  }catch(e){
    alert("A anotação NÃO foi salva. O texto continua na tela.\n\n" + e.message);
  }finally{
    ACOMP.salvando = false; renderApp();
  }
}

async function acompSalvarEdicao(n){
  const texto = ACOMP.editTexto.trim();
  if (!texto){ alert("A anotação não pode ficar vazia. Para remover, use Excluir."); return; }
  if (texto.length > ACOMP_LIMITE){ alert(`A anotação passou de ${ACOMP_LIMITE} caracteres.`); return; }
  try{
    await api("POST", "/api/anotacoes/editar", {id: n.id, texto});
    ACOMP.editandoId = null;
    await acompCarregar(true);
  }catch(e){
    alert("Não foi possível salvar a edição.\n\n" + e.message);
  }
  renderApp();
}

async function acompExcluir(n){
  const deOutro = n.autor_id !== USUARIO.id;
  if (!confirm((deOutro ? `Esta anotação é de ${n.autor_username}. ` : "") + "Excluir esta anotação definitivamente? Não é possível desfazer.")) return;
  try{
    await api("POST", "/api/anotacoes/excluir", {id: n.id});
    if (!deOutro && ACOMP.contagem[n.colaborador_id]) ACOMP.contagem[n.colaborador_id]--;
    await acompCarregar(true);
  }catch(e){
    alert("Não foi possível excluir.\n\n" + e.message);
  }
  renderApp();
}

/* ---------------- tela ---------------- */
function renderAcompanhamento(main){
  const page = el("div", {class:"page"});
  page.appendChild(el("div", {class:"page-header"}, [
    el("h1", {}, "Meu Acompanhamento"),
    el("p", {class:"page-sub"}, "Seu caderno particular de percepções sobre cada colaborador. Não interfere nas avaliações, notas ou feedbacks."),
  ]));
  main.appendChild(page);

  if (ACOMP.supervisor === null){
    page.appendChild(el("div", {class:"muted"}, "Carregando…"));
    acompIniciar();
    return;
  }

  page.appendChild(el("div", {class:"acomp-privacidade"}, ACOMP.supervisor
    ? "🔒 Suas anotações são visíveis apenas para você. Como supervisor do sistema, você também pode consultar as anotações dos demais avaliadores, que não veem as suas nem as umas das outras."
    : "🔒 Espaço privado: suas anotações são visíveis apenas para você e para o administrador do sistema (supervisão). Os demais avaliadores não têm acesso."));

  if (ACOMP.supervisor){
    page.appendChild(el("div", {class:"acomp-abas"}, [
      el("button", {class:"acomp-aba" + (ACOMP.modo === "minhas" ? " acomp-aba-ativa" : ""), onclick:()=>acompTrocar({modo:"minhas"})}, "Minhas anotações"),
      el("button", {class:"acomp-aba" + (ACOMP.modo === "todas" ? " acomp-aba-ativa" : ""), onclick:()=>acompTrocar({modo:"todas"})}, "Todos os avaliadores (supervisão)"),
    ]));
  }

  if (ACOMP.erro) page.appendChild(el("div", {class:"banner-erro"}, ACOMP.erro));

  page.appendChild(ACOMP.modo === "todas" ? acompPainelSupervisao() : acompPainelMinhas());
}

function acompListaColaboradores(){
  const termo = ACOMP.busca.trim().toLowerCase();
  const lista = ordenarColabs(STATE.colaboradores)
    .filter(c => ACOMP.mostrarDesligados || naEquipe(c) || c.id === ACOMP.colabId)
    .filter(c => !termo || (c.nome || "").toLowerCase().includes(termo));

  const busca = el("input", {type:"search", class:"input", placeholder:"Buscar colaborador…", value: ACOMP.busca, "data-focuskey":"acomp-busca"});
  busca.addEventListener("input", e => { ACOMP.busca = e.target.value; renderApp(); });
  const cbDesl = el("input", {type:"checkbox"}); cbDesl.checked = ACOMP.mostrarDesligados;
  cbDesl.addEventListener("change", () => { ACOMP.mostrarDesligados = cbDesl.checked; renderApp(); });

  return el("aside", {class:"acomp-lateral"}, [
    busca,
    el("label", {class:"criterios-toggle-pendentes", style:"margin:8px 0 6px;"}, [cbDesl, el("span", {}, "Mostrar desligados")]),
    el("div", {class:"acomp-colabs"}, lista.length ? lista.map(c => {
      const n = (ACOMP.contagem || {})[c.id] || 0;
      return el("button", {
        class:"acomp-colab" + (c.id === ACOMP.colabId ? " acomp-colab-ativo" : ""),
        onclick:()=>acompTrocar({colabId: c.id}),
      }, [
        el("span", {class:"acomp-colab-nome"}, c.nome + (naEquipe(c) ? "" : " (desligado)")),
        n ? el("span", {class:"acomp-contador", title:"Suas anotações"}, String(n)) : null,
      ]);
    }) : el("div", {class:"muted", style:"padding:10px"}, "Nenhum colaborador encontrado.")),
  ]);
}

function acompPainelMinhas(){
  const wrap = el("div", {class:"acomp-grid"}, [acompListaColaboradores()]);
  const c = ACOMP.colabId ? colaboradorPorId(ACOMP.colabId) : null;
  if (!c){
    wrap.appendChild(el("section", {class:"acomp-principal"}, el("div", {class:"empty-state"}, [
      el("div", {class:"empty-icon"}, "📓"),
      el("p", {}, "Selecione um colaborador para ver e registrar suas anotações."),
    ])));
    return wrap;
  }

  const ta = el("textarea", {class:"input textarea acomp-texto", placeholder:`Escreva livremente o que você percebe sobre ${c.nome}…`, maxlength: String(ACOMP_LIMITE)});
  ta.value = ACOMP.rascunho;
  const contador = el("span", {class:"muted"}, ACOMP.rascunho.length ? `${ACOMP.rascunho.length} caracteres` : "");
  const btn = el("button", {class:"btn btn-primary", disabled: ACOMP.salvando ? "disabled" : undefined, onclick: acompSalvarNova}, ACOMP.salvando ? "Salvando…" : "Salvar anotação");
  // sem redesenhar a tela a cada tecla (evita perder o clique em "Salvar")
  ta.addEventListener("input", e => { ACOMP.rascunho = e.target.value; contador.textContent = ACOMP.rascunho.length ? `${ACOMP.rascunho.length} caracteres` : ""; });

  const notas = ACOMP.chaveNotas === acompChave() ? ACOMP.notas : null;
  wrap.appendChild(el("section", {class:"acomp-principal"}, [
    el("div", {class:"acomp-cabecalho"}, [
      el("h2", {}, c.nome),
      el("div", {class:"muted"}, [c.funcao, c.turno].filter(Boolean).join(" · ")),
    ]),
    el("div", {class:"card acomp-nova"}, [
      el("label", {class:"field-label"}, "Nova anotação"),
      ta,
      el("div", {class:"form-actions", style:"justify-content:space-between; align-items:center;"}, [contador, btn]),
    ]),
    el("h3", {class:"section-title"}, notas ? `Seu histórico (${notas.length})` : "Seu histórico"),
    acompListaNotas(notas, false),
  ]));
  return wrap;
}

function acompPainelSupervisao(){
  const autores = [...new Set((ACOMP.notas || []).map(n => n.autor_username).concat(ACOMP.filtroAutor ? [ACOMP.filtroAutor] : []))].filter(Boolean).sort();
  const selAutor = el("select", {class:"input"}, [el("option", {value:""}, "Todos os avaliadores"), ...autores.map(a => el("option", {value:a, selected: a === ACOMP.filtroAutor ? "selected" : undefined}, a))]);
  selAutor.addEventListener("change", e => acompTrocar({filtroAutor: e.target.value}));
  const selColab = el("select", {class:"input"}, [el("option", {value:""}, "Todos os colaboradores"),
    ...ordenarColabs(STATE.colaboradores).map(c => el("option", {value:c.id, selected: c.id === ACOMP.filtroColab ? "selected" : undefined}, c.nome + (naEquipe(c) ? "" : " (desligado)")))]);
  selColab.addEventListener("change", e => acompTrocar({filtroColab: e.target.value}));
  const notas = ACOMP.chaveNotas === acompChave() ? ACOMP.notas : null;
  return el("div", {}, [
    el("div", {class:"card filtros-card acomp-filtros"}, [
      campo("Avaliador", selAutor),
      campo("Colaborador", selColab),
      el("button", {class:"btn btn-ghost", onclick:()=>acompTrocar({filtroAutor:"", filtroColab:""})}, "Limpar filtros"),
    ]),
    el("h3", {class:"section-title"}, notas ? `${notas.length} anotação(ões)${notas.length >= 1000 ? " — mostrando as 1000 mais recentes" : ""}` : "Anotações"),
    acompListaNotas(notas, true),
  ]);
}

function acompListaNotas(notas, mostrarColaborador){
  if (ACOMP.carregando || notas === null) return el("div", {class:"muted"}, "Carregando…");
  if (!notas.length) return el("div", {class:"empty-state", style:"padding:24px"}, el("p", {}, "Nenhuma anotação ainda."));
  return el("div", {class:"acomp-notas"}, notas.map(n => acompCartao(n, mostrarColaborador)));
}

function acompCartao(n, mostrarColaborador){
  const minha = n.autor_id === USUARIO.id;
  const cab = el("div", {class:"acomp-nota-cab"}, [
    el("span", {class:"acomp-nota-meta"}, [
      mostrarColaborador ? el("strong", {}, colaboradorNome(n.colaborador_id) + " · ") : null,
      el("span", {class: minha ? "acomp-autor acomp-autor-eu" : "acomp-autor"}, minha ? "Você" : n.autor_username),
      ` · ${fmtDataHora(n.criado_em)}`,
      n.editado_em ? el("span", {class:"muted"}, ` · editada em ${fmtDataHora(n.editado_em)}${n.editado_por && n.editado_por !== n.autor_username ? " por " + n.editado_por : ""}`) : null,
    ]),
    ACOMP.editandoId === n.id ? null : el("span", {class:"acomp-nota-acoes"}, [
      el("button", {class:"btn btn-ghost btn-sm", onclick:()=>{ ACOMP.editandoId = n.id; ACOMP.editTexto = n.texto; renderApp(); }}, "Editar"),
      el("button", {class:"btn btn-ghost btn-sm acomp-excluir", onclick:()=>acompExcluir(n)}, "Excluir"),
    ]),
  ]);

  if (ACOMP.editandoId === n.id){
    const ta = el("textarea", {class:"input textarea acomp-texto", maxlength: String(ACOMP_LIMITE)});
    ta.value = ACOMP.editTexto;
    ta.addEventListener("input", e => { ACOMP.editTexto = e.target.value; });
    return el("div", {class:"acomp-nota acomp-nota-editando"}, [
      cab, ta,
      el("div", {class:"form-actions"}, [
        el("button", {class:"btn btn-ghost btn-sm", onclick:()=>{ ACOMP.editandoId = null; renderApp(); }}, "Cancelar"),
        el("button", {class:"btn btn-primary btn-sm", onclick:()=>acompSalvarEdicao(n)}, "Salvar"),
      ]),
    ]);
  }
  return el("div", {class:"acomp-nota" + (minha ? "" : " acomp-nota-outro")}, [
    cab,
    el("div", {class:"acomp-nota-texto"}, n.texto),   // texto puro (nunca interpretado como HTML)
  ]);
}

/* Sempre que a tela de login aparece (sair, sessão expirada, acesso bloqueado),
   apaga da memória tudo o que era do usuário anterior. */
function acompLimpar(){
  Object.assign(ACOMP, {supervisor:null, modo:"minhas", colabId:"", busca:"", contagem:null, notas:null, chaveNotas:"",
    carregando:false, erro:"", rascunho:"", salvando:false, editandoId:null, editTexto:"", filtroAutor:"", filtroColab:""});
}
(function(){
  const original = window.renderLogin;
  if (typeof original === "function"){
    window.renderLogin = function(){ acompLimpar(); return original.apply(this, arguments); };
  }
})();
