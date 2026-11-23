/* ============================================================
   CONFIGURAÇÃO DO SUPABASE
   Preencha com os dados do SEU projeto:
   Supabase → Project Settings → API (ou "Connect").
   ------------------------------------------------------------
   É SEGURO deixar estes dois valores aqui, mesmo com o
   repositório público: a chave "anon/publishable" é pública por
   natureza. Quem protege os dados são as regras do banco
   (supabase/schema.sql).
   NUNCA coloque aqui a chave "service_role" / "secret".
   ============================================================ */
var SGF_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "COLE_AQUI_A_CHAVE_ANON_PUBLICA",
  // o login "Nome.Sobrenome" vira o e-mail "nome.sobrenome@<dominioLogin>" no Supabase
  dominioLogin: "solarcuidados.com.br",
};
