import Database from 'better-sqlite3';
import crypto from 'crypto';
import { canonicalizeUrl } from './canonicalizeUrl.js';
import { fetchFeed } from './feed.js';
import { type NewArticle, saveArticle, listActiveSources, startFetchRun, endFetchRun } from './repository.js';

// Hash do texto, não da URL: a mesma matéria de agência em dois veículos tem URLs
// diferentes, mas gera o mesmo hash. A URL já é identificada por canonical_url.
function hashContent(title: string, description: string | null): string {
  const normalized = `${title} ${description ?? ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export async function collectAllSources(db: Database.Database): Promise<void> {
  const activeSources = listActiveSources(db);

  console.log(`[${new Date().toISOString()}] Iniciando coleta para ${activeSources.length} fontes ativas.`);

  for (const source of activeSources) {
    let runId: number | null = null;
    let itemFoundCount = 0;
    let itemNewCount = 0;

    try {
      runId = startFetchRun(db, source.id);
      console.log(`[Fonte: ${source.name}] Execução #${runId} iniciada.`);

      const feed = await fetchFeed(source.url);
      itemFoundCount = feed.items.length;

      for (const item of feed.items) {
        // title e link são opcionais no RSS, mas obrigatórios no banco.
        // Um item ruim é pulado; não pode derrubar a coleta da fonte inteira.
        const title = item.title?.trim();
        if (!title || !item.link) {
          console.warn(`[Fonte: ${source.name}] Item ignorado: sem título ou link.`);
          continue;
        }

        let canonicalUrl: string;
        try {
          canonicalUrl = canonicalizeUrl(item.link);
        } catch {
          console.warn(`[Fonte: ${source.name}] Item ignorado: URL inválida (${item.link}).`);
          continue;
        }

        const description = item.contentSnippet?.trim() || null;

        const newArticle: NewArticle = {
          source_id: source.id,
          title,
          description,
          canonical_url: canonicalUrl,
          original_url: item.link,
          // isoDate já vem em UTC. Sem data, fica nulo: inventar "agora" falsearia o frescor.
          published_at: item.isoDate ?? null,
          evidence_level: description ? 'description' : 'headline',
          author: item.creator?.trim() || null,
          // Nos feeds, content repete a descrição; a coluna fica para texto integral permitido.
          content: null,
          language: source.language,
          hash: hashContent(title, description),
          guid: item.guid || null
        };

        const isNew = saveArticle(db, newArticle);
        if (isNew) {
          itemNewCount++;
        }
      }

      endFetchRun(db, runId, {
        status: 'completed',
        item_found_count: itemFoundCount,
        item_new_count: itemNewCount,
        error_message: null
      });

      console.log(`[Fonte: ${source.name}] Finalizada com sucesso. Encontrados: ${itemFoundCount} | Novos: ${itemNewCount}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Erro na fonte: ${source.name}]:`, errorMessage);

      if (runId !== null) {
        endFetchRun(db, runId, {
          status: 'failed',
          item_found_count: itemFoundCount,
          item_new_count: itemNewCount,
          error_message: errorMessage
        });
      }
    }
  }

  console.log(`[${new Date().toISOString()}] Pipeline de coleta finalizado.`);
}