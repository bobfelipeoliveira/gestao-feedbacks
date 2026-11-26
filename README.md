# Sistema de Gestão de Feedbacks — versão online

Monitoria da Qualidade com **login, senha e perfis de acesso**. Roda **100% gratuito** em:

- **GitHub Pages**: hospeda as telas (HTML/JS).
- **Supabase** (plano Free): faz o login e guarda os dados num banco PostgreSQL.

Não há servidor próprio. **Toda a segurança fica no banco** (Row Level Security, em
`supabase/schema.sql`): mesmo que alguém altere o código no navegador, o banco recusa o que a
pessoa não tem permissão para fazer.

## Perfis de acesso

| Ação | Administrador | Coordenador(a) |
|---|:---:|:---:|
| Registrar avaliação (sempre em nome próprio) e cadastrar áudio | ✅ | ✅ |
| Ver histórico, dashboard, colaboradores, relatórios | ✅ | ✅ (ou só as próprias, se o admin restringir) |
| Excluir avaliações | ✅ | ❌ |
| Cadastrar/editar colaboradores | ✅ | ❌ |
| Liberar/bloquear usuários, promover a admin | ✅ | ❌ |
| Configurações, backup, auditoria | ✅ | ❌ |
| Editar avaliação (nota recalculada, edição registrada) | ✅ qualquer uma | ✅ só as que fez |

## Segurança implementada

- Senhas guardadas pelo Supabase Auth (bcrypt), nunca no código.
- **Todo usuário novo entra BLOQUEADO** até o administrador liberar (mesmo que alguém consiga se cadastrar).
- **Troca obrigatória da senha inicial** no 1º acesso. Enquanto não troca, o banco não entrega nenhum dado.
- A **nota é recalculada no banco** e o avaliador é carimbado pelo login: ninguém forja nota nem autoria.
- Edições mantêm o avaliador original, recalculam a nota e registram quem editou e a nota antes → depois; a versão anterior completa fica guardada (só o admin consulta). Só o admin exclui, e a exclusão fica na auditoria.
- Links de áudio só aceitam `https://` (bloqueia XSS).
- Sessão some ao fechar o navegador, com logout automático após 60 min sem uso.
- Auditoria de logins, avaliações, exclusões, colaboradores, configurações e usuários.
- A transcrição completa da ligação não é armazenada.

### Por que o repositório pode ser público?

O GitHub Pages só é gratuito com repositório **público**. Isso é aceitável aqui porque o
repositório **não contém dados nem segredos**: os dados ficam no Supabase, protegidos por login e
RLS, e a chave do `config.js` é a chave **pública** (anon/publishable), feita para ficar no navegador.

**Nunca** coloque no repositório: planilhas, backups `.json`, a chave `service_role`/`secret` do
Supabase ou a senha inicial. O `.gitignore` já bloqueia backups e planilhas.

---

## Como colocar no ar (≈ 20 min, custo zero)

### 1. Criar o projeto no Supabase
1. Acesse <https://supabase.com> → **New project**.
2. **Region: South America (São Paulo)**, para manter os dados no Brasil (LGPD). Anote a senha do banco.

### 2. Criar as tabelas e regras de segurança
1. **SQL Editor → New query**, cole TODO o conteúdo de `supabase/schema.sql` e clique em **Run**.

### 3. Ajustar o login (Authentication)
1. **Authentication → Sign In / Providers → Email**:
   - **Desligue "Allow new users to sign up"** (só o admin cria usuários).
   - Em *Password requirements*: mínimo **10** caracteres, com **minúsculas, maiúsculas, números e símbolos**.
2. **Authentication → Users → Add user → Create new user**, uma vez para cada pessoa:
   - E-mail: `nome.sobrenome@<dominioLogin do config.js>`
   - Senha: a senha inicial temporária
   - Marque **Auto Confirm User**

### 4. Tornar-se administrador
No **SQL Editor**, rode (trocando pelo seu login, em minúsculas):
```sql
update perfis set role = 'admin', ativo = true where username = 'seu.login';
```

### 5. Ligar as telas ao Supabase
1. **Project Settings → API** (ou botão **Connect**): copie a **Project URL** e a chave **anon / publishable**.
2. Cole as duas no arquivo `config.js` e faça commit.

### 6. Publicar no GitHub Pages
1. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
2. Branch **main**, pasta **/ (root)** → **Save**.
3. Em 1 a 2 minutos o site fica em `https://<seu-usuario>.github.io/<repositorio>/`.

### 7. Primeiro acesso
1. Entre com seu login e a senha inicial. O sistema obriga a criar uma senha pessoal.
2. **Configurações → Backup e migração → Importar Backup**:
   - se você tem avaliações na versão antiga (HTML), exporte o backup lá e importe aqui;
   - senão, importe o arquivo `colaboradores-inicial.json` (fica fora do GitHub).
3. **Usuários → Liberar acesso** para cada coordenador(a). No 1º login, cada um troca a senha.

---

## Regra da nota (desde 26/11/2026)

**A nota começa em 100. São 20 itens e cada item vale 5 pontos.** Parcialmente realizado perde 2,5;
não realizou perde 5; N/A não perde. Frase proibida perde 5 (item B6). Erros de português descontam por
ocorrência. Nota mínima 0. Todos os itens são obrigatórios (garantido também no banco).
A aba **Critérios** mostra tudo isso, gerada pelo mesmo cálculo da nota; cada avaliação mostra a sua conta.

**Recálculo das avaliações antigas** (decisão da coordenação: vale para todas):
1. rode `supabase/recalculo-1-previa.sql` — mostra nota atual × nota nova, **não altera nada**;
2. confira e rode `supabase/recalculo-2-aplicar.sql` — aplica uma única vez, guarda a versão anterior de cada
   avaliação (`avaliacoes_versoes`) e registra na Auditoria.

## Meu Acompanhamento (anotações privadas)

Caderno particular de cada avaliador sobre cada colaborador, separado das avaliações formais.

- Cada anotação pertence ao login de quem escreveu. **Avaliadores só veem, editam e excluem as próprias**,
  inclusive em consultas diretas ao banco: a regra está no banco (RLS, seção 10 do `schema.sql`), não na tela.
- **Supervisão:** quem tem a permissão especial `supervisionar_anotacoes` vê, edita e exclui todas. Ela fica
  numa tabela sem acesso pela API: **não é concedida pela tela de Usuários** (promover alguém a admin não dá acesso
  às anotações). Na primeira instalação ela vai para o(s) admin(s) daquele momento. Para conceder ou retirar depois,
  use o SQL Editor:
  ```sql
  -- conceder
  insert into permissoes_especiais (user_id, permissao)
  select user_id, 'supervisionar_anotacoes' from perfis where username = 'login.da.pessoa';
  -- retirar
  delete from permissoes_especiais p using perfis f
  where p.user_id = f.user_id and f.username = 'login.da.pessoa' and p.permissao = 'supervisionar_anotacoes';
  ```
- Edições e exclusões feitas pelo supervisor em anotações de outra pessoa ficam na Auditoria (sem o conteúdo).
- As anotações **não entram** no "Exportar Backup".

## IA automática (opcional, paga por uso)

A sugestão automática usa o **Claude Opus 5.5** por uma Edge Function do Supabase
(`supabase/functions/avaliar-ia`). A chave da Anthropic fica só no Supabase. O admin libera
a IA **por pessoa** (tela Usuários → "Liberar IA"). Limite: 20 usos por hora e 80 por dia por pessoa.

1. **Anthropic:** em <https://console.anthropic.com>, crie a conta, compre créditos, defina um
   **limite de gasto mensal** (Settings → Limits) e crie uma **API key**.
2. **Supabase → Edge Functions → Deploy a new function → Via Editor**: nome `avaliar-ia`, cole o
   conteúdo de `supabase/functions/avaliar-ia/index.ts` e clique em **Deploy**.
3. **Supabase → Edge Functions → Secrets**: adicione `ANTHROPIC_API_KEY` com a chave.
   (Opcional: `ALLOWED_ORIGINS` se o endereço do site mudar.)
4. Se aparecer "Invalid JWT" ao gerar a sugestão, desligue **Verify JWT** nas configurações da função:
   ela já confere o login de cada pessoa no banco.

Custo estimado: cerca de US$ 0,10 por avaliação de uma ligação de ~5 min.

## Limites do plano gratuito (importante)

- **O Supabase Free pausa o projeto após 7 dias sem nenhum acesso.** Os dados não se perdem: basta
  entrar no painel do Supabase e clicar em *Restore*. Com uso semanal isso não acontece.
- **O plano Free não oferece backup que você consiga baixar.** Exporte o backup em
  *Configurações → Exportar Backup* **toda semana** e guarde em local protegido (contém dados de saúde).
- Banco de 500 MB, sobra muito para este uso.

## Rotina de administração

- **Nova pessoa:** Supabase → Authentication → Add user (com Auto Confirm) → no sistema, *Usuários → Liberar acesso*.
- **Alguém saiu da equipe:** *Usuários → Bloquear* (efeito imediato) e, se quiser, exclua o usuário no Supabase.
- **Esqueceu a senha:** Supabase → Authentication → Users → abrir a pessoa → definir nova senha temporária.
  No próximo login ela troca de novo.

## Estrutura

```
index.html            página principal
config.js             URL + chave PÚBLICA do Supabase (preencher)
app.js                telas do sistema e acesso aos dados
acesso.js             login, troca de senha, usuários, auditoria
regras.js             critérios e cálculo da nota
supabase/schema.sql   tabelas, regras de segurança (RLS), cálculo da nota no banco, auditoria
vendor/               Chart.js 4.5.1 e supabase-js 2.119.0 (cópias locais, sem CDN)
```
