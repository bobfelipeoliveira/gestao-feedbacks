-- =====================================================================
-- Sistema de Gestão de Feedbacks — estrutura do banco no Supabase
-- Execute este arquivo INTEIRO no Supabase: SQL Editor → New query → Run.
-- Pode ser executado de novo com segurança (é idempotente).
--
-- TODA a segurança fica aqui (Row Level Security): o navegador só usa a
-- chave pública "anon", e o banco decide o que cada usuário pode ver/fazer.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfis de usuário (ligados ao login do Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  username       text not null,
  nome           text not null,
  role           text not null default 'coordenador' check (role in ('admin','coordenador')),
  ativo          boolean not null default false,   -- novo usuário entra BLOQUEADO até o admin liberar
  must_change_pw boolean not null default true,    -- troca obrigatória da senha inicial
  criado_em      timestamptz not null default now()
);
create unique index if not exists perfis_username on public.perfis (lower(username));

create table if not exists public.colaboradores (
  id          text primary key check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);

create table if not exists public.avaliacoes (
  id          text primary key check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  data        jsonb not null,
  autor_id    uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.audios (
  id          text primary key check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  data        jsonb not null,
  autor_id    uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.config (
  chave  text primary key,
  valor  jsonb not null
);
insert into public.config (chave, valor) values
  ('coordenadorVeTodas', 'true'::jsonb),
  ('iaMascarar', 'true'::jsonb)
on conflict (chave) do nothing;

create table if not exists public.auditoria (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  user_id   uuid,
  username  text,
  acao      text not null,
  alvo      text,
  detalhes  jsonb
);
create index if not exists auditoria_at on public.auditoria (at desc);

-- ---------------------------------------------------------------------
-- 2. Funções auxiliares de permissão (SECURITY DEFINER = leem perfis sem RLS)
-- ---------------------------------------------------------------------
create or replace function public.usuario_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where user_id = auth.uid() and ativo and not must_change_pw);
$$;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where user_id = auth.uid() and ativo and not must_change_pw and role = 'admin');
$$;

create or replace function public.coordenador_ve_todas() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select valor = 'true'::jsonb from config where chave = 'coordenadorVeTodas'), true);
$$;

create or replace function public.auditar(p_acao text, p_alvo text, p_detalhes jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (user_id, username, acao, alvo, detalhes)
  values (auth.uid(), (select username from perfis where user_id = auth.uid()), p_acao, p_alvo, p_detalhes);
end $$;

-- Eventos que o próprio navegador pode registrar (somente estes, e só para o usuário logado)
create or replace function public.registrar_evento(p_acao text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if p_acao not in ('login', 'logout', 'backup.exportado', 'login.negado') then
    raise exception 'evento não permitido';
  end if;
  perform auditar(p_acao, null, null);
end $$;

-- ---------------------------------------------------------------------
-- 3. Cálculo da nota NO BANCO (mesma regra de regras.js).
--    O valor enviado pelo navegador é ignorado: ninguém consegue forjar nota.
-- ---------------------------------------------------------------------
create or replace function public.calcular_resultado(av jsonb) returns jsonb
language plpgsql immutable as $$
declare
  crits constant text[] := array[
    'A1','A2','A3','A4','B1','B2','B3','B4','B5','B6','B7','C1','C2','C3','C4','C5',
    'D1','D2','D3','D4','E1','E2','E3','E4','E5','F1','F2','F3','F4','F5'];
  c text; v text; n numeric;
  obt numeric := 0; maxp numeric := 0;
  s_cat jsonb := '{}'::jsonb;  -- {cat: [soma, count]}
  pesos constant jsonb := '{"concordancia":-2,"pronomes":-1,"regencia":-1.5,"vocabulario":-1,"conjugacao":-2}';
  k text; total numeric := 0; penal numeric; base numeric; final numeric;
  conceito text; cor text;
begin
  foreach c in array crits loop
    v := av->'criterios'->>c;
    if v is null or v = '' or v = 'NA' or v !~ '^[0-2](\.0+)?$' then continue; end if;
    n := v::numeric;
    obt := obt + n; maxp := maxp + 2;
    s_cat := jsonb_set(s_cat, array[left(c,1)], to_jsonb(array[
      coalesce((s_cat->left(c,1)->>0)::numeric, 0) + n,
      coalesce((s_cat->left(c,1)->>1)::numeric, 0) + 1]));
  end loop;

  for k in select jsonb_object_keys(pesos) loop
    n := coalesce(nullif(av->'portugues'->>k, ''), '0')::numeric;
    if n < 0 then n := 0; end if;
    total := total + floor(n) * (pesos->>k)::numeric;
  end loop;
  total := round(total * 10) / 10;
  penal := -total;
  base := case when maxp > 0 then obt / maxp * 100 else 0 end;
  final := greatest(0, round((base - penal) * 10) / 10);

  if final >= 95 then conceito := 'Excelente'; cor := '#1F9254';
  elsif final >= 90 then conceito := 'Muito Bom'; cor := '#2E6FD9';
  elsif final >= 80 then conceito := 'Bom'; cor := '#E0A83E';
  elsif final >= 70 then conceito := 'Em Desenvolvimento'; cor := '#E8874A';
  else conceito := 'Necessita Intervenção Imediata'; cor := '#D64550';
  end if;

  return jsonb_build_object(
    'pontosObtidos', obt, 'pontosMax', maxp,
    'notaTecnica',     public.subnota(s_cat, array['C']),
    'notaComunicacao', public.subnota(s_cat, array['F']),
    'notaHumanizacao', public.subnota(s_cat, array['B']),
    'notaProcesso',    public.subnota(s_cat, array['A','D','E']),
    'totalDescontadoPortugues', round(total, 1),
    'penalizacaoPortugues', round(penal, 1),
    'notaFinal', round(final, 1),
    'conceito', conceito,
    'conceitoCor', cor);
end $$;

create or replace function public.subnota(s_cat jsonb, cats text[]) returns numeric
language plpgsql immutable as $$
declare c text; soma numeric := 0; cnt numeric := 0;
begin
  foreach c in array cats loop
    soma := soma + coalesce((s_cat->c->>0)::numeric, 0);
    cnt  := cnt  + coalesce((s_cat->c->>1)::numeric, 0);
  end loop;
  if cnt = 0 then return null; end if;
  return round(round(soma / (cnt * 2) * 1000) / 10, 1);
end $$;

-- link de áudio: só http(s) — impede "javascript:" (XSS)
create or replace function public.link_seguro(u text) returns text
language sql immutable as $$
  select case when coalesce(trim(u), '') = '' then ''
              when trim(u) ~* '^https?://[^\s<>"]+$' then trim(u)
              else null end;
$$;

-- ---------------------------------------------------------------------
-- 4. Triggers: carimbam autor/avaliador, recalculam nota, auditam
-- ---------------------------------------------------------------------
create or replace function public.trg_avaliacao_ins() returns trigger
language plpgsql security definer set search_path = public as $$
declare p perfis; importada boolean; link text;
begin
  select * into p from perfis where user_id = auth.uid();
  importada := (new.data ? 'importadaEm') and eh_admin();
  link := link_seguro(new.data->>'linkAudio');
  if link is null then raise exception 'O link do áudio precisa começar com https://'; end if;
  if not exists (select 1 from colaboradores where id = new.data->>'colaboradorId') then
    raise exception 'Selecione um colaborador válido.';
  end if;
  new.data := new.data
    || jsonb_build_object('id', new.id, 'linkAudio', link, 'transcricao', '', 'finalizada', true);
  if importada then
    new.autor_id := null;
  else
    new.autor_id := auth.uid();
    new.data := new.data || jsonb_build_object(
      'supervisor', p.nome, 'autorId', auth.uid(), 'autorNome', p.nome, 'registradaEm', now());
  end if;
  new.data := new.data || jsonb_build_object('resultado', calcular_resultado(new.data));
  new.created_at := now();
  return new;
end $$;

drop trigger if exists avaliacao_ins on public.avaliacoes;
create trigger avaliacao_ins before insert on public.avaliacoes
  for each row execute function public.trg_avaliacao_ins();

create or replace function public.trg_audio_ins() returns trigger
language plpgsql security definer set search_path = public as $$
declare p perfis; link text;
begin
  select * into p from perfis where user_id = auth.uid();
  link := link_seguro(new.data->>'linkAudio');
  if link is null then raise exception 'O link do áudio precisa começar com https://'; end if;
  new.data := new.data || jsonb_build_object('id', new.id, 'linkAudio', link);
  if (new.data ? 'importadaEm') and eh_admin() then
    new.autor_id := null;
  else
    new.autor_id := auth.uid();
    new.data := new.data || jsonb_build_object('supervisor', p.nome, 'autorNome', p.nome, 'registradoEm', now());
  end if;
  return new;
end $$;

drop trigger if exists audio_ins on public.audios;
create trigger audio_ins before insert on public.audios
  for each row execute function public.trg_audio_ins();

create or replace function public.trg_colab_upd() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(new.data->>'nome'), '') = '' then raise exception 'Informe o nome do colaborador.'; end if;
  new.data := new.data || jsonb_build_object('id', new.id);
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists colab_upd on public.colaboradores;
create trigger colab_upd before insert or update on public.colaboradores
  for each row execute function public.trg_colab_upd();

-- Impede que o admin altere o próprio papel/ativação (evita perder o acesso) e
-- que alguém altere colunas sensíveis por fora das regras.
create or replace function public.trg_perfil_upd() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then          -- (no SQL Editor, auth.uid() é nulo: permitido)
    if new.user_id <> old.user_id or new.must_change_pw <> old.must_change_pw then
      raise exception 'Alteração não permitida.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists perfil_upd on public.perfis;
create trigger perfil_upd before update on public.perfis
  for each row execute function public.trg_perfil_upd();

-- Auditoria automática
create or replace function public.trg_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_TABLE_NAME = 'avaliacoes' and TG_OP = 'INSERT' then
    perform auditar(case when new.data ? 'importadaEm' then 'avaliacao.importada' else 'avaliacao.criada' end,
      new.id, jsonb_build_object('colaborador', new.data->>'colaboradorId', 'nota', new.data->'resultado'->'notaFinal'));
  elsif TG_TABLE_NAME = 'avaliacoes' and TG_OP = 'DELETE' then
    perform auditar('avaliacao.excluida', old.id, jsonb_build_object(
      'colaborador', old.data->>'colaboradorId', 'data', old.data->>'dataMonitoria',
      'avaliador', old.data->>'supervisor', 'nota', old.data->'resultado'->'notaFinal'));
  elsif TG_TABLE_NAME = 'audios' then
    perform auditar('audio.criado', new.id, null);
  elsif TG_TABLE_NAME = 'colaboradores' then
    perform auditar('colaborador.salvo', new.id, jsonb_build_object('nome', new.data->>'nome', 'status', new.data->>'status'));
  elsif TG_TABLE_NAME = 'config' then
    perform auditar('config.alterada', new.chave, new.valor);
  elsif TG_TABLE_NAME = 'perfis' then
    perform auditar('usuario.alterado', new.username, jsonb_build_object(
      'role', new.role, 'ativo', new.ativo, 'senhaTrocada', not new.must_change_pw));
  end if;
  return null;
end $$;

drop trigger if exists aud_avaliacoes on public.avaliacoes;
create trigger aud_avaliacoes after insert or delete on public.avaliacoes for each row execute function public.trg_auditoria();
drop trigger if exists aud_audios on public.audios;
create trigger aud_audios after insert on public.audios for each row execute function public.trg_auditoria();
drop trigger if exists aud_colab on public.colaboradores;
create trigger aud_colab after insert or update on public.colaboradores for each row execute function public.trg_auditoria();
drop trigger if exists aud_config on public.config;
create trigger aud_config after update on public.config for each row execute function public.trg_auditoria();
drop trigger if exists aud_perfis on public.perfis;
create trigger aud_perfis after update on public.perfis for each row execute function public.trg_auditoria();

-- ---------------------------------------------------------------------
-- 5. Integração com o login (auth.users)
-- ---------------------------------------------------------------------
-- Todo usuário novo ganha um perfil BLOQUEADO (ativo=false), com troca de senha obrigatória.
create or replace function public.trg_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare u text := split_part(new.email, '@', 1);
begin
  insert into perfis (user_id, username, nome)
  values (new.id, u, initcap(replace(u, '.', ' ')))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists novo_usuario on auth.users;
create trigger novo_usuario after insert on auth.users
  for each row execute function public.trg_novo_usuario();

-- Quando a pessoa troca a senha, libera o acesso (must_change_pw = false).
create or replace function public.trg_senha_trocada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update perfis set must_change_pw = false where user_id = new.id;
    insert into auditoria (user_id, username, acao)
      values (new.id, (select username from perfis where user_id = new.id), 'senha.alterada');
  end if;
  return new;
end $$;

drop trigger if exists senha_trocada on auth.users;
create trigger senha_trocada after update of encrypted_password on auth.users
  for each row execute function public.trg_senha_trocada();

-- ---------------------------------------------------------------------
-- 6. Row Level Security — QUEM PODE O QUÊ
-- ---------------------------------------------------------------------
alter table public.perfis        enable row level security;
alter table public.colaboradores enable row level security;
alter table public.avaliacoes    enable row level security;
alter table public.audios        enable row level security;
alter table public.config        enable row level security;
alter table public.auditoria     enable row level security;

-- visitantes não autenticados (anon) não acessam nada
revoke all on public.perfis, public.colaboradores, public.avaliacoes, public.audios, public.config, public.auditoria from anon;
revoke execute on function public.auditar(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.registrar_evento(text) from public, anon;
grant execute on function public.registrar_evento(text) to authenticated;

-- perfis: cada um vê o próprio; admin vê todos e altera os OUTROS (papel/ativação)
drop policy if exists perfis_sel on public.perfis;
create policy perfis_sel on public.perfis for select to authenticated
  using (user_id = auth.uid() or eh_admin());
drop policy if exists perfis_upd on public.perfis;
create policy perfis_upd on public.perfis for update to authenticated
  using (eh_admin() and user_id <> auth.uid())
  with check (eh_admin() and user_id <> auth.uid());
revoke insert, delete on public.perfis from authenticated;
revoke update on public.perfis from authenticated;
grant update (role, ativo, nome) on public.perfis to authenticated;

-- colaboradores: todos os usuários liberados leem; só admin cria/edita
drop policy if exists colab_sel on public.colaboradores;
create policy colab_sel on public.colaboradores for select to authenticated using (usuario_ok());
drop policy if exists colab_ins on public.colaboradores;
create policy colab_ins on public.colaboradores for insert to authenticated with check (eh_admin());
drop policy if exists colab_upd on public.colaboradores;
create policy colab_upd on public.colaboradores for update to authenticated using (eh_admin()) with check (eh_admin());
revoke delete on public.colaboradores from authenticated;

-- avaliações: leitura conforme configuração; criação por usuário liberado; exclusão só admin; ninguém edita
drop policy if exists aval_sel on public.avaliacoes;
create policy aval_sel on public.avaliacoes for select to authenticated
  using (eh_admin() or (usuario_ok() and (coordenador_ve_todas() or autor_id = auth.uid())));
drop policy if exists aval_ins on public.avaliacoes;
create policy aval_ins on public.avaliacoes for insert to authenticated
  with check (usuario_ok() and (autor_id = auth.uid() or (autor_id is null and eh_admin())));
drop policy if exists aval_del on public.avaliacoes;
create policy aval_del on public.avaliacoes for delete to authenticated using (eh_admin());
revoke update on public.avaliacoes from authenticated;

-- áudios: mesma lógica
drop policy if exists audio_sel on public.audios;
create policy audio_sel on public.audios for select to authenticated
  using (eh_admin() or (usuario_ok() and (coordenador_ve_todas() or autor_id = auth.uid())));
drop policy if exists audio_ins on public.audios;
create policy audio_ins on public.audios for insert to authenticated
  with check (usuario_ok() and (autor_id = auth.uid() or (autor_id is null and eh_admin())));
drop policy if exists audio_del on public.audios;
create policy audio_del on public.audios for delete to authenticated using (eh_admin());
revoke update on public.audios from authenticated;

-- configuração: todos leem; só admin altera
drop policy if exists config_sel on public.config;
create policy config_sel on public.config for select to authenticated using (usuario_ok());
drop policy if exists config_upd on public.config;
create policy config_upd on public.config for update to authenticated using (eh_admin()) with check (eh_admin());
revoke insert, delete on public.config from authenticated;

-- auditoria: somente admin lê; ninguém escreve/apaga diretamente
drop policy if exists aud_sel on public.auditoria;
create policy aud_sel on public.auditoria for select to authenticated using (eh_admin());
revoke insert, update, delete on public.auditoria from authenticated;
