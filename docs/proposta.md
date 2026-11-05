# Assistente Pessoal de Notícias — Proposta de Produto e Arquitetura

Nov 4, 2026 · @Lucas Storck

## 1. Resumo e proposta de valor

Recomendo construir um **briefing diário baseado em acontecimentos**, não um agregador de resumos: o produto agrupa as matérias de vários veículos em um único evento, resume o que é fato e mostra como cada veículo enquadrou a história. O MVP cobre coleta por RSS, agrupamento, resumo por evento e briefing diário; a comparação editorial completa fica para a fase seguinte, porque é a funcionalidade mais cara e a mais arriscada.

**Proposta de valor refinada:** *um acontecimento, todas as coberturas, uma leitura de 30 segundos, com link para tudo.*

O que torna o projeto diferente de um leitor de RSS ou de um "resumidor de notícias":

- **Unidade é o evento, não o artigo.** Dez matérias sobre o mesmo fato viram um cartão só.
- **Fato separado de enquadramento.** Cada resumo distingue o que é verificável, o que é declaração atribuída e o que é interpretação do veículo.
- **Rastreabilidade total.** Toda frase do resumo aponta para as matérias que a sustentam; o que as fontes não dizem aparece como "não esclarecido".
- **Foco em português e no Brasil**, com cobertura internacional de agências e veículos em português.

**Decisões recomendadas (detalhadas nas seções seguintes):**

| Decisão | Recomendação | Por quê |
| --- | --- | --- |
| Fonte de dados | RSS e feeds oficiais; título, descrição e link | É o que os veículos expõem de forma clara e permitida; evita paywall e raspagem |
| Agrupamento | Embeddings + verificação por LLM barato | Embeddings agrupam barato; o LLM corrige falsos positivos |
| IA | Modelo pequeno por padrão, modelo maior só em casos difíceis, tudo atrás de uma interface própria | Custo estimado de poucos dólares por mês e troca de fornecedor sem reescrever o sistema |
| Banco | SQLite com embeddings | Um único arquivo SQLite para dados, busca textual e vetores |
| Comparação editorial | Versão leve no MVP, completa na fase 2 | Depende de texto integral, que nem sempre está disponível |

Um ponto de atenção desde já: **Reuters e AP não oferecem feed público funcional** e Folha e Estadão têm paywall. A cobertura do MVP será de título e descrição para esses veículos, e isso muda o que o resumo pode afirmar (seção 5).

## 2. Escopo do MVP

O MVP entrega um briefing diário confiável com 6 a 8 fontes, agrupado por acontecimento e resumido com links, usado por uma pessoa. Tudo que exige texto integral, perfil de leitura ou análise longitudinal fica para depois, mas **os dados que alimentam essas funções já são guardados desde o primeiro dia**, para que o histórico exista quando a função chegar.

| Funcionalidade | No MVP? | Como entra |
| --- | --- | --- |
| Coleta por RSS e feeds oficiais | Sim | 6 a 8 fontes configuráveis em arquivo ou tela simples; coleta a cada 30 a 60 min |
| Normalização e deduplicação | Sim | URL canônica, hash de título e similaridade; essencial para o agrupamento |
| Agrupamento por acontecimento | Sim | Embeddings do título + descrição, clusterização e checagem por LLM |
| Resumo por acontecimento | Sim | Estrutura fixa: o que aconteceu, quem, onde, quando, por que importa, o que ainda não está claro |
| Morning Briefing | Sim | Uma página: principais do Brasil, mundo, economia, tecnologia, ciência; gerado 1 vez por manhã |
| Filtros por tema e fonte | Sim, básico | Categoria por classificação automática; ligar e desligar fontes |
| Links, data e hora de publicação | Sim | Obrigatório em todo cartão |
| Busca e histórico | Parcial | Busca textual simples no que foi coletado; tudo é armazenado desde o início |
| Comparação editorial | Versão leve | Tabela "o que cada veículo destacou no título e na descrição"; análise completa na fase 2 |
| Prioridades e pesos de temas | Fase 2 | Depende de uso real para calibrar |
| Acompanhamento de um tema ao longo do tempo | Fase 3 | Linha do tempo de eventos ligados |
| Notícias recomendadas | Fase 3 | Só faz sentido com histórico de leitura |
| App móvel | Não | Interface responsiva no navegador basta |

**Como saber se o MVP funcionou** (critérios que você mede sozinho em duas semanas):

- Você abre o briefing em vez de visitar os portais na maior parte dos dias.
- Em uma amostra de 50 acontecimentos, pelo menos 90% dos agrupamentos estão corretos (matérias que não deveriam estar juntas contam como erro).
- Nenhuma afirmação do resumo contradiz as fontes em uma amostra de 30 resumos conferidos à mão.
- O custo mensal de IA fica dentro do orçamento que você definir (estimativas na seção 6).

## 3. Arquitetura técnica

A arquitetura separa o sistema em seis etapas independentes, ligadas por tabelas no SQLite, e coloca todos os fornecedores de IA atrás de uma única interface. As sete funções que você pediu (coleta, extração e normalização, duplicadas e relacionadas, agrupamento, IA, armazenamento e exibição) estão todas aqui; duplicadas e agrupamento ficam em etapas vizinhas porque usam os mesmos dados.

**Diagrama (em texto):** coleta → normalização → agrupamento → análise por IA → armazenamento (SQLite) → API e interface. A etapa 4 (análise por IA) é a única que fala com os fornecedores de IA, por meio de uma interface própria com cache e registro de custo; todas as etapas leem e gravam no armazenamento.

Só a etapa 4 fala com fornecedores de IA, por uma interface própria com cache e registro de custo; as demais etapas só leem e gravam no banco.

**Princípios de projeto:**

- **Monólito modular no MVP:** um único deploy, com módulos de fronteiras claras. Só vira serviços separados se houver necessidade real.
- **Etapas ligadas por estado no banco:** cada artigo passa por *coletado, normalizado, agrupado, analisado*. Reprocessar uma etapa não obriga a refazer as anteriores.
- **Idempotência:** processar o mesmo item duas vezes não duplica nada, porque tudo é identificado por hash e URL canônica.
- **Fontes configuráveis:** uma fonte nova é uma linha no cadastro; só exige código se o formato for novo.
- **IA trocável e medida:** tarefa, modelo e versão de prompt ficam em configuração, e cada chamada é registrada com custo e latência.
- **Rastreabilidade:** toda frase de resumo aponta para os artigos que a sustentam, com data e hora de publicação.

## 4. Stack recomendada

Recomendo TypeScript com Node no backend, SQLite como banco e React no front, também em TypeScript. O conjunto cabe em uma única máquina, não exige servidor de banco e usa uma linguagem só nas duas pontas. Como o projeto é pessoal, a escolha também serve para aprender. Se preferir uma stack que você já domina, Java com Spring Boot ou Python mantêm a arquitetura da seção 3 intacta.

| Camada | Escolha | Por quê | Alternativa |
| --- | --- | --- | --- |
| Backend e coleta | Node LTS atual (26) + TypeScript com Fastify ou Hono, agendador interno (`node-cron` ou cron do sistema); NestJS, se quiser algo parecido com o Spring | Um serviço modular em vez de microsserviços; poucas centenas de itens por dia | Java + Spring Boot, o que você já usa, ou Python + FastAPI, se quiser clusterização com bibliotecas de ML |
| Leitura de feeds e HTML | rss-parser (RSS/Atom) e cheerio (HTML) | Bibliotecas simples e bem difundidas no ecossistema Node | `feedparser` e `trafilatura` em Python |
| Filas | Tabela de jobs no SQLite no MVP; RabbitMQ só se surgir gargalo | Evita operar um broker para um fluxo de baixo volume | RabbitMQ desde o início, se o objetivo também for praticar mensageria |
| Banco | SQLite em modo WAL, com FTS5 para busca textual; embeddings guardados como BLOB e comparados em memória | Um arquivo só, sem servidor para operar; sobra folga nesse volume | PostgreSQL com pgvector, se o volume ou a busca semântica crescerem (a migração dá trabalho) |
| Acesso ao banco e validação | Drizzle ORM (ou Prisma) sobre better-sqlite3; Zod para validar o JSON dos LLMs | Esquema e respostas de IA tipados de ponta a ponta | SQL puro com better-sqlite3, para aprender o que o ORM esconde |
| Embeddings | Modelo multilíngue por API, atrás de uma interface `EmbeddingClient` | Custo quase zero nesse volume (seção 6) | Modelo aberto rodando local, como bge-m3, para custo zero e independência |
| LLM | Interface própria `LlmClient` com um adaptador por fornecedor; o primeiro é o do Gemini, via @google/genai | Troca de fornecedor sem reescrever o sistema | Vercel AI SDK como camada pronta, se a abstração dele bastar |
| Frontend | React + Vite + Tailwind em TypeScript, responsivo e com tipos compartilhados com o backend | Renderização no servidor não é necessária para uso pessoal | Next.js, se quiser compartilhar páginas depois |
| Hospedagem | Docker (app + arquivo SQLite em volume) no seu computador ou em um VPS pequeno | Um comando sobe tudo; custo fixo baixo | Nuvem gerenciada, só se o uso crescer |
| Observabilidade | Tabela com cada chamada de LLM (tokens, custo, latência, versão do prompt) | Mostra o custo real e permite comparar fornecedores | Painéis externos, depois |

Duas regras de projeto valem mais que qualquer ferramenta: **nenhuma chamada de IA sem registro de custo**, e **nenhum prompt sem versão**, para saber por que um resumo mudou. Em TypeScript, mais duas: validar com Zod todo JSON devolvido por um LLM antes de gravar, e manter o modo strict do compilador ligado desde o primeiro dia.

## 5. Coleta, extração, deduplicação e agrupamento

A coleta por RSS cobre bem G1 e BBC News Brasil, mas deixa Reuters, AP, Folha e Estadão só com título, descrição e link. Isso define o que o resumo pode afirmar, então o sistema registra, para cada matéria, **qual nível de texto foi lido** e mostra isso ao usuário.

### Situação das fontes

Verificada em consultas feitas em 4 de novembro de 2026, com base em páginas de terceiros que testam os feeds; a fase 0 do roadmap inclui testar cada endereço direto da sua máquina.

| Veículo | Acesso recomendado | Situação encontrada |
| --- | --- | --- |
| G1 | RSS por seção (`g1.globo.com/rss/g1/economia/`, `/mundo/`, `/politica/`, `/tecnologia/`) | Seções principais publicam normalmente; alguns feeds, como Brasil, Ciência e Saúde e São Paulo, aparecem como parados |
| BBC News Brasil | `feeds.bbci.co.uk/portuguese/brasil/rss.xml` e `/portuguese/rss.xml` | Ativo, cerca de 14 publicações por dia, com resumo curto em cada item |
| DW Brasil | Feeds em `rss.dw.com` | Feed em inglês confirmado funcionando; o endereço em português não foi verificado |
| Reuters | Google News RSS com `site:reuters.com` | Sem feed público desde junho de 2020; a alternativa traz só título e link |
| Associated Press | Google News RSS com `site:apnews.com` | Os feeds do próprio site retornaram erro 403 (bloqueio de robôs) em 22/10/2026 |
| Folha de S.Paulo | RSS, a confirmar | Um feed antigo aparece sem publicar há mais de 3 anos; conteúdo com paywall |
| UOL | A confirmar | Não encontrei feed oficial confirmado |
| Estadão | A confirmar | Não encontrei feed oficial confirmado; conteúdo com paywall |
| CNN Brasil | A confirmar | Não encontrei feed confirmado; os feeds da CNN americana estão congelados desde agosto de 2024 |

**Consequência prática:** o MVP deve começar com as fontes que têm feed ativo (G1, BBC News Brasil, DW) e adicionar as demais conforme a fase 0 confirmar o acesso. Os feeds via Google News são frágeis e sujeitos aos termos do Google; vale usá-los em baixo volume, como complemento.

### Pipeline

1. **Coleta** a cada 30 a 60 minutos, com requisição condicional (`ETag` e `Last-Modified`), identificação clara do cliente e respeito a `robots.txt` e aos termos de cada veículo. O conteúdo bruto fica guardado.
2. **Normalização:** URL canônica sem parâmetros de rastreio, título limpo, data em UTC, idioma, veículo, seção e hash do conteúdo.
3. **Deduplicação:** mesma URL canônica ou mesmo título normalizado é o mesmo artigo (atualização, não item novo).
4. **Embedding** do título mais a descrição.
5. **Agrupamento incremental:** cada artigo novo busca os eventos mais próximos das últimas 48 horas, comparando embeddings em memória. Acima do limiar A, entra no evento; entre B e A, um LLM pequeno responde se é o mesmo acontecimento; abaixo de B, cria um evento novo. Os limiares são calibrados com cerca de 50 pares rotulados por você.
6. **Classificação por tema** pelo mesmo LLM pequeno, com saída restrita a uma lista fechada de categorias.
7. **Resumo do evento**, refeito só quando chega matéria nova ou veículo novo, nunca a cada coleta.
8. **Briefing:** os eventos são ordenados por número de veículos distintos, recência e peso do tema, e o resumo do dia é montado antes do horário em que você costuma ler.

### Limites legais e de uso

O sistema guarda título, descrição, link e o resumo gerado por IA, e **não republica texto das matérias**. Não contorna paywalls nem bloqueios de robôs. Texto integral só entra se os termos do veículo permitirem; no caso de assinaturas pessoais, é uma decisão a tomar caso a caso (seção 10). Uso pessoal e sem fins comerciais reduz o risco, mas não o elimina; se o projeto virar público, a conversa muda. Isto não é aconselhamento jurídico.

## 6. IA: modelos, custos e cache

Para o MVP, use um modelo pequeno na triagem e nos resumos, e um modelo médio só nos cerca de 25 acontecimentos do briefing. Pelas minhas estimativas, o custo mensal fica entre **US$ 3 e US$ 11**, e a interface própria da seção 4 permite trocar de fornecedor sem reescrever o sistema.

Um aviso de transparência: esta proposta foi escrita pelo Claude, da Anthropic, e os preços abaixo mostram modelos de três fornecedores. Por isso a fase 0 prevê um **teste cego**: os mesmos 30 acontecimentos resumidos por 2 ou 3 modelos, avaliados por você sem saber qual é qual, antes de escolher o padrão.

### Preços de referência (por milhão de tokens)

| Modelo | Entrada | Saída | Observações |
| --- | --- | --- | --- |
| Claude Haiku 5.5 | US$ 0,10 | US$ 0,50 | Vale para prompts de até 100 mil tokens; acima disso, US$ 0,50 e US$ 2,50. O tokenizador novo gera cerca de 30% mais tokens para o mesmo texto. Batch cobra metade. |
| Claude Sonnet 5.5 | US$ 2,00 | US$ 10,00 | Leitura de cache a US$ 0,10 |
| Gemini 3.7 Flash | US$ 0,75 | US$ 3,75 | Preço de página de terceiros de 25/08/2026; não consegui abrir a tabela oficial; a família Flash tem camada gratuita para uso leve (veja abaixo) |
| GPT-6 Luna | US$ 0,10 | US$ 0,50 | Mesmo preço do Haiku 5.5, segundo um comparativo de terceiros; confirmar na página da OpenAI |
| Embedding `text-embedding-3-small` | US$ 0,02 | n/a | Preço de listagem de terceiros; segue estável em várias fontes |

Todos os valores vêm de páginas de terceiros, exceto onde indicado. **Antes de contratar, confira a tabela oficial de cada fornecedor.**

### Provedor inicial: Gemini Flash no free tier

Por decisão sua, o MVP usa a API do Gemini, começando por um modelo Flash na camada gratuita, o que deixa o custo de IA perto de zero enquanto você aprende. O adaptador do LlmClient usa o SDK oficial para Node e TypeScript, o pacote @google/genai. O que se sabe, e o que ainda precisa ser conferido:

- **Conteúdo:** na camada gratuita, o que você envia pode ser usado pelo Google para melhorar seus produtos; na paga, não. Por isso, só texto de notícias públicas passa por esse caminho, nunca dados pessoais ou da prefeitura.
- **Modelo:** o modelo inicial, escolhido por você, é o gemini-2.5-flash, que aparece na camada gratuita da sua conta. Não fixe o nome no código; ele fica em configuração. Em 22/10/2026, a página de descontinuações do Google lista `gemini-3.8-flash` (lançado em 2 de setembro de 2026) como o Flash mais recente, e recomenda `gemini-3.8-flash` ou o Flash-Lite 3.5 para projetos novos. O `gemini-2.0-flash` e o `gemini-2.0-flash-lite` foram desligados em 1º de junho de 2026, e o `gemini-2.5-flash` só atende quem já o usava. Como não há data de desligamento anunciada, ele serve para começar; deixe o gemini-3.8-flash como plano B na configuração e repita o teste cego se precisar trocar. Escolha na lista do AI Studio um modelo que apareça como disponível na camada gratuita da sua conta.
- **Limites:** valem por projeto (não por chave), não estão na documentação pública e mudam. Os valores da sua conta aparecem no AI Studio. Confira lá quais modelos Flash e de embeddings estão disponíveis e quantas requisições por minuto e por dia você tem, antes de fechar o plano da fase 0.
- **Estabilidade:** trate a camada gratuita como bônus. Se ela encolher ou acabar, o cenário A (cerca de US$ 3 por mês) continua dentro do orçamento.
- **Menos chamadas por dia:** junte a classificação por tema na mesma chamada do resumo, resuma apenas os eventos que entram no briefing (ou quando você abre o cartão) e mande vários artigos por chamada nas verificações da zona cinzenta do agrupamento. Na sua conta, o gemini-2.5-flash tem 15 requisições por minuto e 1.500 por dia. Pelas hipóteses desta seção, o uso fica na ordem de 200 a 400 requisições por dia, de 13% a 27% da cota diária; por isso essas economias são opcionais no MVP. O limitador do LlmClient deve espaçar as chamadas em cerca de 4 segundos (60 s ÷ 15) e parar ao se aproximar do teto diário. A cota diária zera à meia-noite do horário do Pacífico (5h em Brasília enquanto vigora o horário padrão de inverno nos EUA), então um briefing gerado depois das 5h usa a cota do dia novo; isso conta na escolha do horário do briefing. O limite de tokens por minuto não foi informado e também precisa ser conferido.
- **Qualidade:** ser gratuito não dispensa o teste cego nem os critérios do portão 1 (citação correta em cada frase e nenhuma contradição nos 30 resumos conferidos).

### Estimativa de custo mensal

Hipóteses: cerca de 300 artigos novos por dia depois da deduplicação, 120 acontecimentos por dia, 25 deles no briefing, 5 matérias por acontecimento com título e descrição de aproximadamente 250 tokens cada, mais 30% de tokens no Haiku 5.5. São estimativas minhas, não medições.

| Cenário | O que roda | Custo mensal estimado |
| --- | --- | --- |
| A. Tudo no modelo pequeno | Embeddings, triagem, classificação e todos os resumos no Haiku 5.5 | cerca de US$ 3 |
| B. Pequeno + médio no briefing | A mais Sonnet 5.5 nos 25 acontecimentos do briefing | cerca de US$ 11 |
| C. B + comparação editorial com texto integral | B mais Sonnet 5.5 lendo até 5 matérias completas por acontecimento do briefing | cerca de US$ 27 |

Os embeddings custam centavos por mês nesse volume. O que mais pesa é a saída do modelo médio, então o controle de custo está em **limitar o tamanho do resumo e rodar o briefing em lote durante a madrugada**, quando o processamento em batch cobra metade.

### Cache e economia

- **Chave de cache do resumo:** hash do conjunto de artigos do evento + versão do prompt + modelo. Se nada mudou, não chama a IA.
- **Embeddings:** calculados uma vez por artigo (hash do conteúdo), com o nome do modelo guardado junto de cada vetor. Trocar de modelo de embeddings obriga a recalcular todos, então essa escolha pesa mais que a do modelo de resumo.
- **Prompt fixo no início** da chamada, para aproveitar cache de prompt do fornecedor.
- **Teto de gasto:** limite diário e mensal configurável; ao atingir, o sistema cai para o modelo pequeno e avisa.
- **Limite de requisições (erro 429):** o `LlmClient` repete com espera crescente e, se o limite persistir, adia o item para o próximo ciclo em vez de travar o pipeline. O job noturno envia lotes pequenos.

### Regras para resumos confiáveis

1. O modelo recebe **apenas o texto coletado**, com um identificador por artigo, e é instruído a não usar conhecimento externo.
2. A saída é um JSON com campos fixos: o que aconteceu, quem, onde, quando, por que importa, possíveis consequências e o que ainda não está claro.
3. **Toda frase factual cita os identificadores dos artigos que a sustentam.** Um validador rejeita citações inexistentes.
4. O resumo marca separadamente o que é fato verificável, declaração atribuída a alguém e interpretação do veículo.
5. Quando dois veículos divergem em um número ou fato, o sistema registra o **conflito** em vez de escolher um lado.
6. Uma amostra dos resumos passa por uma segunda verificação automática ("alguma afirmação não está nas fontes?") e por conferência sua nas primeiras semanas.
7. A comparação editorial descreve enquadramento, ênfase e escolha de fontes, **sem classificar um veículo como verdadeiro ou falso** com base em posicionamento.

## 7. Estrutura do banco de dados

O modelo gira em torno de três entidades: **artigo** (o que um veículo publicou), **evento** (o acontecimento que agrupa artigos) e **resumo** (o que a IA produziu sobre um evento, sempre com versão). O resto serve a rastreabilidade, custo e personalização.

| Tabela | Campos principais | Função |
| --- | --- | --- |
| `sources` | id, nome, tipo (RSS, Google News, API), URL do feed, idioma, ativa, peso | Cadastro e configuração de fontes sem mexer em código |
| `fetch_runs` | id, source_id, início, status, itens novos, erro | Saúde da coleta e detecção de feed parado |
| `articles` | id, source_id, URL canônica, título, descrição, texto (nulo se não permitido), `evidence_level` (manchete, descrição ou texto integral), autor, publicado_em, coletado_em, hash, idioma, embedding | Fonte de verdade de cada matéria, com data e hora de publicação |
| `events` | id, título, criado_em, atualizado_em, tema principal, nº de veículos, pontuação | O acontecimento agrupado |
| `event_articles` | event_id, article_id, similaridade, método (limiar ou LLM), adicionado_em | Liga artigos a eventos e permite auditar o agrupamento |
| `event_summaries` | id, event_id, versão, modelo, versão do prompt, conteúdo (JSON), hash de entrada, gerado_em | Resumos versionados; o hash é a chave de cache |
| `summary_citations` | summary_id, trecho do resumo, article_id | Rastreia cada afirmação até a matéria |
| `claims` (fase 2) | id, event_id, texto, tipo (fato, declaração, opinião, interpretação), article_id, atribuído a | Separa fatos de opiniões e alimenta a comparação editorial |
| `event_comparisons` (fase 2) | event_id, versão, enquadramentos por veículo (JSON), conflitos (JSON) | Comparação editorial salva |
| `topics` e `article_topics` | tema, artigo, confiança | Classificação para filtros |
| `user_prefs` | temas e pesos, fontes preferidas, horário do briefing | Personalização (uso de uma pessoa, mas já tabelado) |
| `briefings` e `briefing_items` | data, event_id, posição, seção | O briefing de cada dia, que fica no histórico |
| `llm_calls` | id, tarefa, fornecedor, modelo, versão do prompt, tokens de entrada e saída, custo, latência, hash, cache (sim ou não) | Custo real, comparação de fornecedores e cache |

**Decisões de modelagem:**

- Artigos nunca são apagados nem sobrescritos; uma atualização do veículo cria nova versão do conteúdo, mantendo o histórico.
- Eventos podem ser **fundidos ou divididos** depois; por isso `event_articles` guarda o método e a similaridade de cada ligação.
- Datas ficam em UTC com o horário de publicação original do veículo, para exibir "publicado às 08h12" e ordenar a evolução de um tema.
- A busca textual usa o FTS5 do SQLite, que não tem stemmer para português (até onde sei), então "eleição" e "eleições" podem não casar sem tratamento extra; a busca semântica usa o embedding já guardado.
- No SQLite, o embedding de cada artigo fica como BLOB e a similaridade é calculada em memória sobre os eventos das últimas 48 horas, o que basta nesse volume. A extensão sqlite-vec ainda está antes da versão 1.0, então só vale usar se a busca em memória ficar lenta.
- O banco roda em modo WAL: leituras não bloqueiam, mas só um processo grava por vez. Coleta e API devem dividir o mesmo arquivo com gravações curtas.

## 8. Fluxos e telas

A interface gira em torno de um único hábito: abrir a página de manhã, ler o briefing em 10 a 15 minutos e só aprofundar no que interessar. São cinco telas no produto e uma de administração.

| Tela | O que mostra | Ação principal |
| --- | --- | --- |
| **Briefing do dia** (início) | Cabeçalho com data e horário da geração; seções Brasil, Mundo, Economia e mercado, Política, Tecnologia, Ciência e meio ambiente, mais temas seus; cada acontecimento em um cartão | Ler o cartão e expandir |
| **Acontecimento** | Resumo estruturado (o que, quem, onde, quando, por que importa, consequências, o que ainda não está claro), lista de veículos com data e hora, informações conflitantes sinalizadas | Abrir a matéria original |
| **Comparar coberturas** | Colunas por veículo: o que destacou, quais fontes ouviu, linguagem; fatos, declarações, opiniões e interpretações separados | Entender o enquadramento de cada um |
| **Explorar** | Busca por assunto, filtros de tema, fonte e período; linha do tempo de um tema (fase 3) | Achar um assunto antigo ou acompanhar sua evolução |
| **Preferências** | Fontes ligadas e desligadas, temas e pesos, horário do briefing, teto de custo | Ajustar o que aparece |
| **Painel técnico** (administração) | Saúde dos feeds, itens coletados por dia, custo de IA por tarefa e por fornecedor, erros | Detectar feed parado e gasto fora do esperado |

**Cartão de acontecimento no briefing**, de cima para baixo: título em linguagem neutra; resumo de 2 a 3 frases; 3 a 4 pontos principais; ícones dos veículos que cobriram, com contagem; horário da publicação mais recente; marca de "conflito entre fontes" quando houver; botões *Detalhes* e *Comparar*. Os cartões não usam imagens dos veículos.

**Fluxo diário do usuário:**

1. Abre o briefing, que já foi gerado antes do horário configurado.
2. Percorre as seções e lê os cartões; os acontecimentos de maior pontuação aparecem primeiro.
3. Expande um acontecimento para ver o resumo estruturado e os conflitos entre fontes.
4. Se quiser, abre *Comparar* para ver como cada veículo enquadrou o assunto.
5. Clica no link do veículo para ler a matéria original (e passa pelo paywall do próprio veículo, se for assinante).
6. Marca um tema como "acompanhar" para que novos eventos ligados apareçam no briefing seguinte (fase 3).

**Fluxo diário do sistema:** coleta contínua a cada 30 a 60 minutos; um ciclo de agrupamento e classificação depois de cada coleta; geração dos resumos e do briefing de madrugada, em lote; atualização incremental durante o dia se um evento importante ganhar novas matérias.

O desktop é a prioridade e o layout responsivo mantém uma coluna no celular, sem aplicativo nativo.

## 9. Roadmap

O caminho tem quatro fases e três portões: a validação de uma semana vem antes de qualquer interface, e o MVP só é considerado pronto depois de duas semanas de uso real. As durações são estimativas minhas para quem trabalha algumas horas por dia, não compromissos.

**Diagrama (em texto):** quatro fases em sequência (0 validação, 1 MVP, 2 comparação e personalização, 3 histórico e acompanhamento), com três portões de saída entre elas; os critérios de cada portão estão na tabela de fases e na seção 2.

Se um portão falhar, a fase se repete em vez de avançar; o mais provável é que o Portão 0 mude a lista de fontes e o Portão 1 mude os limiares de agrupamento.

| Fase | Principais entregas |
| --- | --- |
| 0. Validação | Script que busca todos os feeds e mede cobertura e frescor; uma semana de artigos guardados; protótipo de agrupamento sobre esses dados; 50 pares de artigos rotulados por você; teste cego de 2 ou 3 modelos em 30 acontecimentos; fontes iniciais e orçamento definidos |
| 1. MVP | Esquema do banco; coleta agendada, normalização e deduplicação; agrupamento incremental com verificação por LLM; resumo estruturado com citações; briefing diário em uma página; filtros por tema e fonte; painel técnico simples; teto de custo de IA |
| 2. Comparação e personalização | Tabela de afirmações e comparação editorial; sinalização de conflitos entre fontes; pesos de temas e fontes; texto integral onde os termos permitirem; busca textual melhorada |
| 3. Histórico e acompanhamento | Linha do tempo de temas e função "acompanhar"; busca por significado com os embeddings já guardados; alertas de acompanhamento; recomendações; ajustes para uso no celular |

## 10. Riscos, limitações e decisões em aberto

Os dois maiores riscos são **acesso às fontes** (feeds que somem ou que só trazem título) e **qualidade do agrupamento** (eventos misturados ou separados). Ambos aparecem cedo se a fase 0 for feita antes de qualquer interface.

### Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Feeds inexistentes, parados ou bloqueados (Reuters, AP, Folha, UOL, Estadão, CNN Brasil) | Cobertura desigual; resumos baseados só em manchetes | Testar cada fonte na fase 0; marcar o nível de evidência em cada matéria; começar com as fontes ativas |
| Paywall e direitos autorais | Risco jurídico e de bloqueio se houver raspagem | Guardar só título, descrição, link e resumo próprio; não contornar paywall; respeitar `robots.txt` e termos |
| Alucinação ou distorção nos resumos | Perda de confiança no produto | Citações obrigatórias por frase, validador, verificação por amostragem e conferência manual inicial |
| Agrupamento errado (fusões e divisões) | Cartões confusos ou repetidos | Limiares calibrados com pares rotulados; verificação por LLM na zona cinzenta; possibilidade de corrigir manualmente |
| Comparação editorial vista como "classificar veículos" | Conclusões enviesadas ou injustas | Descrever enquadramento e ênfase, sem rótulo de verdade ou ideologia; mostrar sempre o trecho que sustenta cada observação |
| Custo de IA fugir do previsto | Conta maior que o orçamento | Registro por chamada, teto diário e mensal, cache e execução em lote |
| Dependência de um fornecedor de IA | Troca difícil ou preço fora de controle | Interface própria, teste cego entre fornecedores, versão de prompt registrada |
| Free tier do Gemini mudar, limitar ou usar seus dados | Coleta parada por limite; custo volta a existir | Retry e adiamento de itens, só conteúdo público no envio, cenário A como plano B (cerca de US$ 3 por mês) |
| Mudança de preço ou de modelo | Estimativas desatualizadas | Revisar a seção 6 a cada trimestre; preços ficam em configuração |
| Escopo crescer sem o MVP existir | Projeto não termina | Critérios de saída por fase (seção 9) |

### Decisões que dependem de você

1. **Linguagem do backend:** TypeScript com Node (recomendado, pelo aprendizado), Java com Spring Boot ou Python.
2. **Onde roda:** seu computador ou um VPS pequeno; define horário de coleta e disponibilidade do briefing.
3. **Orçamento mensal de IA:** o cenário A (cerca de US$ 3), B (cerca de US$ 11) ou C (cerca de US$ 27).
4. **Fornecedor inicial de IA:** começar pelo gemini-2.5-flash no free tier (sua decisão), confirmado ou trocado pelo teste cego da fase 0.
5. **Assinaturas (Folha, Estadão):** se você assina, se aceita ler texto integral e sob quais termos; a recomendação é só manchete e descrição até conferir os termos de cada um.
6. **Fontes iniciais:** quais das nove listadas entram no MVP e se aceita os feeds via Google News para Reuters e AP.
7. **Horário e duração do briefing:** que horas ele precisa estar pronto e quantos acontecimentos por seção.
8. **Repositório:** se o código for público, o repositório não deve conter dados coletados nem chaves de API.

## Fontes

Consultas feitas em 4 de novembro de 2026. As estimativas de custo da seção 6 foram recalculadas por script a partir dos preços abaixo e das hipóteses descritas lá.

**Páginas abertas e lidas:**

- [News RSS feeds that still work in 2026](https://opentweet.io/news-rss-feeds): teste de feeds de 22/10/2026, com a situação de Reuters, AP, CNN e DW em inglês.
- [BBC Brasil - Brasil RSS feed](https://feeder.co/discover/e967792df0/bbcbrasil-com): endereço e frequência do feed da BBC News Brasil.
- [Claude Haiku 5.5 API: pricing, the 100K cliff](https://www.buildmvpfast.com/blog/claude-haiku-5-5-api-pricing-high-volume-agents-2026): preços de Haiku 5.5 e Sonnet 5.5, tokenizador novo e preço do GPT-6 Luna.
- [Gemini API deprecations](https://ai.google.dev/gemini-api/docs/deprecations?authuser=0&hl=en): modelos Flash atuais, desligados e substitutos (página atualizada em 22/10/2026).
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing?authuser=3): camada gratuita nos modelos Flash e uso dos dados na camada gratuita; a cópia que consultei é antiga, então confira nomes de modelos.
- [Rate limits do Google, DevelopersDigest](https://www.developersdigest.tech/rate-limits/google): limites por projeto e reset diário, com valores só no AI Studio (17/10/2026).

**Resultados de busca não abertos (confirmar antes de decidir):**

- [Feeds RSS do G1](https://feeder.co/ca/discover/site/g1.globo.com): lista de feeds ativos e parados.
- [Feed da Folha, São Paulo - Principal](https://feeder.co/de/discover/4efc58cf5d/redir-folha-com-br-redir-online-saopaulo-rss091-https-www1-folha-uol-com-br-saopaulo): indicação de feed sem publicar há mais de 3 anos.
- [Reuters RSS feeds](https://feeder.co/knowledge-base/rss-content/reuters-rss-feeds/): fim dos feeds públicos em junho de 2020.
- [Gemini 3.7 Flash pricing](https://anotherwrapper.com/llm-pricing/gemini-3.7-flash): preço de 25/08/2026; a página bloqueou a leitura.
- [OpenAI Embeddings pricing](https://www.costbench.com/software/embedding-apis/openai-embeddings/): preço do `text-embedding-3-small`.

Não consegui abrir as tabelas oficiais de preço da Anthropic, Google e OpenAI, nem verificar os feeds de UOL, Estadão, CNN Brasil e DW em português.
