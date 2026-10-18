# Deploy: configuração inicial (uma vez)

Hospedagem na **Vercel**, código no **GitHub** (`a-gradim/daniel-portefolio`, privado), edição de conteúdo pelo **Keystatic** em modo GitHub.

---

## 1. Importar o repositório na Vercel

1. Em [vercel.com](https://vercel.com), escolhe **Add New… → Project**.
2. Escolhe o repositório `a-gradim/daniel-portefolio`. Se a Vercel pedir, autoriza o acesso ao GitHub.
3. Em **Framework Preset**, deixa **Astro** (deteção automática). Os restantes defaults servem.
4. Em **Environment Variables**, cria as variáveis do `.env.example`. Ainda não têm valor: vêm do passo 3. Podes fazer o primeiro deploy sem elas.
5. Carrega em **Deploy**.

---

## 2. Confirmar o primeiro deploy

1. Abre o endereço que a Vercel atribuiu (por exemplo `https://danielneto.vercel.app`).
2. Confirma que a página carrega.

Se o endereço for outro, atualiza `site` em `astro.config.mjs` e a linha `Sitemap:` em `public/robots.txt`.

---

## 3. Ligar o Keystatic ao GitHub

1. Abre `https://danielneto.vercel.app/keystatic` **no site publicado**. Não uses o ambiente local para este passo.
2. Segue o assistente **Create GitHub App**. Dá um nome à app e confirma a criação no GitHub.
3. No fim, instala a app no repositório `a-gradim/daniel-portefolio`. Escolhe apenas este repositório.
4. O assistente mostra 4 variáveis. Copia-as:
   - `KEYSTATIC_GITHUB_CLIENT_ID`
   - `KEYSTATIC_GITHUB_CLIENT_SECRET`
   - `KEYSTATIC_SECRET`
   - `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`

---

## 4. Guardar as variáveis na Vercel e publicar de novo

1. Na Vercel, abre o projeto e vai a **Settings → Environment Variables**.
2. Adiciona as 4 variáveis, com os valores copiados no passo 3.
3. Vai a **Deployments**, escolhe o último deployment, carrega em **⋯ → Redeploy**.

As variáveis só entram em vigor depois do redeploy.

---

## 5. Testar o login

1. Abre `https://danielneto.vercel.app/keystatic`.
2. Carrega em **Sign in with GitHub** e confirma que entras.

---

## 6. Dar acesso ao Daniel

1. No GitHub, abre o repositório e vai a **Settings → Collaborators → Add people**.
2. Escreve o nome de utilizador do Daniel no GitHub.
3. Escolhe o papel **Write**.
4. O Daniel aceita o convite por email.

Sem permissão de escrita, o Keystatic não consegue guardar. A app do passo 3 também tem de estar instalada no repositório.

---

## 7. Domínio personalizado (opcional)

1. Na Vercel, vai a **Settings → Domains** e adiciona o domínio.
2. Atualiza `site` em `astro.config.mjs` e a linha `Sitemap:` em `public/robots.txt`.
3. No GitHub, nas definições da app criada no passo 3, atualiza o **Homepage URL** e o **Callback URL** para o novo domínio.
4. Faz redeploy.

---

## 8. Notas técnicas

- **Node.js:** o build usa Node 22 no GitHub Actions. Na Vercel, se for preciso, define a versão em **Settings → General → Node.js Version**.
- **Build local:** `npm run build` deve passar antes de publicar alterações de código.
- **Modo local do Keystatic:** `npm run dev` usa ficheiros locais. Para testar o modo GitHub localmente, corre `npm run build && npm run preview` com as 4 variáveis num ficheiro `.env`.

### Problema conhecido: instalação falha com ERESOLVE

Com as dependências atuais, `npm ci` falha com um conflito de peer dependencies: `@astrojs/check` aceita `typescript` 5 ou 6, mas o `package.json` pede `typescript` 7. Na Vercel, o `npm install` pode falhar do mesmo modo.

Para resolver, escolhe uma das opções:

1. Alinhar a versão do `typescript` no `package.json` com a suportada pelo `@astrojs/check`. Depois, correr `npm install` e fazer commit do `package-lock.json`.
2. Ou adicionar um ficheiro `.npmrc` com a linha `legacy-peer-deps=true`.
