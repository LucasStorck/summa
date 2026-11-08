# Summa — Assistente Pessoal de Notícias

Briefing diário **baseado em acontecimentos**: agrupa matérias de vários veículos num único evento, resume o que é fato (com citação de cada frase) e mostra como cada veículo enquadrou a história. Uso pessoal, foco em português e no Brasil.

Proposta completa (produto, arquitetura, custos, riscos): [docs/proposta.md](docs/proposta.md). Consulte-a antes de decisões de arquitetura; as seções citadas abaixo se referem a ela.

## Modo de trabalho (importante)

O Lucas está aprendendo (nível estagiário/júnior) e **escreve o código ele mesmo**.

- **Por padrão, não implemente código de aplicação** em `src/`. Explique a estrutura e o raciocínio, revise o que ele escreveu, aponte erros e mostre a correção para ele aplicar à mão, explicando a causa.
- Só edite `src/` quando ele pedir explicitamente naquela conversa, e mesmo assim faça ajustes pequenos sobre o código dele (não escreva o próximo passo por ele) e explique cada mudança.
- Pode escrever documentação (como este arquivo) quando ele pedir.
- Ao revisar, verifique de verdade (rodar `tsc`, testar numa cópia no scratchpad) em vez de supor.
- Responda em português.

## Stack (seção 4)

| Camada | Escolha |
| --- | --- |
| Runtime | Node 26 LTS + TypeScript 7 (strict) |
| Módulos | ESM (`"type": "module"`, `module: nodenext`) |
| Feeds | `rss-parser` (RSS/Atom), `cheerio` (HTML) |
| Banco | SQLite (modo WAL, FTS5), embeddings como BLOB; `better-sqlite3` + Drizzle (ou SQL puro para aprender) |
| Validação | Zod em todo JSON devolvido por LLM |
| IA | Interfaces próprias `LlmClient` e `EmbeddingClient`; primeiro adaptador: Gemini (`@google/genai`), modelo `gemini-2.5-flash` no free tier, nome em configuração |
| Front (depois) | React + Vite + Tailwind, projeto separado |
| Deploy | Docker, SQLite em volume |

Regras fixas: nenhuma chamada de IA sem registro de custo (`llm_calls`); nenhum prompt sem versão; não republicar texto das matérias nem contornar paywall/robots.txt.

## Estrutura de pastas

Monólito modular; os módulos são **etapas do pipeline** (seção 3), não entidades de CRUD. Crie cada pasta só quando a fase precisar dela.

```
src/
├── index.ts            # entry point: agendador (e depois a API)
├── config.ts           # lê e valida o .env
├── db/                 # conexão SQLite + esquema, compartilhado por todos os módulos
├── modules/
│   ├── ingestion/      # buscar feeds, guardar bruto, fetch_runs
│   ├── normalization/  # URL canônica, hash, deduplicação
│   ├── clustering/     # embeddings + agrupamento
│   ├── ai/             # LlmClient, EmbeddingClient, adaptador Gemini (única etapa que fala com IA)
│   ├── briefing/       # briefing do dia
│   └── api/            # rotas HTTP (único módulo com controllers)
└── shared/             # utilitários pequenos
```

Um módulo importa só de `db/`, `shared/` e, no máximo, da etapa anterior.

## Convenções

- **Idioma:** código (pastas, arquivos, variáveis, funções, tabelas) em inglês; comentários, commits e documentação em português.
- Coleta: baixar com `fetch` nativo (com `User-Agent` e timeout) e interpretar com `parser.parseString()`. **Não usar `parser.parseURL()`**: a conexão fica aberta e o processo não encerra.
- Imports relativos com extensão `.js`, mesmo para arquivos `.ts` (exigência do `nodenext`): `import { x } from "./coleta.js"`.
- `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes` ligados: `arr[0]` é `T | undefined`.
- Datas em UTC no banco; guardar também o horário original de publicação.
- Nunca commitar `.env`, chaves de API ou arquivos `*.sqlite`.

## Comandos

```
npm run build       # tsc: src/ -> dist/
npm start           # node dist/index.js
npm run migrate     # aplica migrations pendentes (rodar da raiz do projeto; cria app.db)
npm run type-check  # tsc --noEmit
npm test            # compila e roda os testes (node:test) em dist/**/*.test.js
```

Testes: runner nativo do Node (`node:test` + `node:assert/strict`), arquivos `*.test.ts` ao lado do código testado. Instalação limpa: `npm ci --ignore-scripts` (o `better-sqlite3` usa os binários de `prebuilds/`; sem Visual Studio, `npm ci` sem a flag tenta compilar e falha no Windows).

## Git e CI

- Commits em **Conventional Commits**: `tipo(escopo opcional): descrição`. Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`, `style`. Escopo = nome do módulo (`ingestion`, `db`, `normalization`...). Tipo em inglês, descrição em português, no imperativo e em minúsculas (ex.: `feat(ingestion): busca e interpreta feed RSS`). Mudança incompatível: `!` depois do tipo e rodapé `BREAKING CHANGE:`.
- Um commit por mudança lógica; não misturar `feat` com `docs` ou `ci` no mesmo commit.
- Branch principal: `main`. Trabalho novo em branch (`feat/...`, `fix/...`) e entra por pull request.
- CI (`.github/workflows/ci.yml`): em todo PR para `main` e todo push em `main`, roda `npm ci --ignore-scripts` e `npm test` no Node da `.nvmrc`. Ruleset da `main` ativo no GitHub: exige PR, exige o check `test` (nome do job, não do workflow; renomear o job trava os PRs), bloqueia force push e exclusão. Push direto na `main` é recusado.

## Banco de dados

- SQL puro com `better-sqlite3`. `src/db/connection.ts` abre `app.db` (relativo à pasta atual), liga WAL e `foreign_keys = ON` (o SQLite deixa chaves estrangeiras desligadas por padrão).
- Migrations em `src/db/migrations/NNN_nome.ts`, cada uma exporta `up(db)`. São `.ts`, não `.sql`, porque o `tsc` só copia para `dist/` o que compila.
- `src/db/migrate.ts` aplica, em ordem e numa transação, as migrations que ainda não estão na tabela `_migrations`.
- **Nunca editar uma migration já aplicada**; mudança de esquema = nova migration (`002_...`).
- Artigos e fontes não são apagados: sem `ON DELETE CASCADE`; fonte abandonada vira `active = 0`.
- `UNIQUE` só onde o valor identifica uma coisa só: `articles.canonical_url`, `sources.url`. `hash` (texto de agência se repete entre veículos) e `guid` (opcional no RSS) não são únicos.

## Fases (seção 9)

| Fase | Entregas | Portão de saída |
| --- | --- | --- |
| **0. Validação** | Script que busca os feeds e mede cobertura e frescor; uma semana de artigos guardados; protótipo de agrupamento; 50 pares rotulados; teste cego de 2–3 modelos em 30 eventos | Fontes iniciais e orçamento definidos |
| **1. MVP** | Esquema completo do banco; coleta agendada, normalização e deduplicação; agrupamento incremental com verificação por LLM; resumo com citações; briefing diário; filtros; painel técnico; teto de custo | 2 semanas de uso real; ≥90% de agrupamentos corretos em 50; 0 contradições em 30 resumos |
| 2. Comparação e personalização | Afirmações (`claims`), comparação editorial, conflitos entre fontes, pesos de temas | — |
| 3. Histórico | Linha do tempo, "acompanhar tema", busca semântica, recomendações | — |

Fontes iniciais com feed ativo: G1 (por seção), BBC News Brasil, DW. Demais fontes dependem da validação da fase 0 (seção 5).

## Estado atual

**Fase 0 — início.**

Feito:
- [x] Projeto Node + TypeScript configurado e compilando
- [x] `.gitignore`
- [x] `src/modules/ingestion/feed.ts`: `fetchFeed(url)` com `fetch` + `rss-parser`
- [x] `src/modules/ingestion/collect.ts`: `collectAllSources(db)` grava os artigos de todas as fontes ativas; `npm start` executa uma coleta e encerra (ainda sem agendador)

Próximos passos da fase 0 (ordem combinada):
1. [x] Buscar um feed (BBC News Brasil) com `rss-parser` e imprimir os itens, para ver o formato real dos dados
2. [x] Criar só as tabelas `sources`, `fetch_runs` e `articles` (migration `001_initial`; o esquema completo fica para a fase 1)
3. [x] Gravar artigos com deduplicação por URL canônica e registrar cada coleta em `fetch_runs`
4. [ ] Rodar por uma semana e medir cobertura e frescor de cada fonte

### O que o feed da BBC mostrou (05/11/2026)

- ~36 itens por leitura; campos: `title`, `link`, `pubDate`, `isoDate`, `content`, `contentSnippet`, `guid`.
- `link` traz parâmetros de rastreamento (`?at_medium=RSS&at_campaign=rss`) → URL canônica remove só parâmetros **conhecidos** de rastreio (`utm_*`, `at_*`, `fbclid`...), nunca a query inteira. Guardar também o link original.
- `guid` = URL + `#0` (fragmento); significado ainda desconhecido (fixo ou versão?) → observar na semana de coleta. Deduplicar pela URL canônica; `guid` é campo auxiliar.
- Sem campo de autor → coluna `author` aceita nulo.
- `content` = `contentSnippet` = só a descrição → `evidence_level` "descrição".
- Sem `ETag`/`Last-Modified` na resposta → requisição condicional não funciona para essa fonte.
- Usar `isoDate` (já em UTC, formato ISO) para `published_at`.

### O que a primeira coleta real mostrou (08/11/2026)

- Itens por leitura: BBC 36, DW 65, G1 Economia 100, G1 Política 100.
- DW: `link` traz `?maca=...`, o mesmo valor em todos os itens (identifica o feed, não a matéria); a página abre sem ele → entra na lista de rastreio. `guid` é só o número do artigo.
- G1: 17 dos 100 itens de Política já tinham vindo em Economia. A URL única guarda só a primeira fonte (`source_id`), então `item_new_count` depende da ordem de coleta; para medir cobertura, usar `item_found_count`.
- Nenhum item veio com autor; todos vieram com descrição e data.
- `hash` = SHA-256 de título + descrição normalizados (a proposta cita "título" e "conteúdo"; esta é a definição adotada).
- `published_at` (`2026-11-08T12:00:00.000Z`) e `collected_at` (`2026-11-08 12:00:00`) têm formatos diferentes: comparar com `julianday()`, nunca como texto.

Pendências pequenas:
- `src/config.ts` existe mas está vazio; o caminho do banco (`app.db`) deve vir dele
- Embeddings: criar em migration própria, com `embedding_model` junto do vetor (seção 6)
- `declaration`/`declarationMap` ainda ligados no `tsconfig.json` (opcional remover; servem só para bibliotecas)
- `repository.ts` e `collect.ts` ainda sem testes no projeto (só `canonicalizeUrl` tem)
- `fetch_runs.http_status_code` ainda não é preenchido

> Atualize esta seção sempre que um passo for concluído.
