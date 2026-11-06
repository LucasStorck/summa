import { URL } from "url";

const TRACKING_PREFIXES = ['utm_'];
const TRACKING_PARAMS = new Set(["at_medium", "at_campaign", "fbclid", "gclid", "msclkid"]);

export function canonicalizeUrl(urlString: string): string {
    const url = new URL(urlString);

    const keysToRemove: string[] = [];
    url.searchParams.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      const shouldRemove =
        TRACKING_PARAMS.has(lowerKey) ||
        TRACKING_PREFIXES.some((prefix) => lowerKey.startsWith(prefix));

      if (shouldRemove) {
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach(key => url.searchParams.delete(key));
    url.searchParams.sort();

    url.hash = '';
    return url.toString();
  }