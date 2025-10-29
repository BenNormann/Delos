// src/utils/urlUnwrapper.js
/**
 * URL Unwrapper Utility
 * Handles unwrapping of click-tracking URLs, especially Bing redirects
 * Extracts real destination URLs from tracking parameters
 */

function decodeMulti(s) {
  let out = s;
  for (let i = 0; i < 3; i++) {
    try {
      const dec = decodeURIComponent(out);
      if (dec === out) break;
      out = dec;
    } catch { break; }
  }
  return out;
}

function stripTrackers(u) {
  let url;
  try { url = new URL(u); } catch { return u; }
  const junk = [
    'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
    'fbclid','gclid','igshid','mc_cid','mc_eid'
  ];
  junk.forEach(k => url.searchParams.delete(k));
  return url.toString();
}

function unwrapBing(urlStr) {
  let url;
  try { url = new URL(urlStr); } catch { return urlStr; }
  const host = url.hostname.toLowerCase();
  if (!host.endsWith('bing.com')) return urlStr;

  const candidates = ['u','url','r','ru','to','target'];
  for (const [k, v] of url.searchParams.entries()) {
    if (candidates.includes(k.toLowerCase()) && v) {
      return stripTrackers(decodeMulti(v));
    }
  }
  return urlStr; // fallback; caller may try network follow if desired
}

function unwrapRedirect(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.hostname.toLowerCase().endsWith('bing.com')) {
      return unwrapBing(urlStr);
    }
    return stripTrackers(urlStr);
  } catch {
    return urlStr;
  }
}

// Dual export for browser and Node.js compatibility
if (typeof window !== 'undefined') {
  window.URLUnwrapper = { unwrapRedirect, unwrapBing, stripTrackers, decodeMulti };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { unwrapRedirect, unwrapBing, stripTrackers, decodeMulti };
}
