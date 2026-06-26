# svgCards

Gerador de cartões de estatísticas em SVG, embeddáveis em qualquer README ou página. Funciona como três funções serverless independentes na Vercel: recebe a requisição, chama a API de origem, monta o SVG na hora e responde — sem banco, sem estado.

**Providers disponíveis:** GitHub (via GraphQL), Stack Overflow (via Stack Exchange API v2.3) e Twitch (via Helix API).

---

## Exemplo de embed

```markdown
[![GitHub](https://svg-cards-five.vercel.app/api/github?username=the-matt-augusto&theme=tokyonight)](https://github.com/the-matt-augusto)

[![Stack Overflow](https://svg-cards-five.vercel.app/api/stackoverflow?id=1&theme=gruvbox)](https://stackoverflow.com/users/1)

[![Twitch](https://svg-cards-five.vercel.app/api/twitch?channel=jerma985&theme=twitch)](https://twitch.tv/jerma985)
```

---

## Como usar

### Endpoints

| Endpoint | Parâmetro obrigatório | Exemplo |
|---|---|---|
| `/api/github` | `?username=` | `/api/github?username=torvalds` |
| `/api/stackoverflow` | `?id=` (numérico) | `/api/stackoverflow?id=22656` |
| `/api/twitch` | `?channel=` | `/api/twitch?channel=ninja` |
| `/api/index` | `?provider=` + parâmetro do provider | `/api/index?provider=github&username=torvalds` |

### Temas (`?theme=`)

| Nome | Descrição |
|---|---|
| `dark` | Padrão. Fundo escuro estilo GitHub |
| `light` | Fundo branco |
| `nord` | Paleta Nord |
| `gruvbox` | Paleta Gruvbox |
| `tokyonight` | Paleta Tokyo Night |
| `onedark` | Paleta One Dark |
| `twitch` | Roxo Twitch — recomendado para o card da Twitch |
| `cyberpunk` | Alto contraste com amarelo/ciano |
| `spotify` | Verde Spotify |
| `youtube` | Vermelho YouTube |

### Cores customizadas

Qualquer papel de cor do tema pode ser sobrescrito via query string. Os valores são hex **sem o `#`**, em 3 ou 6 dígitos:

```
?bg=0d1117&border=30363d&text=e6edf3&subtext=8b949e&accent=58a6ff
```

| Parâmetro | Papel |
|---|---|
| `bg` | Cor de fundo do cartão |
| `border` | Cor da borda |
| `text` | Cor do texto principal (nome) |
| `subtext` | Cor dos rótulos e texto secundário |
| `accent` | Cor de destaque (números, ícones) |

Os valores customizados sobrescrevem **por cima** do tema escolhido — é possível trocar só o `accent` herdando o restante de um tema.

---

## O que cada cartão exibe

### GitHub (`/api/github?username=`)

- Avatar, nome, `@login`, ano de ingresso ("Membro desde")
- Repos, Seguidores, Estrelas (soma dos top-100 repos por estrelas)
- Sequência atual (🔥), Contribuições no ano
- Commits, PRs, Issues (do último ano via `contributionsCollection`)
- Três linguagens mais usadas com cor oficial de cada uma

### Stack Overflow (`/api/stackoverflow?id=`)

O `id` é o número na URL do perfil (`stackoverflow.com/users/**22656**/nome`), pois nomes de exibição não são únicos na plataforma.

- Avatar, nome, ID, ano de ingresso
- Reputação total
- Badges: Ouro, Prata, Bronze
- Evolução de reputação: Este ano, Este trimestre, Este mês

### Twitch (`/api/twitch?channel=`)

- Avatar, nome do canal, seguidores
- **Ao vivo**: badge "AO VIVO" animado, contagem de Viewers, título da stream, jogo/categoria
- **Offline**: estado indicado sem tratar como erro

---

## Decisões de engenharia

### Cache como alavanca principal de performance — Edge resolve só a cauda

O `Cache-Control` enviado na resposta é a peça que mais impacta o desempenho real:

```
Cache-Control: public, max-age=1800, s-maxage=1800, stale-while-revalidate=86400
```

Com `stale-while-revalidate`, a CDN serve a cópia em cache imediatamente e revalida em segundo plano — o visitante nunca espera a chamada à API de origem. Rodar no Edge Runtime (isolates V8 distribuídos geograficamente) reduz o cold start, mas o ganho de latência percebido é limitado: toda requisição que não encontra cache ainda precisa chamar a API do GitHub, Stack Overflow ou Twitch, e essa chamada domina o tempo de resposta.

O cartão da Twitch usa TTL menor (`max-age=60, stale-while-revalidate=600`) porque exibe status ao vivo — um cache de 30 minutos tornaria o estado "AO VIVO" obsoleto por muito tempo.

**Respostas de erro usam `no-store`** propositalmente: cachear um "Serviço Indisponível" ou "Limite Atingido" com o TTL longo de sucesso manteria o cartão quebrado por meia hora mesmo após a API de origem se recuperar.

### Três padrões de autenticação — cada um pelo motivo certo

**GitHub — PAT estático no header (`Authorization: Bearer`)**
O token vai no header `Authorization`, nunca na URL. Sem ele, a GraphQL API do GitHub exige autenticação; com ele, o limite sobe para 5.000 pontos/hora. Dados públicos não precisam de escopo especial — um PAT somente-leitura de dados públicos basta.

**Stack Overflow — `key` na query string**
A `STACKAPPS_KEY` não é uma credencial: ela não dá acesso a nenhum dado privado. Por design da API Stack Exchange, ela vai na query string e serve exclusivamente para subir a cota de 300 para 10.000 requisições/dia. Ainda é mantida em variável de ambiente por organização, mas a semântica é diferente — não é um segredo.

**Twitch — OAuth client-credentials (autentica o app, não um usuário)**
A Helix API da Twitch exige um `access_token` de curta duração obtido via `POST https://id.twitch.tv/oauth2/token` com `grant_type=client_credentials`. As credenciais vão no corpo form-encoded (não em Basic auth). Toda chamada Helix precisa de dois headers simultâneos: `Authorization: Bearer {token}` **e** `Client-Id`. O token é cacheado em memória de módulo com margem de 60 segundos antes da expiração; como o serverless é stateless, cada cold start obtém um novo token — tolerável porque o cache do SVG mantém o volume de invocações baixo.

### Arquitetura multi-provider: união discriminada + núcleo compartilhado

`CardData` é uma união discriminada:

```ts
type CardData = GitHubCardData | StackOverflowCardData | TwitchCardData;
```

Cada variante estende `BaseCardData` com campos específicos do provider (`memberSince`, `badges`, `isLive`, etc.). O campo `stats` é uma **lista** `{ label: string; value: string }[]`, não um objeto de campos fixos — o GitHub enfileira Estrelas e Sequência atual; o Stack Overflow enfileira Reputação e badges; a Twitch enfileira Viewers. Isso evita que um provider precise de um campo vazio que não faz sentido para ele.

O núcleo (`handleRequest` em `core.ts`) cuida de resolução de tema, base64 do avatar, render do SVG, mapeamento de erros e headers de cache. Cada provider (`api/providers/*.ts`) implementa uma interface com um único método `fetch(id): Promise<CardData>`. Adicionar um novo provider é escrever essa função e registrar o nome no roteador — sem tocar no core.

Os endpoints `/api/github`, `/api/stackoverflow` e `/api/twitch` são cascas de duas linhas que chamam `handleRequest` com o provider fixo. O `/api/index` aceita `?provider=` dinamicamente.

### Segurança de entrada não-confiável: allowlist, não blocklist

Três superfícies recebem entrada externa e cada uma tem uma estratégia diferente:

**Texto da API no SVG — XML-escape total**
Todo dado vindo de APIs externas (nomes, títulos, logins) passa por `escapeXml` antes de entrar no SVG. A função escapa `<`, `>`, `&`, `'` e `"`. Isso inclui o initial do avatar no fallback — navegado por iteração de code points (`[...str][0]`) para não truncar caracteres multi-byte ou emoji.

**Cores customizadas — allowlist de hex**
Valores de `?bg`, `?border`, `?text`, `?subtext`, `?accent` entram **dentro de atributos SVG** (ex: `fill="..."`) — não como conteúdo de texto. Escape não resolve esse caso; o correto é allowlist. A validação é:

```ts
/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/
```

Se não casar exatamente, o valor é ignorado e a cor do tema base é mantida. `?accent=red`, `?bg="/><script>` ou qualquer outra coisa fora do padrão hex nunca chega ao SVG.

**URLs de avatar — allowlist de esquema**
`fetchAvatarBase64` rejeita qualquer URL que não comece com `https://`. Isso bloqueia `javascript:`, `data:`, `http://` e esquemas arbitrários antes de qualquer fetch.

Allowlist em vez de blocklist porque blocklist sempre tem lacunas — a validação é binária: ou o valor prova ser o que deve ser, ou não entra.

### Resiliência: timeout, modos de falha e cache seletivo

**Timeout via `AbortController`**: toda chamada `fetch` externa passa por `fetchWithTimeout` com 5 segundos de limite. O `clearTimeout` fica no `finally` para não vazar o timer em caso de sucesso rápido.

**Modos de falha distintos**: `ProviderError` carrega uma das três categorias — `not_found`, `unavailable`, `rate_limited` — que se mapeiam para títulos diferentes no cartão de erro e para HTTP status 404, 503 e 429 respectivamente. "Usuário não encontrado", "Serviço indisponível" e "Limite atingido" são estados diferentes que pedem ações diferentes do usuário.

Dois casos que parecem erro mas não são:
- Stack Overflow retorna HTTP 200 com `items: []` para usuário inexistente — detectado por `items.length === 0`, não por status.
- Twitch retorna HTTP 200 com `data: []` quando o canal está offline — tratado como estado de exibição normal, não como falha.
- GitHub GraphQL retorna HTTP 200 mesmo para usuário inexistente (`data.user === null`) — verificado no corpo, não em `res.ok`.

### Trade-offs assumidos conscientemente

**Estrelas e linguagens limitadas aos top-100 repos**: a query GraphQL busca `first: 100` ordenados por estrelas. Quem tem mais de 100 repos tem estrelas e distribuição de linguagens subestimadas. Paginar seria múltiplas requisições para um cartão de perfil — desproporcional.

**Token Twitch por invocação de cold start**: a Twitch desencoraja gerar token em toda requisição. O cache em memória de módulo reaproveitá-o dentro do mesmo isolate, mas cada cold start faz uma nova autenticação. A alternativa correta seria Vercel KV; para o volume de um cartão de portfólio, o cache do SVG torna o custo aceitável.

**Fallback de avatar para inicial**: quando o fetch do avatar falha (timeout, CDN bloqueando, URL inválida), o cartão exibe a inicial do nome em vez de uma imagem quebrada. Isso é preferível a um cartão com placeholder vazio.

---

## Setup local

### Pré-requisitos

Node.js e Vercel CLI instalados.

### Variáveis de ambiente

Crie `.env` na raiz:

```env
GITHUB_TOKEN=seu_pat_aqui
STACKAPPS_KEY=sua_chave_aqui
TWITCH_CLIENT_ID=seu_client_id_aqui
TWITCH_CLIENT_SECRET=seu_client_secret_aqui
```

| Variável | Obrigatória | Como obter |
|---|---|---|
| `GITHUB_TOKEN` | Sim (para GraphQL) | GitHub → Settings → Developer settings → Personal access tokens. Somente-leitura de dados públicos basta. Sem ele, GraphQL retorna 401. |
| `STACKAPPS_KEY` | Não | stackapps.com → Apps. Sem ela, a cota é 300 req/dia. |
| `TWITCH_CLIENT_ID` | Sim | dev.twitch.tv → Console → Applications |
| `TWITCH_CLIENT_SECRET` | Sim | Mesmo app acima |

### Iniciar

```bash
git clone https://github.com/the-matt-augusto/svgCards.git
cd svgCards
npm install
vercel dev
```

A API fica disponível em `http://localhost:3000`.

---

## Testes

```bash
npm test
```

Três suítes com Vitest, todas sobre funções puras — sem chamadas reais às APIs:

- **`tests/core.test.ts`** — `escapeXml` (incluindo tentativas de injeção), `safeHex` (allowlist e rejeição de nomes de cor e payloads), fallback de avatar para inicial (unicode, emoji, casos limite), `formatNumber`, allowlist de esquema em `fetchAvatarBase64`
- **`tests/providers.test.ts`** — `calculateStreak` (sequência normal, hoje zerado, tudo zerado, quebra no meio), detecção de "não encontrado" por array vazio em cada provider, erros GraphQL com HTTP 200
- **`tests/resilience.test.ts`** — `fetchWithTimeout` (sucesso e AbortError), `handleRequest` com mocks de fetch: parâmetro ausente, usuário não encontrado, rate limit, 5xx e timeout — verificando status HTTP correto e `Cache-Control: no-store` em todos os casos de erro

---

## Licença

[GPL-3.0](LICENSE)

## Contato

**GitHub**: [@the-matt-augusto](https://github.com/the-matt-augusto)
