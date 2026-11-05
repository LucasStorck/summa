import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  console.log('Running migration: 001_initial...');

  const runMigration = db.transaction(() => {
    db.exec(`CREATE TABLE sources (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL CHECK(length(name) > 0),
            type TEXT NOT NULL CHECK(type IN ('rss', 'google_news', 'api')),
            url TEXT NOT NULL UNIQUE,
            language TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
            weight INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT (datetime('now'))
        )`)

    db.exec(`CREATE TABLE fetch_runs (
            id INTEGER PRIMARY KEY,
            source_id INTEGER NOT NULL,
            started_at DATETIME NOT NULL DEFAULT (datetime('now')),
            completed_at DATETIME,
            status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')),
            error_message TEXT,
            item_found_count INTEGER NOT NULL DEFAULT 0,
            item_new_count INTEGER NOT NULL DEFAULT 0,
            http_status_code INTEGER,
            FOREIGN KEY (source_id) REFERENCES sources (id)
        )`);

    db.exec(`CREATE TABLE articles (
            id INTEGER PRIMARY KEY,
            source_id INTEGER NOT NULL,
            title TEXT NOT NULL CHECK(length(title) > 0),
            description TEXT,
            canonical_url TEXT NOT NULL UNIQUE,
            original_url  TEXT NOT NULL,
            published_at DATETIME,
            evidence_level TEXT NOT NULL CHECK(evidence_level IN ('headline', 'description', 'full_text')),
            author TEXT,
            content TEXT,
            language TEXT NOT NULL,
            hash TEXT NOT NULL,
            guid TEXT,
            collected_at DATETIME NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (source_id) REFERENCES sources (id)
        )`);

    db.exec(`CREATE INDEX idx_articles_source ON articles (source_id);
                CREATE INDEX idx_articles_published ON articles (published_at);
                CREATE INDEX idx_fetch_runs_source ON fetch_runs (source_id);`)
  });

  runMigration();
}