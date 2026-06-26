# SVG Cards - Gerador de Cartões GitHub e Stack Overflow

## Introdução
Este projeto é um gerador dinâmico de cartões de perfil do GitHub e do Stack Overflow que renderiza um arquivo SVG customizado contendo estatísticas públicas do usuário. É ideal para embutir diretamente na seção de perfil ou em repositórios.

## Sobre o Projeto
O projeto foi desenvolvido em TypeScript utilizando as **Vercel Edge Functions (Edge Runtime)** para máxima performance e baixa latência. Ele expõe endpoints para buscar dados diretamente do GitHub (API GraphQL) e do Stack Overflow (API Stack Exchange v2.3), processar o avatar correspondente de forma eficiente, embutir a imagem em Base64 no SVG e definir cabeçalhos de cache apropriados.

Destaques:
*   **Métricas do Perfil GitHub**: Exibe contagem de repositórios, seguidores, soma total de estrelas de seus repositórios e as 3 linguagens mais usadas (com círculos coloridos com a cor oficial de cada linguagem).
*   **Métricas do Perfil Stack Overflow (Novo!)**: Exibe a reputação total e o histórico de conquistas de medalhas (Ouro, Prata, Bronze), além de métricas de evolução da reputação (Ano, Trimestre, Mês).
*   **Métricas de Atividade GitHub**: Exibe em um bloco dedicado a sequência atual de dias ativos (streak 🔥), total de contribuições no ano, linha detalhada de commits/PRs/issues, e o ano de criação da conta ("Membro desde YYYY").
*   **Sequência Resiliente**: A sequência atual (streak) é computada percorrendo os dias de trás para frente. Caso o dia de hoje ainda não tenha contribuições (esteja zerado), o streak não é resetado para 0, continuando a contagem a partir de ontem.
*   **Formatação Inteligente**: Valores numéricos grandes (seguidores, estrelas, reputação, commits, etc.) são convertidos para notação compacta (ex: `1.2k` ou `2.5M`), garantindo que o layout nunca sofra sobreposição de textos.
*   **Identidade Visual Coesa**: Ambos os cartões utilizam as mesmas dimensões padrão (`450x225`), suportam as mesmas paletas de temas, admitem customização de cores via parâmetros de query e possuem o logotipo oficial correspondente renderizado no canto superior direito.
*   **Design Espaçoso**: Cartões otimizados e legíveis com resolução de 450x225px.
*   **Resiliência a Falhas de Rede**: Função de fetch de avatares otimizada com validações de URL e timeout controlado (3 segundos) para evitar erros do tipo `fetch failed` caso CDNs bloqueiem ou limitem conexões.
*   **Temas**: Suporte para os temas `light`, `dark`, `dracula`, `nord`, `gruvbox` e `catppuccin` através do parâmetro `?theme=`.
*   **Tratamento de Erros**: Usuários inválidos, IDs numéricos incorretos ou erros de API retornam um cartão de erro estilizado e amigável.
*   **Segurança**: Comunicação autenticada sem expor tokens ou chaves de cota.
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
    Crie um arquivo `.env` na raiz do projeto com o seu token de acesso pessoal do GitHub (Personal Access Token) e sua chave da StackApps (opcional para aumentar a cota de requisições):
    ```env
    GITHUB_TOKEN=seu_token_aqui
    STACKAPPS_KEY=sua_chave_aqui
    ```

4.  Inicie a Vercel em modo de desenvolvimento local:
    ```bash
    vercel dev
    ```
    A API estará rodando localmente em `http://localhost:3000`.

## Como Usar

### 1. Cartão do GitHub
Faça uma requisição ao endpoint `/api/card` passando o parâmetro `username` (obrigatório) e o parâmetro `theme` (opcional).

| Parâmetro | Tipo | Descrição | Valores Aceitos | Padrão |
| :--- | :--- | :--- | :--- | :--- |
| `username` | String | Nome de usuário do GitHub. | Qualquer usuário ativo. | (Obrigatório) |
| `theme` | String | Paleta de cores do cartão. | `light`, `dark`, `dracula`, `nord`, `gruvbox`, `catppuccin` | `dark` |

### 2. Cartão do Stack Overflow (Novo!)
Faça uma requisição ao endpoint `/api/stackoverflow` passando o parâmetro `id` numérico (obrigatório) e o parâmetro `theme` (opcional).

| Parâmetro | Tipo | Descrição | Valores Aceitos | Padrão |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | ID numérico do perfil do Stack Overflow. | Qualquer ID de usuário ativo. | (Obrigatório) |
| `theme` | String | Paleta de cores do cartão. | `light`, `dark`, `dracula`, `nord`, `gruvbox`, `catppuccin` | `dark` |

### Exemplo de Uso em Markdown

#### GitHub
```markdown
[![GitHub Card](https://svg-cards-five.vercel.app/api/card?username=the-matt-augusto&theme=dracula)](https://github.com/the-matt-augusto)
```

#### Stack Overflow
```markdown
[![Stack Overflow Card](https://svg-cards-five.vercel.app/api/stackoverflow?id=1&theme=dracula)](https://stackoverflow.com/users/1)
```

## Licença
Este projeto está sob a licença [MIT](LICENSE).

## Contato
*   **GitHub**: [@the-matt-augusto](https://github.com/the-matt-augusto)
