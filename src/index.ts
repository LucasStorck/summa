import db from "./db/connection.js";
import { collectAllSources } from "./modules/ingestion/collect.js";

await collectAllSources(db);
db.close();
