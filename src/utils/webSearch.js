/**
 * Web Search Utilities
 * High-level wrapper for web and academic search functionality
 * Routes requests to specific scrapers and returns consistent format
 * 
 * All searches use free, no-auth endpoints (DuckDuckGo, Google Scholar, etc.)
 * Returns consistent format: [{url, title, snippet, domain}, ...]
 */

// Import biasResolver (uses global scope in browser extension context)
var BiasResolver = (typeof module !== 'undefined' && module.exports) 
  ? require('./biasResolver')  // Node.js
  : window.BiasResolver;        // Browser (from window global)

// Debug logging
console.log('WebSearch: BiasResolver available?', !!BiasResolver);
if (BiasResolver) {
  console.log('WebSearch: BiasResolver.classify available?', typeof BiasResolver.classify === 'function');
}

const WebSearch = {
  /**
   * Search general web sources
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum results to return (default 10)
   * @returns {Promise<Array>} Array of {url, title, snippet, domain}
   */
  async searchWeb(query, maxResults = 10) {
    if (!query || query.trim().length === 0) {
      return [];
    }
    
    try {
      Logger.log(`Web search: "${query.substring(0, 50)}..."`);
      
      // Use WebScraper to query DuckDuckGo/Bing
      const results = await WebScraper.search(query, maxResults);
      
      Logger.log(`Web search returned ${results.length} results`);
      
      // Debug: log first few results to see what domains we're getting
      if (results.length > 0) {
        Logger.log('First 3 search results:');
        results.slice(0, 3).forEach((result, i) => {
          Logger.log(`  ${i+1}. ${result.domain} - ${result.title.substring(0, 50)}...`);
        });
      }
      
      return results;
      
    } catch (error) {
      Logger.error('searchWeb failed:', error);
      return [];
    }
  },
  
  /**
   * Search academic/scholarly sources
   * @param {string} query - Search query (academic terms)
   * @param {number} maxResults - Maximum results to return (default 20)
   * @returns {Promise<Array>} Array of {url, title, snippet, domain}
   */
  async searchScholar(query, maxResults = 20) {
    if (!query || query.trim().length === 0) {
      return [];
    }
    
    try {
      Logger.log(`Scholar search: "${query.substring(0, 50)}..."`);
      
      // Use ScholarScraper to query Google Scholar/academic sources
      const results = await ScholarScraper.search(query, maxResults);
      
      Logger.log(`Scholar search returned ${results.length} results`);
      return results;
      
    } catch (error) {
      Logger.error('searchScholar failed:', error);
      return [];
    }
  },
  
  /**
   * Extract domain from URL
   * @param {string} url - Full URL
   * @returns {string} Domain name only (e.g., "bbc.com")
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      // Remove www. prefix
      return hostname.replace(/^www\./, '');
    } catch (error) {
      return '';
    }
  },
  
  /**
   * Count unique source domains for a query
   * @param {string} query - Search query
   * @param {string} excludeDomain - Domain to exclude (optional, e.g., original article)
   * @returns {Promise<number>} Number of unique domains found
   */
  async countSourceOccurrences(query, excludeDomain = '') {
    try {
      const results = await this.searchWeb(query, 15);
      
      // Extract unique domains (excluding specified domain)
      const domains = new Set();
      
      for (const result of results) {
        const domain = result.domain.toLowerCase();
        const excludeLower = excludeDomain.toLowerCase();
        
        // Skip excluded domain
        if (excludeLower && domain.includes(excludeLower)) {
          continue;
        }
        
        domains.add(domain);
      }
      
      return domains.size;
      
    } catch (error) {
      Logger.error('countSourceOccurrences failed:', error);
      return 0;
    }
  },
  
  /**
   * Analyze source spectrum for political diversity
   * Used by webScorer.js to assess cross-spectrum verification
   * @param {string} claim - Claim to search for
   * @param {string} excludeDomain - Domain to exclude (optional)
   * @returns {Promise<Object>} {total, left, center, right, unknown}
   */
  async analyzeSourceSpectrum(claim, excludeDomain = '') {
    try {
      // Search for claim
      const results = await this.searchWeb(claim, 15);
      
      // Filter out excluded domain
      const filteredResults = results.filter(result => {
        if (!excludeDomain) return true;
        const domain = result.domain.toLowerCase();
        const excludeLower = excludeDomain.toLowerCase();
        return !domain.includes(excludeLower);
      });
      
      // Analyze bias spectrum using centralized resolver
      const analysis = {
        total: filteredResults.length,
        left: 0,
        center: 0,
        right: 0,
        unknown: 0
      };
      
      // Categorize each result using bias resolver
      Logger.log(`Analyzing ${filteredResults.length} sources for bias classification...`);
      for (const result of filteredResults) {
        // Check if BiasResolver is available
        if (!BiasResolver || typeof BiasResolver.classify !== 'function') {
          Logger.warn('BiasResolver not available, all sources marked as unknown');
          analysis.unknown++;
          continue;
        }
        
        // Log the domain we're trying to classify
        Logger.log(`Classifying domain: "${result.domain}"`);
        const b = BiasResolver.classify(result.domain);
        Logger.log(`Domain "${result.domain}" → ${b}`);
        
        if (b === 'left') {
          analysis.left++;
        } else if (b === 'center') {
          analysis.center++;
        } else if (b === 'right') {
          analysis.right++;
        } else {
          analysis.unknown++;
        }
      }
      
      Logger.log(`Source spectrum: L:${analysis.left} C:${analysis.center} R:${analysis.right} U:${analysis.unknown}`);
      
      // Return both analysis and actual results for bibliography
      return {
        analysis: analysis,
        results: filteredResults
      };
      
    } catch (error) {
      Logger.error('analyzeSourceSpectrum failed:', error);
      return { 
        analysis: { total: 0, left: 0, center: 0, right: 0, unknown: 0 },
        results: []
      };
    }
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSearch;
}
  