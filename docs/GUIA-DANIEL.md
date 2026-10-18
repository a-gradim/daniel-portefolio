# Guia do Daniel: gerir o portefólio

Este guia explica como acrescentar e editar projetos no portefólio, sem precisares de saber programar.

**Endereço de administração:** `https://danielneto.vercel.app/keystatic`

---

## 1. Editar online (o modo normal)

1. Abre `https://danielneto.vercel.app/keystatic`.
2. Clica em **Sign in with GitHub** e autoriza a aplicação. Precisas de ter acesso ao repositório `a-gradim/daniel-portefolio`.
3. No menu da esquerda, escolhe **Content** e depois **Projects** (ou **Sections**).
4. Para criar um projeto, carrega no botão **Create** (ou no sinal **+**). Preenche os campos.
5. Para editar, clica num projeto da lista, altera o que precisares e carrega em **Save**.
6. Ao guardar, o Keystatic cria uma alteração no repositório. A Vercel volta a publicar o site em cerca de 1 minuto.
7. Confirma no site, atualizando a página depois de um minuto.

> Nota: os nomes dos botões podem aparecer em inglês. Guardar = **Save**, criar = **Create**.

---

## 2. Campos de um projeto

| Campo | O que escrever |
|---|---|
| **Title** | Nome do projeto. |
| **Section** | Cliente ou série a que pertence. Escolhe uma existente. Para criar uma nova, vai a **Content → Sections**. |
| **Year** | Ano do trabalho, por exemplo `2025`. |
| **Discipline (EN / PT)** | Disciplina em inglês e em português, por exemplo `Photography / Video` e `Fotografia / Vídeo`. |
| **Client / note** | Cliente ou nota curta. |
| **Cover image** | Imagem principal. Aparece no canvas da home e na lista. |
| **Gallery** | Imagens extra. Em **Alt text**, descreve a imagem em poucas palavras. |
| **Videos** | Só o link do YouTube. Não carregues ficheiros de vídeo no site. |
| **Vertical (9:16)** | Marca esta caixa se o vídeo for vertical (formato de telemóvel). |
| **Poster (optional)** | Imagem de capa do vídeo. É opcional. |
| **Credits** | Créditos, por exemplo `Conceito · Fotografia · Edição`. |
| **Case study text (EN / PT)** | Texto descritivo do projeto, em inglês e em português. |
| **Show on home canvas** | Marcada, o projeto aparece na página inicial. Desmarcada, fica escondido da home. |
| **Order** | Número de ordenação. O número mais baixo aparece primeiro. |

### Vídeos no YouTube

1. Carrega o vídeo no YouTube.
2. Em **Visibilidade**, escolhe **Não listado** (*Unlisted*). Só quem tiver o link o vê.
3. Copia o link e cola-o em **YouTube URL**.

---

## 3. Imagens

- Formato: **JPG** ou **WebP**.
- Lado maior: cerca de **2000 px**.
- Tamanho máximo: **1,5 MB** por imagem.

Se uma imagem for maior, reduz as dimensões antes de a carregar.

---

## 4. Tema por defeito

1. No Keystatic, vai a **Site → Site settings**.
2. Em **Default theme**, escolhe **Dark (current)** ou **Light (sub.global style)**.
3. Carrega em **Save**.

Os visitantes podem sempre mudar o tema pelos botões do site. Esta opção define só o tema inicial.

---

## 5. Editar no teu computador (opcional)

Usa esta opção para ver alterações antes de as publicar. Precisas de **Node.js 22** ou mais recente.

1. Abre a pasta do projeto no terminal.
2. Corre `npm install` (só na primeira vez).
3. Corre `npm run dev`.
4. Abre `http://localhost:4321/keystatic` no navegador.

Aqui as alterações são gravadas diretamente nos ficheiros do teu computador. Para as publicar, faz commit e push, ou pede ao Andre.

---

## 6. Publicar

- **Publicar = guardar no Keystatic.** Cada gravação cria uma alteração no repositório.
- A Vercel publica automaticamente o site em cerca de 1 minuto.

---

## 7. Se algo não funcionar

1. **Não consegues guardar:** confirma que tens acesso de escrita ao repositório e que tiveste login com GitHub.
2. **Imagem não aparece:** confirma o formato (JPG ou WebP) e o tamanho (até 1,5 MB).
3. **Site não atualiza:** espera 2 minutos e recarrega a página com `Ctrl+F5` (Windows) ou `Cmd+Shift+R` (Mac).
4. **Continua igual:** envia ao Andre o nome do projeto e uma captura do erro.
