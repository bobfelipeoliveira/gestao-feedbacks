/* ============================================================
   ACESSO: login, troca de senha, menu do usuário,
   gestão de usuários e auditoria (somente administrador)
   ============================================================ */

function telaCentral(conteudo){
  const root = document.getElementById("app");
  root.innerHTML = "";
  const dock = document.getElementById("audio-dock");
  if (dock) dock.style.display = "none";
  root.appendChild(el("div", {class:"auth-wrap"}, [
    el("div", {class:"auth-card"}, [
      el("div", {class:"auth-brand"}, [el("span", {class:"brand-mark"}, "◆"), el("span", {class:"brand-name"}, "Sistema de Gestão de Feedbacks")]),
      conteudo,
    ]),
  ]));
}

function renderLogin(mensagem){
  USUARIO = null; STATE = null; RASCUNHO = null;
  const inUser = el("input", {type:"text", class:"input", name:"username", autocomplete:"username", autocapitalize:"none", spellcheck:"false", required:"required", placeholder:"Ex.: Nome.Sobrenome"});
  const inSenha = el("input", {type:"password", class:"input", name:"password", autocomplete:"current-password", required:"required"});
  const erro = el("div", {class:"banner-erro", style: mensagem ? "" : "display:none"}, mensagem || "");
  const btn = el("button", {type:"submit", class:"btn btn-primary btn-lg", style:"width:100%"}, "Entrar");

  const form = el("form", {class:"auth-form"}, [
    el("h2", {}, "Entrar"),
    el("p", {class:"muted"}, "Acesso restrito à coordenação da Intercorrência."),
    erro,
    campo("Usuário", inUser),
    campo("Senha", inSenha),
    btn,
  ]);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    btn.disabled = true; btn.textContent = "Entrando…"; erro.style.display = "none";
    try{
      const r = await api("POST", "/api/login", {username: inUser.value, senha: inSenha.value});
      USUARIO = r.usuario;
      inSenha.value = "";
      if (USUARIO.mustChangePw){ renderTrocaSenha(true); return; }
      try{ await carregarEstado(); }catch(e){ return; }
      ROUTE = {view:"home", params:{}};
      renderApp();
    }catch(e){
      erro.textContent = e.message; erro.style.display = "";
      btn.disabled = false; btn.textContent = "Entrar";
      inSenha.value = ""; inSenha.focus();
    }
  });
  telaCentral(form);
  inUser.focus();
}

function formTrocaSenha(obrigatoria, onOk){
  const inAtual = el("input", {type:"password", class:"input", autocomplete:"current-password", required:"required"});
  const inNova = el("input", {type:"password", class:"input", autocomplete:"new-password", required:"required"});
  const inConf = el("input", {type:"password", class:"input", autocomplete:"new-password", required:"required"});
  const erro = el("div", {class:"banner-erro", style:"display:none"});
  const btn = el("button", {type:"submit", class:"btn btn-primary"}, "Salvar nova senha");
  const form = el("form", {class:"auth-form"}, [
    el("h2", {}, obrigatoria ? "Crie sua senha pessoal" : "Trocar minha senha"),
    obrigatoria ? el("div", {class:"banner-aviso"}, "Por segurança, a senha inicial precisa ser trocada no primeiro acesso. Ninguém além de você — nem o administrador — saberá a nova senha.") : null,
    erro,
    campo("Senha atual", inAtual),
    campo("Nova senha", inNova, "Mínimo de 10 caracteres, com letra maiúscula, minúscula, número e símbolo."),
    campo("Confirme a nova senha", inConf),
    el("div", {class:"form-actions"}, [
      btn,
      obrigatoria ? el("button", {type:"button", class:"btn btn-ghost", onclick: sair}, "Sair") : null,
    ]),
  ]);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    erro.style.display = "none";
    if (inNova.value !== inConf.value){ erro.textContent = "A confirmação não confere com a nova senha."; erro.style.display = ""; return; }
    btn.disabled = true;
    try{
      await api("POST", "/api/senha", {atual: inAtual.value, nova: inNova.value});
      inAtual.value = inNova.value = inConf.value = "";
      USUARIO.mustChangePw = false;
      onOk();
    }catch(e){
      erro.textContent = e.message; erro.style.display = "";
      btn.disabled = false;
    }
  });
  return form;
}

function renderTrocaSenha(obrigatoria){
  telaCentral(formTrocaSenha(obrigatoria, async () => {
    try{
      await carregarEstado();
      ROUTE = {view:"home", params:{}};
      renderApp();
      alert("Senha alterada com sucesso.");
    }catch(e){ /* carregarEstado já mostrou a tela adequada */ }
  }));
}

function renderMinhaSenha(main){
  const page = el("div", {class:"page page-narrow"});
  page.appendChild(el("div", {class:"card"}, formTrocaSenha(false, () => { alert("Senha alterada com sucesso. Suas outras sessões abertas foram encerradas."); irPara("home"); })));
  main.appendChild(page);
}

async function sair(){
  try{ await api("POST", "/api/logout", {}); }catch(e){}
  renderLogin();
}

function menuUsuario(){
  if (!USUARIO) return null;
  return el("div", {class:"user-menu"}, [
    el("span", {class:"user-chip", title: USUARIO.username}, [
      el("span", {class:"user-nome"}, USUARIO.nome),
      el("span", {class:"pill" + (ehAdmin() ? "" : " pill-muted")}, ehAdmin() ? "Administrador" : "Coordenador(a)"),
    ]),
    el("button", {class:"btn btn-ghost btn-sm", onclick:()=>irPara("minha-senha")}, "Minha senha"),
    el("button", {class:"btn btn-ghost btn-sm", onclick: sair}, "Sair"),
  ]);
}

/* ---------------- Usuários (admin) ---------------- */
var USUARIOS_CACHE = null;

async function carregarUsuarios(){
  USUARIOS_CACHE = (await api("GET", "/api/usuarios")).usuarios;
}

function renderUsuarios(main){
  const page = el("div", {class:"page"});
  page.appendChild(el("div", {class:"page-header"}, [
    el("h1", {}, "Usuários"),
    el("p", {class:"page-sub"}, "Quem pode acessar o sistema. Apenas você (administrador) vê esta tela."),
  ]));

  page.appendChild(el("details", {class:"card"}, [
    el("summary", {style:"cursor:pointer; font-weight:600;"}, "Como adicionar uma pessoa ou redefinir uma senha"),
    el("ol", {class:"ia-passos", style:"margin-top:10px"}, [
      el("li", {}, "No painel do Supabase: Authentication → Users → Add user → Create new user."),
      el("li", {}, `E-mail: login da pessoa + @${SGF_CONFIG.dominioLogin} (ex.: Nome.Sobrenome@${SGF_CONFIG.dominioLogin}). Defina uma senha temporária e marque “Auto Confirm User”.`),
      el("li", {}, "Volte aqui e clique em “Liberar acesso”. Todo usuário novo entra BLOQUEADO até você liberar."),
      el("li", {}, "No primeiro login a pessoa é obrigada a trocar a senha temporária."),
      el("li", {}, "Para redefinir senha: no Supabase, abra o usuário → “Send password recovery” (se o e-mail existir) ou exclua e recrie o usuário."),
    ]),
  ]));

  const lista = el("div", {class:"table-card", style:"margin-top:16px"});
  page.appendChild(lista);
  main.appendChild(page);

  if (!USUARIOS_CACHE){
    lista.appendChild(el("div", {class:"muted", style:"padding:16px"}, "Carregando…"));
    carregarUsuarios().then(renderApp).catch(()=>{});
    return;
  }
  lista.appendChild(el("div", {class:"table-head table-usuarios"}, ["Usuário","Nome","Perfil","Situação","Criado em","Ações"].map(h=>el("div",{class:"th"},h))));
  for (const u of USUARIOS_CACHE){
    const souEu = u.id === USUARIO.id;
    const situacao = !u.active ? "🔒 Bloqueado" : u.mustChangePw ? "Aguardando 1º acesso" : "✅ Ativo";
    lista.appendChild(el("div", {class:"table-row table-usuarios"}, [
      el("div", {class:"td"}, u.username),
      el("div", {class:"td"}, u.nome),
      el("div", {class:"td"}, u.role === "admin" ? "Administrador" : "Coordenador"),
      el("div", {class:"td"}, situacao),
      el("div", {class:"td"}, u.createdAt ? fmtData(u.createdAt) : "—"),
      el("div", {class:"td acoes-usuario"}, souEu ? el("span", {class:"muted"}, "(você)") : [
        el("button", {class:"btn btn-ghost btn-sm", onclick:()=>acaoUsuario(u, {active: !u.active}, u.active ? `Bloquear o acesso de ${u.username}? A pessoa sai do sistema na próxima ação.` : `Liberar o acesso de ${u.username}?`)}, u.active ? "Bloquear" : "Liberar acesso"),
        el("button", {class:"btn btn-ghost btn-sm", onclick:()=>acaoUsuario(u, {role: u.role === "admin" ? "coordenador" : "admin"}, u.role === "admin" ? `Remover o perfil de administrador de ${u.username}?` : `Tornar ${u.username} ADMINISTRADOR? A pessoa passará a ter os mesmos poderes que você.`)}, u.role === "admin" ? "Tornar coordenador" : "Tornar admin"),
      ]),
    ]));
  }
}

async function acaoUsuario(u, mudanca, confirmacao){
  if (confirmacao && !confirm(confirmacao)) return;
  try{
    await salvarNoServidor(() => api("PATCH", "/api/usuarios/" + u.id, mudanca), "Não foi possível alterar o usuário.");
    await carregarUsuarios(); renderApp();
  }catch(e){}
}

/* ---------------- Auditoria (admin) ---------------- */
var AUDITORIA_CACHE = null;
var ACAO_ROTULOS = {
  "login":"Login", "login.negado":"Login negado (acesso bloqueado)", "logout":"Logout", "avaliacao.importada":"Importou avaliação",
  "senha.alterada":"Trocou a senha", "avaliacao.criada":"Registrou avaliação", "avaliacao.editada":"Editou avaliação", "avaliacao.excluida":"Excluiu avaliação",
  "audio.criado":"Cadastrou áudio", "colaborador.salvo":"Salvou colaborador", "backup.exportado":"Exportou backup",
  "backup.importado":"Importou backup", "config.alterada":"Alterou configurações", "usuario.criado":"Criou usuário",
  "usuario.alterado":"Alterou usuário", "ia.chamada":"Usou a IA", "seed.usuarios":"Usuários iniciais criados",
};

function renderAuditoria(main){
  const page = el("div", {class:"page"});
  page.appendChild(el("div", {class:"page-header flex-between"}, [
    el("div", {}, [
      el("h1", {}, "Auditoria"),
      el("p", {class:"page-sub"}, "Registro de quem fez o quê e quando (últimos 500 eventos)."),
    ]),
    el("button", {class:"btn btn-secondary btn-sm", onclick:()=>{ AUDITORIA_CACHE = null; renderApp(); }}, "↻ Atualizar"),
  ]));
  const lista = el("div", {class:"table-card"});
  page.appendChild(lista);
  main.appendChild(page);
  if (!AUDITORIA_CACHE){
    lista.appendChild(el("div", {class:"muted", style:"padding:16px"}, "Carregando…"));
    api("GET", "/api/auditoria").then(r => { AUDITORIA_CACHE = r.eventos; renderApp(); }).catch(()=>{});
    return;
  }
  lista.appendChild(el("div", {class:"table-head table-auditoria"}, ["Data/hora","Usuário","Ação","Alvo","IP"].map(h=>el("div",{class:"th"},h))));
  for (const ev of AUDITORIA_CACHE){
    lista.appendChild(el("div", {class:"table-row table-auditoria"}, [
      el("div", {class:"td"}, fmtDataHora(ev.at)),
      el("div", {class:"td"}, ev.username || "—"),
      el("div", {class:"td"}, ACAO_ROTULOS[ev.acao] || ev.acao),
      el("div", {class:"td"}, ev.alvo || "—"),
      el("div", {class:"td muted"}, ev.ip || "—"),
    ]));
  }
}
