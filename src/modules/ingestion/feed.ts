import Parser from "rss-parser";

// Os genéricos vazios desligam os campos extras do tipo padrão ({ [key: string]: any }),
// assim feed.items[n] tem só os campos conhecidos do RSS (title, link, guid, isoDate...).
const parser = new Parser<{}, {}>();

const USER_AGENT = "Summa/0.1 (leitor pessoal)";
const TIMEOUT_MS = 15_000;

export async function fetchFeed(url: string) {
  const resp = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    // Sem timeout, um servidor que não responde trava a coleta para sempre.
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch feed: ${resp.status} ${resp.statusText}`);
  }

  const text = await resp.text();
  return parser.parseString(text);
}
