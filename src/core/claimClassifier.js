// Classify claims into categories

const ClaimClassifier = {
  /**
   * Classify claims into categories
   * @param {Array<{id: string, claim: string, source: string, context: string, position: object}>} claims
   * @returns {Promise<Array<{...claim, classification: string}>>}
   */
  async classify(claims) {
    try {
      Logger.time('Claim classification');
      Logger.info(`Classifying ${claims.length} claims...`);
      
      if (!claims || claims.length === 0) {
        Logger.warn('No claims to classify');
        return [];
      }
      
      // Check cache first
      const cachedResults = await this.checkCache(claims);
      const uncachedClaims = claims.filter((claim, idx) => !cachedResults[idx]);
      
      Logger.debug(`Cache hits: ${cachedResults.filter(Boolean).length}, Cache misses: ${uncachedClaims.length}`);
      
      if (uncachedClaims.length === 0) {
        // All results cached
        return claims.map((claim, idx) => ({
          ...claim,
          classification: cachedResults[idx]
        }));
      }
      
      // Classify uncached claims using OpenAI
      const systemPrompt = `You are a claim classification expert. Classify each claim into exactly one of these categories:

1. "current_news" - Recent events, breaking updates, time-sensitive information, ongoing situations
2. "general_knowledge" - Historical facts, established understanding, common knowledge
3. "empirical_fact" - Testable scientific claims, measurable data, research findings

Return your response as a JSON object with a "classifications" array containing objects with "id" (number) and "classification" (string) fields.`;
      
      const items = uncachedClaims.map((claim, idx) => ({
        id: claim.id,
        text: claim.claim
      }));
      
      const classifications = await API.retry(
        () => API.batchClassify(items, systemPrompt),
        3,
        2000
      );
      
      // Check if API key was not configured
      if (classifications === null) {
        Logger.warn('Classification skipped - no API key, using defaults');
        // Use default classification for all
        const defaultClassifications = uncachedClaims.map(claim => ({
          id: claim.id,
          classification: 'general_knowledge'
        }));
        
        // Merge cached and default results
        const results = claims.map((claim, idx) => ({
          ...claim,
          classification: cachedResults[idx] || 'general_knowledge'
        }));
        
        return results;
      }
      
      // Cache new classifications
      await this.cacheClassifications(uncachedClaims, classifications);
      
      // Merge cached and new results
      let newIdx = 0;
      const results = claims.map((claim, idx) => {
        let classification;
        
        if (cachedResults[idx]) {
          classification = cachedResults[idx];
        } else {
          const match = classifications.find(c => c.id === claim.id);
          classification = match?.classification || 'general_knowledge';
          newIdx++;
        }
        
        return {
          ...claim,
          classification: this.validateClassification(classification)
        };
      });
      
      Logger.info('Classification complete');
      Logger.timeEnd('Claim classification');
      
      return results;
    } catch (error) {
      Logger.error('Claim classification failed:', error);
      
      // Return claims with default classification
      return claims.map(claim => ({
        ...claim,
        classification: 'general_knowledge'
      }));
    }
  },
  
  /**
   * Check cache for existing classifications
   * @param {Array<object>} claims - Claims to check
   * @returns {Promise<Array<string|null>>} Array of cached classifications or null
   */
  async checkCache(claims) {
    const results = [];
    
    for (const claim of claims) {
      const cacheKey = Cache.generateKey(claim.claim, 'classification');
      const cached = await Cache.get(cacheKey);
      results.push(cached);
    }
    
    return results;
  },
  
  /**
   * Cache classifications
   * @param {Array<object>} claims - Claims that were classified
   * @param {Array<object>} classifications - Classification results
   * @returns {Promise<void>}
   */
  async cacheClassifications(claims, classifications) {
    for (const claim of claims) {
      const match = classifications.find(c => c.id === claim.id);
      if (match) {
        const cacheKey = Cache.generateKey(claim.claim, 'classification');
        await Cache.set(cacheKey, match.classification, CONFIG.cache.ttl);
      }
    }
  },
  
  /**
   * Validate classification value
   * @param {string} classification - Classification to validate
   * @returns {string} Valid classification
   */
  validateClassification(classification) {
    const valid = ['current_news', 'general_knowledge', 'empirical_fact'];
    
    if (valid.includes(classification)) {
      return classification;
    }
    
    Logger.warn(`Invalid classification: ${classification}, defaulting to general_knowledge`);
    return 'general_knowledge';
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClaimClassifier;
}

