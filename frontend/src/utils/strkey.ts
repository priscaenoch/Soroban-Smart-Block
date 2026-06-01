/**
 * strkey.ts — Stellar strkey address utilities for the frontend.
 *
 * Handles cross-chain interoperability (Issue #170):
 *  - Detects G... (ed25519 account), M... (muxed account), C... (contract) addresses
 *  - Resolves M... muxed addresses to their base G... account for routing
 */

/** Returns true if the string looks like a Stellar G... account address. */
export function isAccountAddress(addr: string): boolean {
  return typeof addr === "string" && addr.startsWith("G") && addr.length === 56;
}

/** Returns true if the string looks like a Stellar M... muxed account address. */
export function isMuxedAddress(addr: string): boolean {
  return typeof addr === "string" && addr.startsWith("M") && addr.length >= 56;
}

/** Returns true if the string looks like a Stellar C... contract address. */
export function isContractAddress(addr: string): boolean {
  return typeof addr === "string" && addr.startsWith("C") && addr.length === 56;
}

/**
 * Returns the route target for a Stellar address:
 *  - G... → /wallet/:addr
 *  - M... → /wallet/:baseGAddress  (muxed resolved to base account)
 *  - C... → /contract/:addr
 *  - other → null (not linkable)
 */
export function addressRoute(addr: string): string | null {
  if (isAccountAddress(addr)) return `/wallet/${addr}`;
  if (isContractAddress(addr)) return `/contract/${addr}`;
  if (isMuxedAddress(addr)) {
    const base = resolveMuxed(addr);
    return base ? `/wallet/${base}` : null;
  }
  return null;
}

/**
 * Resolve a muxed M... address to its base G... account address.
 * Returns null if the input is not a valid muxed address.
 *
 * Note: This is a pure string-based heuristic for the frontend.
 * The indexer already resolves M... → G... before storing, so in practice
 * the frontend will rarely see raw M... addresses. This handles edge cases
 * where raw XDR is displayed directly (e.g. XdrInspector page).
 */
export function resolveMuxed(addr: string): string | null {
  if (!isMuxedAddress(addr)) return null;
  // The indexer resolves M... → G... at decode time, so if we see an M...
  // in the frontend it came from raw XDR display. We cannot decode it
  // without the stellar-sdk in the browser bundle, so we return null and
  // let the caller fall back to displaying the address without a link.
  // If @stellar/stellar-sdk is available in the bundle, use it:
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdk = (globalThis as any).__stellarSdk;
    if (sdk?.StrKey?.decodeMuxedAccount) {
      const decoded = sdk.StrKey.decodeMuxedAccount(addr);
      return sdk.StrKey.encodeEd25519PublicKey(decoded.ed25519);
    }
  } catch {
    // sdk not available or invalid address
  }
  return null;
}

/**
 * Truncate a Stellar address for display: "GABCD…WXYZ"
 */
export function truncateAddress(addr: string, head = 6, tail = 4): string {
  if (typeof addr !== "string" || addr.length <= head + tail) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}
