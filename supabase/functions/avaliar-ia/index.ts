// =====================================================================
// Edge Function "avaliar-ia" — envia a transcrição ao Claude Opus 5.5
// e devolve a sugestão de avaliação.
//
// Segurança:
//  - A chave da Anthropic fica SOMENTE aqui (secret ANTHROPIC_API_KEY).
//  - Quem pode usar é decidido NO BANCO (rpc autorizar_uso_ia), com o
//    login do próprio usuário: precisa estar ativo, com senha trocada e
//    com a IA liberada pelo admin. O banco também aplica o limite de uso
//    (20/hora, 80/dia por usuário) e grava a auditoria.
//  - Só aceita chamadas vindas do site do sistema (ALLOWED_ORIGINS).
//  - CPF, e-mails e telefones são mascarados aqui também, antes do envio.
// =====================================================================
import Anthropic from "npm:@anthropic-ai/sdk@1.7.0";

const MODELO = "claude-opus-5-5";
const ORIGENS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://bobfelipeoliveira.github.io")
  .split(",").map((s) => s.trim()).filter(Boolean);

function cabecalhosCors(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ORIGENS.includes(origin) ? origin : ORIGENS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function responder(status: number, corpo: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function mascarar(t: string): string {
  return t
    .replace(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, "[CPF]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[E-MAIL]")
    .replace(/(?<!\d)(?:\+?55\s?)?(?:\(\d{2}\)\s?|\d{2}\s)?9?\d{4}-?\d{4}(?!\d)/g, "[TELEFONE]");
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin") ?? "";
  const cors = cabecalhosCors(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder(405, { erro: "Método não permitido." }, cors);
  if (!ORIGENS.includes(origin)) return responder(403, { erro: "Origem não permitida." }, cors);

  const authorization = req.headers.get("authorization");
  const apikey = req.headers.get("apikey");
  if (!authorization || !apikey) return responder(401, { erro: "Faça login novamente." }, cors);

  // ---- entrada ----
  let corpo: { system?: unknown; conteudo?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return responder(400, { erro: "Dados inválidos." }, cors);
  }
  const system = corpo.system;
  const conteudo = corpo.conteudo;
  if (typeof system !== "string" || system.length < 50 || system.length > 30000) {
    return responder(400, { erro: "Instruções inválidas." }, cors);
  }
  if (typeof conteudo !== "string" || conteudo.trim().length < 50 || conteudo.length > 200000) {
    return responder(400, { erro: "Transcrição vazia, curta ou longa demais." }, cors);
  }

  // ---- autorização + limite de uso + auditoria (no banco, com o login do usuário) ----
  const urlBanco = Deno.env.get("SUPABASE_URL");
  if (!urlBanco) return responder(500, { erro: "Configuração do servidor incompleta." }, cors);
  const aut = await fetch(`${urlBanco}/rest/v1/rpc/autorizar_uso_ia`, {
    method: "POST",
    headers: { authorization, apikey, "content-type": "application/json" },
    body: JSON.stringify({ p_caracteres: conteudo.length }),
  });
  const autCorpo = await aut.json().catch(() => null);
  if (!aut.ok) {
    const msg = autCorpo && typeof autCorpo.message === "string" ? autCorpo.message : "Acesso à IA negado.";
    return responder(aut.status === 401 ? 401 : 403, { erro: msg }, cors);
  }
  const texto = autCorpo && autCorpo.mascarar === false ? conteudo : mascarar(conteudo);

  // ---- Claude ----
  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    return responder(503, { erro: "A chave da Anthropic ainda não foi configurada no Supabase." }, cors);
  }
  const client = new Anthropic({ timeout: 140_000, maxRetries: 1 }); // lê ANTHROPIC_API_KEY
  try {
    const resposta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      // se o modelo recusar por política de segurança, a API tenta de novo num modelo alternativo
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: texto }],
    });

    if (resposta.stop_reason === "refusal") {
      return responder(422, { erro: "A IA não conseguiu analisar esta transcrição. Faça a avaliação manualmente." }, cors);
    }
    const saida = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");
    if (!saida.trim()) {
      return responder(502, { erro: "A IA não devolveu resposta. Tente novamente." }, cors);
    }
    return responder(200, {
      texto: saida,
      modelo: resposta.model,
      incompleta: resposta.stop_reason === "max_tokens",
    }, cors);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return responder(502, { erro: "Chave da Anthropic inválida. Avise o administrador." }, cors);
    }
    if (e instanceof Anthropic.RateLimitError) {
      return responder(429, { erro: "Limite da Anthropic atingido. Aguarde um pouco e tente de novo." }, cors);
    }
    if (e instanceof Anthropic.APIError) {
      console.error("Erro da API Anthropic:", e.status, e.message);
      const semCredito = e.status === 400 && /credit|billing|balance/i.test(e.message);
      return responder(502, {
        erro: semCredito
          ? "Sem créditos na conta da Anthropic. Avise o administrador."
          : `A IA retornou um erro (${e.status ?? "?"}). Tente novamente.`,
      }, cors);
    }
    console.error("Falha inesperada:", e);
    return responder(500, { erro: "Falha ao consultar a IA. Tente novamente." }, cors);
  }
});
