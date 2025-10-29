/**
 * Bias Resolver - Single source of truth for domain political bias classification
 * Centralized mapping of domains to political lean (left/center/right)
 * Uses exact host + parent-domain matching to avoid false positives
 */

// Default map: core domains for offline use
// Aggregated from previous hardcoded lists across webScorer.js, webSearch.js, highlighter.js
const DEFAULT_MAP = {
  // LEFT-LEANING
  "cnn.com": "left",
  "nytimes.com": "left",
  "washingtonpost.com": "left",
  "huffpost.com": "left",
  "huffingtonpost.com": "left",
  "motherjones.com": "left",
  "buzzfeednews.com": "left",
  "theguardian.com": "left",
  "msnbc.com": "left",
  "vox.com": "left",
  "slate.com": "left",
  "thedailybeast.com": "left",
  "thinkprogress.org": "left",
  "npr.org": "left",
  "pbs.org": "left",
  "politico.com": "left",
  "theatlantic.com": "left",
  
  // CENTER
  "reuters.com": "center",
  "apnews.com": "center",
  "bbc.com": "center",
  "bbc.co.uk": "center",
  "c-span.org": "center",
  "csmonitor.com": "center",
  "usatoday.com": "center",
  "axios.com": "center",
  "thehill.com": "center",
  "bloomberg.com": "center",
  "marketwatch.com": "center",
  "economist.com": "center",
  "forbes.com": "center",
  "time.com": "center",
  "newsweek.com": "center",
  "abcnews.go.com": "center",
  "cbsnews.com": "center",
  "nbcnews.com": "center",
  
  // RIGHT-LEANING
  "foxnews.com": "right",
  "foxbusiness.com": "right",
  "wsj.com": "right",
  "nationalreview.com": "right",
  "dailywire.com": "right",
  "breitbart.com": "right",
  "nypost.com": "right",
  "washingtontimes.com": "right",
  "theblaze.com": "right",
  "oann.com": "right",
  "newsmax.com": "right",
  "dailycaller.com": "right",
  "townhall.com": "right",
  "spectator.org": "right",
  "washingtonexaminer.com": "right"
};

// Active map (can be updated via loadSnapshot)
let MAP = new Map(Object.entries(DEFAULT_MAP));

/**
 * Normalize hostname from domain or URL
 * Handles URLs, subdomains, and strips common prefixes
 * @param {string} x - Domain or URL
 * @returns {string} Normalized hostname
 */
function normHost(x) {
  try {
    const h = new URL(x.startsWith('http') ? x : `https://${x}`).hostname;
    return h.replace(/^www\./i, '').replace(/^m\./i, '').toLowerCase();
  } catch {
    return String(x).replace(/^www\./i, '').replace(/^m\./i, '').toLowerCase();
  }
}

/**
 * Extract parent domain (e.g., "edition.cnn.com" -> "cnn.com")
 * @param {string} h - Hostname
 * @returns {string} Parent domain
 */
function parent(h) {
  const p = h.split('.');
  return p.length >= 2 ? p.slice(-2).join('.') : h;
}

/**
 * Classify domain by political bias
 * Uses exact host matching first, then parent domain matching
 * @param {string} x - Domain or URL
 * @returns {string} 'left', 'center', 'right', or 'unknown'
 */
function classify(x) {
  const h = normHost(x);
  const root = parent(h);
  
  // Try exact match first (e.g., "edition.cnn.com")
  const rec = MAP.get(h) || MAP.get(root);
  
  return rec || 'unknown';
}

/**
 * Load a larger bias map from remote JSON (optional, non-blocking)
 * Caches to localStorage for offline use
 * @param {string} url - URL to JSON file with bias mappings
 * @returns {Promise<void>}
 */
async function loadSnapshot(url) {
  try {
    const r = await fetch(url, { cache: 'reload' });
    if (!r.ok) return;
    const json = await r.json(); // Expected format: { "domain": "bias", ... }
    MAP = new Map(Object.entries(json));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('biasSnapshot', JSON.stringify(json));
    }
  } catch {
    // Fallback to cached snapshot
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem('biasSnapshot');
      if (cached) MAP = new Map(Object.entries(JSON.parse(cached)));
    }
  }
}

// Export for use in modules and browser extensions
// Export to window FIRST so other scripts can use it
if (typeof window !== 'undefined') {
  window.BiasResolver = { classify, loadSnapshot };
  console.log('BiasResolver loaded and exported to window');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classify, loadSnapshot };
}

