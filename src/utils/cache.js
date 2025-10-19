/**
 * Simple in-memory cache for API/search results
 * Stores data with TTL (time-to-live) expiration
 */

const Cache = {
  // In-memory cache storage
  cache: {},
  
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any | null>} Cached value or null if not found/expired
   */
  async get(key) {
    const entry = this.cache[key];
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      delete this.cache[key];
      return null;
    }
    
    return entry.value;
  },
  
  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} [ttlSeconds=86400] - Time to live in seconds (default: 24 hours)
   * @returns {Promise<void>}
   */
  async set(key, value, ttlSeconds = 86400) {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    
    this.cache[key] = {
      value,
      expiresAt
    };
  },
  
  /**
   * Clear all cache entries
   * @returns {Promise<void>}
   */
  async clear() {
    Object.keys(this.cache).forEach(key => delete this.cache[key]);
  },
  
  /**
   * Generate cache key from claim data
   * @param {string} claim - The claim text
   * @param {string} type - Type of score (e.g., 'ai-credibility', 'scholar', 'web')
   * @param {string} [classification] - Optional classification for context
   * @returns {string} Cache key
   */
  generateKey(claim, type, classification = '') {
    return `${type}:${classification}:${claim}`.toLowerCase();
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Cache;
}
