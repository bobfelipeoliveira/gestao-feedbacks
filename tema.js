/* Tema claro/escuro.
   Carregado no <head>, antes do CSS, para a página já abrir no tema certo (sem "piscar").
   Preferência guardada só neste navegador. Sem escolha salva, segue o tema do sistema operacional. */
(function(){
  var CHAVE = "sgf_tema";
  function salvo(){ try{ return localStorage.getItem(CHAVE); }catch(e){ return null; } }
  function doSistema(){ try{ return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }catch(e){ return "light"; } }
  function aplicar(t){ document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light"); }

  aplicar(salvo() || doSistema());

  window.temaAtual = function(){ return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; };
  window.alternarTema = function(){
    var novo = window.temaAtual() === "dark" ? "light" : "dark";
    aplicar(novo);
    try{ localStorage.setItem(CHAVE, novo); }catch(e){}
    return novo;
  };
  /* Se a pessoa nunca escolheu, acompanha a mudança do sistema operacional. */
  try{
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function(e){
      if (!salvo()){ aplicar(e.matches ? "dark" : "light"); if (typeof window.aoMudarTema === "function") window.aoMudarTema(); }
    });
  }catch(e){}
})();
