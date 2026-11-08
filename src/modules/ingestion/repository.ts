import Database from 'better-sqlite3';

export interface NewArticle {
  source_id: number;
  title: string;
  description: string | null;
  canonical_url: string;
  original_url: string;
  published_at: string | null;
  evidence_level: 'headline' | 'description' | 'full_text';
  author: string | null;
  content: string | null;
  language: string;
  hash: string;
  guid: string | null;
}

export interface Source {
  id: number;
  name: string;
  url: string;
  language: string;
}

export interface FetchRun {
  status: 'completed' | 'failed';
  item_found_count: number;
  item_new_count: number;
  error_message: string | null;
}

export function saveArticle(db: Database.Database, article: NewArticle): boolean {

  const stmt = db.prepare(`
    INSERT INTO articles (
    source_id, title, description, canonical_url, original_url, published_at, 
    evidence_level, author, content, language, hash, guid
    ) VALUES (
      @source_id, @title, @description, @canonical_url, @original_url, @published_at, 
      @evidence_level, @author, @content, @language, @hash, @guid) ON CONFLICT(canonical_url) DO NOTHING
      `);
  const info = stmt.run(article);
  return info.changes === 1;
}

export function listActiveSources(db: Database.Database): Source[] {
  const stmt = db.prepare(`SELECT id, name, url, language FROM sources WHERE active = 1`);
  return stmt.all() as Source[];
}

export function startFetchRun(db: Database.Database, sourceId: number): number {
  const stmt = db.prepare(`INSERT INTO fetch_runs (source_id, status) VALUES (?, 'in_progress')`);
  const info = stmt.run(sourceId);
  return Number(info.lastInsertRowid);
}

export function endFetchRun(db: Database.Database, runId: number, result: FetchRun): void {
  const stmt = db.prepare(`
    UPDATE fetch_runs
    SET completed_at = datetime('now'),
        status = @status,
        item_found_count = @item_found_count,
        item_new_count = @item_new_count,
        error_message = @error_message
    WHERE id = @id AND completed_at IS NULL
  `);
  stmt.run({ ...result, id: runId });
}