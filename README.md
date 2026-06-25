# SVG Cards - Gerador de Cartões GitHub

## Introdução
Este projeto é um gerador dinâmico de cartões de perfil do GitHub que renderiza um arquivo SVG customizado contendo estatísticas públicas do usuário (nome, avatar, repositórios, seguidores, total de estrelas e as 3 linguagens de programação mais usadas). É ideal para embutir diretamente na seção de perfil ou em repositórios do seu GitHub.

## Sobre o Projeto
O projeto foi desenvolvido em TypeScript utilizando as **Vercel Edge Functions (Edge Runtime)** para máxima performance e baixa latência. O endpoint em `/api/card.ts` busca os dados diretamente da API GraphQL do GitHub, processa a imagem do avatar de forma eficiente usando APIs Web nativas (`Uint8Array` e `btoa` em substituição ao `Buffer`), embute o avatar em formato Base64 (Data URI) dentro do SVG usando `xlink:href` para garantir compatibilidade com o proxy de imagens do GitHub (Camo), e define os cabeçalhos de cache apropriados.

Destaques:
*   **Métricas do Perfil**: Exibe contagem de repositórios, seguidores, soma total de estrelas de seus repositórios e as 3 linguagens mais usadas (com círculos coloridos com a cor oficial de cada linguagem).
*   **Métricas de Atividade (Novo!)**: Exibe em um bloco dedicado a sequência atual de dias ativos (streak 🔥), total de contribuições no ano, linha detalhada de commits/PRs/issues, e o ano de criação da conta ("Membro desde YYYY").
*   **Sequência Resiliente**: A sequência atual (streak) é computada percorrendo os dias de trás para frente. Caso o dia de hoje ainda não tenha contribuições (esteja zerado), o streak não é resetado para 0, continuando a contagem a partir de ontem.
*   **Formatação Inteligente**: Valores numéricos grandes (seguidores, estrelas, commits, etc.) são convertidos para notação compacta (ex: `1.2k` ou `2.5M`), garantindo que o layout nunca sofra sobreposição de textos.
*   **Design Espaçoso**: Cartões otimizados e legíveis com resolução de 450x225px.
*   **Resiliência a Falhas de Rede**: Função de fetch de avatares otimizada com validações de URL e timeout controlado (3 segundos) para evitar erros do tipo `fetch failed` caso o CDN do GitHub bloqueie ou limite conexões.
*   **Temas**: Suporte para os temas `light`, `dark`, `dracula`, `nord`, `gruvbox` e `catppuccin` através do parâmetro `?theme=`.
*   **Tratamento de Erros**: Usuários inválidos ou erros de API retornam um cartão de erro estilizado e amigável.
*   **Segurança**: Comunicação autenticada com a API do GitHub sem expor tokens ou dados sensíveis.
*   **Performance**: Cache das respostas configurado com `Cache-Control`.

## Tecnologias Utilizadas
*   [TypeScript](https://www.typescriptlang.org/)
*   [Vercel Edge Functions (Edge Runtime)](https://vercel.com/docs/functions/edge-functions)
*   [Vercel CLI](https://vercel.com/docs/cli)

## Como Rodar

### Pré-requisitos
Certifique-se de ter o Node.js e a Vercel CLI instalados em sua máquina.

### Passos para Desenvolvimento Local

1.  Clone o repositório e acesse a pasta do projeto:
    ```bash
    git clone https://github.com/the-matt-augusto/svgCards.git
    cd svgCards
    ```

2.  Instale as dependências:
    ```bash
    npm install
    ```

3.  Configure o arquivo de variáveis de ambiente:
    Crie um arquivo `.env` na raiz do projeto com o seu token de acesso pessoal do GitHub (Personal Access Token):
    ```env
    GITHUB_TOKEN=seu_token_aqui
    ```

4.  Inicie a Vercel em modo de desenvolvimento local:
    ```bash
    vercel dev
    ```
    A API estará rodando localmente em `http://localhost:3000`.

## Como Usar

Para utilizar os cartões, faça uma requisição ao endpoint `/api/card` passando o parâmetro `username` (obrigatório) e o parâmetro `theme` (opcional).

### Parâmetros da Query
| Parâmetro | Tipo | Descrição | Valores Aceitos | Padrão |
| :--- | :--- | :--- | :--- | :--- |
| `username` | String | Nome de usuário do GitHub. | Qualquer usuário ativo. | (Obrigatório) |
| `theme` | String | Paleta de cores do cartão. | `light`, `dark`, `dracula`, `nord`, `gruvbox`, `catppuccin` | `dark` |

### Exemplo de Uso em Markdown

Para embutir em seu `README.md`, utilize o código abaixo:

```markdown
[![GitHub Card](https://svg-cards-five.vercel.app/api/card?username=the-matt-augusto&theme=dracula)](https://github.com/the-matt-augusto)
```

[![GitHub Card](https://svg-cards-five.vercel.app/api/card?username=the-matt-augusto&theme=dracula)](https://github.com/the-matt-augusto)

## Licença
Este projeto está sob a licença [MIT](LICENSE).

## Contato
*   **GitHub**: [@the-matt-augusto](https://github.com/the-matt-augusto)
