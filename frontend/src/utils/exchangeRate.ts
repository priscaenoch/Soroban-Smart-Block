/**
 * Exchange rate helper — fetches USD prices from CoinGecko public API.
 * Maps common SEP-41 / Stellar token symbols to CoinGecko coin IDs.
 */

const COINGECKO_IDS: Record<string, string> = {
  XLM: "stellar",
  USDC: "usd-coin",
  USDT: "tether",
  PYUSD: "paypal-usd",
  BTC: "bitcoin",
  ETH: "ethereum",
};

// Simple in-memory cache: symbol → { usd, fetchedAt }
const cache = new Map<string, { usd: number; fetchedAt: number }>();
const TTL_MS = 60_000; // 1 minute

export async function getUsdRate(symbol: string): Promise<number | null> {
  const key = symbol.toUpperCase();
  const coinId = COINGECKO_IDS[key];
  if (!coinId) return null;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.usd;

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
    if (!res.ok) return null;
    const json = await res.json();
    const usd: number = json[coinId]?.usd;
    if (typeof usd !== "number") return null;
    cache.set(key, { usd, fetchedAt: Date.now() });
    return usd;
  } catch {
    return null;
  }
}

/**
 * Format a fiat value as "~$XX.XX USD".
 * Returns null if the rate is unavailable.
 */
export async function fiatLabel(amount: number, symbol: string): Promise<string | null> {
  const rate = await getUsdRate(symbol);
  if (rate === null) return null;
  const value = amount * rate;
  return `~$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}
