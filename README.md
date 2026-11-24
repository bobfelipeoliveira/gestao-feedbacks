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
