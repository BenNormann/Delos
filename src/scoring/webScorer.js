/**
 * Web Reinforcement Scorer
 * Searches web for claim corroboration across independent sources
 * Rewards cross-spectrum verification (left, center, right sources)
 * Always returns 0-10 (never "n/a")
 */

// Media bias classifications based on AllSides and Media Bias/Fact Check
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

const WebScorer = {
  /**
   * Categorize a domain by political lean
   * @param {string} domain - Domain name
   * @returns {string} 'left', 'center', 'right', or 'unknown'
   */
  categorizeDomain(domain) {
    const normalized = domain.toLowerCase().replace(/^www\./, '');
    
    for (const [bias, domains] of Object.entries(MEDIA_BIAS)) {
      if (domains.some(d => normalized.includes(d))) {
        return bias;
      }
    }
    
    return 'unknown';
  },
  
  /**
   * Score a claim based on web source reinforcement with cross-spectrum analysis
   * @param {string} claim - The claim to verify
   * @param {string} classification - Claim classification
   * @param {string} [excludeDomain] - Domain to exclude (original article)
   * @returns {Promise<{score: number, sources: Array}>} Score 0-10 and array of sources
   */
  async score(claim, classification, excludeDomain = '') {
    // Check cache
    const cacheKey = Cache.generateKey(claim, 'web-reinforcement', classification);
    const cached = await Cache.get(cacheKey);
    
    if (cached !== null) {
      Logger.log('Using cached web reinforcement score');
      // Return cached score with empty sources (we don't cache sources)
      return { score: cached, sources: [] };
    }
    
    try {
      // Get detailed source analysis
      Logger.log(`Web scoring claim: "${claim.substring(0, 60)}..."`);
      const sourceAnalysisWithResults = await WebSearch.analyzeSourceSpectrum(claim, excludeDomain);
      
      // Calculate score based on source count and political diversity
      const scoreValue = this.calculateScore(sourceAnalysisWithResults.analysis);
      
      Logger.log(`Web score: ${scoreValue} (${sourceAnalysisWithResults.analysis.total} sources: L:${sourceAnalysisWithResults.analysis.left} C:${sourceAnalysisWithResults.analysis.center} R:${sourceAnalysisWithResults.analysis.right})`);
      
      // Cache just the score
      await Cache.set(cacheKey, scoreValue, 86400);
      
      return {
        score: scoreValue,
        sources: sourceAnalysisWithResults.results || []
      };
    } catch (error) {
      Logger.error('Web scoring failed:', error);
      return { score: 0, sources: [] };
    }
  },
  
  /**
   * Calculate score based on source count and political diversity
   * Rewards cross-spectrum verification (claims verified by left+center+right sources)
   * @param {Object} analysis - Source analysis {total, left, center, right, unknown}
   * @returns {number} Score 0-10
   */
  calculateScore(analysis) {
    const { total, left, center, right } = analysis;
    
    if (total === 0) {
      return 0;
    }
    
    // Base score from source count (0-7)
    let baseScore = 0;
    if (total <= 2) {
      baseScore = 2;
    } else if (total <= 5) {
      baseScore = 4;
    } else if (total <= 8) {
      baseScore = 6;
    } else {
      baseScore = 7;
    }
    
    // Diversity bonus (0-3 points) - rewards cross-spectrum verification
    let diversityBonus = 0;
    const hasLeft = left > 0;
    const hasCenter = center > 0;
    const hasRight = right > 0;
    
    // Count how many political categories are represented
    const spectrumCoverage = [hasLeft, hasCenter, hasRight].filter(Boolean).length;
    
    if (spectrumCoverage === 3) {
      // Full spectrum coverage = max bonus (best credibility)
      diversityBonus = 3;
    } else if (spectrumCoverage === 2) {
      // Two categories = moderate bonus
      diversityBonus = 1.5;
    } else if (spectrumCoverage === 1) {
      // Single category = minimal bonus (potential echo chamber)
      diversityBonus = 0.5;
    }
    
    // Total score capped at 10
    const finalScore = Math.min(baseScore + diversityBonus, 10);
    
    return Math.round(finalScore * 10) / 10; // Round to 1 decimal
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebScorer;
}
