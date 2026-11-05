import { fetchFeed } from "./modules/ingestion/feed.js";

async function main() {
  const feedUrl = "https://feeds.bbci.co.uk/portuguese/brasil/rss.xml";
  try {
    const feed = await fetchFeed(feedUrl);
    console.log(`Total items in feed: ${feed.items.length}`);

    // Com noUncheckedIndexedAccess, items[0] é Item | undefined;
    // o if abaixo faz o TypeScript saber que, dentro dele, firstItem existe.
    const firstItem = feed.items[0];
    if (firstItem) {
      console.log("Primeiro item do feed:");
      console.log(JSON.stringify(firstItem, null, 2));
      console.log("------------------------------");
    } else {
      console.log("Nenhum item encontrado no feed.");
    }
  } catch (error) {
    console.error("Erro ao buscar o feed:", error);
  }
}

await main();
