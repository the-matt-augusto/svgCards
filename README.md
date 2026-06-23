# SVG Cards - Gerador de Cartões GitHub

## Introdução
Este projeto é um gerador dinâmico de cartões de perfil do GitHub que renderiza um arquivo SVG customizado contendo estatísticas públicas do usuário (nome, repositórios públicos, seguidores e avatar). É ideal para embutir diretamente na seção de perfil ou em repositórios do seu GitHub.

## Sobre o Projeto
O projeto foi desenvolvido como uma Vercel Serverless Function em TypeScript. O endpoint em `/api/card.ts` busca os dados diretamente da API do GitHub, converte e embute a imagem do avatar em formato Base64 (Data URI) dentro do SVG usando `xlink:href` para garantir a compatibilidade com o proxy de imagem do GitHub (Camo), e aplica cache de resposta para otimizar as requisições.

Destaques:
*   **Temas**: Suporte para os temas `light`, `dark`, `dracula`, `nord`, `gruvbox` e `catppuccin` através do parâmetro `?theme=`.
*   **Tratamento de Erros**: Usuários inválidos ou erros de API retornam um cartão de erro estilizado e amigável.
*   **Segurança**: Comunicação autenticada com a API do GitHub sem expor tokens ou dados sensíveis.
*   **Performance**: Cache das respostas configurado com `Cache-Control`.

## Tecnologias Utilizadas
*   [TypeScript](https://www.typescriptlang.org/)
*   [Node.js](https://nodejs.org/)
*   [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
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
