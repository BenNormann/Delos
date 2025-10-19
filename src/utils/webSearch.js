/**
 * Web Search Utilities
 * High-level wrapper for web and academic search functionality
 * Routes requests to specific scrapers and returns consistent format
 * 
 * All searches use free, no-auth endpoints (DuckDuckGo, Google Scholar, etc.)
 * Returns consistent format: [{url, title, snippet, domain}, ...]
 */

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
      
      // Use webScorer's domain categorization
      const analysis = {
        total: filteredResults.length,
        left: 0,
        center: 0,
        right: 0,
        unknown: 0
      };
      
      // Import media bias data from webScorer.js
      const MEDIA_BIAS = {
        left: [
          'nytimes.com', 'washingtonpost.com', 'huffpost.com', 'huffingtonpost.com',
          'motherjones.com', 'buzzfeednews.com', 'theguardian.com', 'msnbc.com',
          'cnn.com', 'vox.com', 'slate.com', 'thedailybeast.com', 'thinkprogress.org',
          'npr.org', 'pbs.org', 'politico.com', 'theatlantic.com'
        ],
        center: [
          'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'c-span.org',
          'csmonitor.com', 'usatoday.com', 'axios.com', 'thehill.com',
          'bloomberg.com', 'marketwatch.com', 'economist.com', 'forbes.com',
          'time.com', 'newsweek.com', 'abcnews.go.com', 'cbsnews.com', 'nbcnews.com'
        ],
        right: [
          'foxnews.com', 'foxbusiness.com', 'wsj.com', 'nationalreview.com',
          'dailywire.com', 'breitbart.com', 'nypost.com', 'washingtontimes.com',
          'theblaze.com', 'oann.com', 'newsmax.com', 'dailycaller.com',
          'townhall.com', 'spectator.org', 'washingtonexaminer.com'
        ]
      };
      
      // Categorize each result
      for (const result of filteredResults) {
        const domain = result.domain.toLowerCase();
        let categorized = false;
        
        // Check left sources
        for (const leftDomain of MEDIA_BIAS.left) {
          if (domain.includes(leftDomain)) {
            analysis.left++;
            categorized = true;
            break;
          }
        }
        
        if (categorized) continue;
        
        // Check center sources
        for (const centerDomain of MEDIA_BIAS.center) {
          if (domain.includes(centerDomain)) {
            analysis.center++;
            categorized = true;
            break;
          }
        }
        
        if (categorized) continue;
        
        // Check right sources
        for (const rightDomain of MEDIA_BIAS.right) {
          if (domain.includes(rightDomain)) {
            analysis.right++;
            categorized = true;
            break;
          }
        }
        
        if (!categorized) {
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
  