import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  console.log('Running migration: 002_seed_sources...');

  const runMigration = db.transaction(() => {
    const insertSource = db.prepare(`
      INSERT INTO sources (name, type, url, language)
      VALUES (@name, @type, @url, @language)
    `);

    for (const source of [
      { name: 'BBC News Brasil', type: 'rss', url: 'https://feeds.bbci.co.uk/portuguese/rss.xml', language: 'pt-BR' },
      { name: 'DW Brasil', type: 'rss', url: 'https://rss.dw.com/xml/rss-br-all', language: 'pt-BR' },
      { name: 'G1 Economia', type: 'rss', url: 'https://g1.globo.com/rss/g1/economia/', language: 'pt-BR' },
      { name: 'G1 Política', type: 'rss', url: 'https://g1.globo.com/rss/g1/politica/', language: 'pt-BR' },
    ]) {
      insertSource.run(source);
    }
  });

  runMigration();
}