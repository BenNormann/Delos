/**
 * Extract factual claims from article text
 * Based on argumentation mining and check-worthiness detection research
 * 
 * Key principles:
 * 1. Propositional content: Must express a complete, verifiable proposition
 * 2. Factuality markers: Contains verifiable information (numbers, entities, events)
 * 3. Semantic completeness: Has subject-verb-object structure
 * 4. Check-worthiness: Can be fact-checked against external sources
 * 5. Discourse coherence: Part of article's main narrative flow
 */

const ClaimExtractor = {
  /**
   * Extract claims from article text
   * @param {string} text - Raw article text
   * @returns {Promise<Array<{id: string, claim: string, source: string, context: string, position: {start: number, end: number}}>>}
   */
  async extract(text) {
    try {
      Logger.time('Claim extraction');
      Logger.info('Extracting claims from article...');
      
      if (!text || text.length === 0) {
        Logger.warn('No text provided for extraction');
        return [];
      }
      
      // Preprocess: Remove navigation/UI noise before sentence splitting
      text = this.removeNoiseElements(text);
      
      // Split text into sentences
      let sentences = this.splitIntoSentences(text);
      Logger.debug(`Found ${sentences.length} sentences`);
      
      // Merge multi-sentence quotes and attributions
      sentences = this.mergeQuotedContent(sentences);
      Logger.debug(`After merging quotes: ${sentences.length} segments`);
      
      const claims = [];
      let currentPos = 0;
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const sentenceStart = text.indexOf(sentence, currentPos);
        
        if (sentenceStart === -1) {
          currentPos += sentence.length;
          continue;
        }
        
        const sentenceEnd = sentenceStart + sentence.length;
        currentPos = sentenceEnd;
        
        // Check if sentence is a claim using linguistic rules
        if (this.isCheckWorthyClaim(sentence)) {
          const claim = {
            id: `claim_${claims.length + 1}`,
            claim: sentence.trim(),
            source: this.detectSource(sentence),
            context: this.getContext(sentences, i),
            position: {
              start: sentenceStart,
              end: sentenceEnd
            }
          };
          
          claims.push(claim);
          
          // Limit number of claims
          if (claims.length >= CONFIG.maxClaimsPerArticle) {
            Logger.warn(`Reached max claims limit (${CONFIG.maxClaimsPerArticle})`);
            break;
          }
        }
      }
      
      Logger.info(`Extracted ${claims.length} claims`);
      Logger.timeEnd('Claim extraction');
      
      return claims;
    } catch (error) {
      Logger.error('Claim extraction failed:', error);
      return [];
    }
  },
  
  /**
   * Remove navigation, UI elements, and other noise from text
   * @param {string} text - Raw text
   * @returns {string} Cleaned text
   */
  removeNoiseElements(text) {
    // Split into lines for better filtering
    const lines = text.split('\n');
    const cleanedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (line.length === 0) continue;
      
      // Skip single-word navigation/metadata
      if (line.split(/\s+/).length === 1 && line.length < 15) continue;
      
      // Skip timestamps and metadata
      if (/^\d+\s+(days?|hours?|mins?|weeks?|months?|years?)\s+ago$/i.test(line)) continue;
      if (/^Published\s+/i.test(line)) continue;
      if (/^\d{1,2}:\d{2}(am|pm|AM|PM)/i.test(line)) continue;
      
      // Skip social media/sharing buttons
      if (/^(Share|Save|Facebook|Twitter|Instagram|LinkedIn|Comments|Print|Email|Login|Watch TV|Podcasts|Video)$/i.test(line)) continue;
      
      // Skip navigation sections
      if (/^(Personal Finance|Economy|Markets|Watchlist|Lifestyle|Real Estate|Tech|Sports|Opinion|About)$/i.test(line)) continue;
      if (/^(More|Expand|Collapse|Menu)/i.test(line)) continue;
      
      // Skip image captions and credits
      if (/^(Getty Images|iStock|Fox News|FOXBusiness|By\s+[A-Z])/i.test(line)) continue;
      if (/\(iStock\)$/i.test(line)) continue;
      
      // Skip "Related" sections and what follows
      if (/^(Related|Trending|Popular|See Also|More From|More from the BBC)/i.test(line)) {
        break; // Stop processing - we've hit the end of article content
      }
      
      // Skip copyright and legal notices
      if (/©\s*20\d{2}/i.test(line)) continue;
      if (/All rights reserved/i.test(line)) continue;
      if (/Terms of Use|Privacy Policy|Legal Statement/i.test(line)) continue;
      if (/material may not be published/i.test(line)) continue;
      
      // Skip newsletter signup prompts
      if (/Sign up|Subscribe|Enter email|Get Our Newsletter/i.test(line) && line.length < 100) continue;
      
      // Skip "Quote Lookup" and similar UI elements
      if (/^(Quote Lookup|U\.S\. Stock Market|Quotes displayed)/i.test(line)) continue;
      
      cleanedLines.push(line);
    }
    
    let cleaned = cleanedLines.join('\n');
    
    // Remove specific UI patterns from the remaining text
    const noisePatterns = [
      /GET\s+[A-Z\s]+ON\s+THE\s+GO\s+BY\s+CLICKING\s+HERE/gi,
      /CLICK\s+HERE\s+[A-Z\s]*/gi,
      /\b(ADVERTISEMENT|SPONSORED CONTENT)\b/gi,
      /\b(SUBSCRIBE|SIGN UP|FOLLOW US|DOWNLOAD|READ MORE|LEARN MORE|WATCH|LISTEN)\s+[A-Z\s]{0,30}\b/gi,
      // Remove all-caps headlines that are likely navigation
      /^[A-Z\s]{20,}$/gm
    ];
    
    noisePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    return cleaned;
  },
  
  /**
   * Merge quoted content with attributions into complete claims
   * Handles: "Quote," attribution AND Attribution: "quote" AND "Multi. Sentence. Quote."
   * @param {Array<string>} sentences - Array of sentences
   * @returns {Array<string>} Merged sentences
   */
  mergeQuotedContent(sentences) {
    const merged = [];
    let i = 0;
    
    while (i < sentences.length) {
      const sentence = sentences[i];
      const lowerSent = sentence.toLowerCase();
      
      // Check for quotes
      const hasQuote = sentence.includes('"') || sentence.includes('"') || sentence.includes('"');
      
      if (hasQuote) {
        // Count quote marks
        const openQuotes = (sentence.match(/[""]/g) || []).length;
        const closeQuotes = (sentence.match(/[""]/g) || []).length;
        
        // Unbalanced quotes - merge with following sentences
        if (openQuotes > closeQuotes) {
          let mergedSentence = sentence;
          let j = i + 1;
          
          while (j < sentences.length && j - i < 4) { // Max 4 sentences in a quote
            mergedSentence += ' ' + sentences[j];
            const totalOpen = (mergedSentence.match(/[""]/g) || []).length;
            const totalClose = (mergedSentence.match(/[""]/g) || []).length;
            
            j++;
            if (totalOpen <= totalClose) break;
          }
          
          merged.push(mergedSentence.trim());
          i = j;
          continue;
        }
      }
      
      // Check for attribution at end: "Quote," person said.
      const endsWithAttribution = /[""]\s*,?\s*(he|she|they|it|[A-Z][a-z]+(\s+[A-Z][a-z]+)*)\s+(said|stated|told|explained|added|noted|continued|emphasized|reported|announced|claimed|argued|maintained|asserted|declared|revealed|disclosed)\b/i.test(sentence);
      
      if (endsWithAttribution && i + 1 < sentences.length) {
        const next = sentences[i + 1];
        // If next also has quotes (continuation), merge
        if (next.includes('"') || next.includes('"')) {
          merged.push((sentence + ' ' + next).trim());
          i += 2;
          continue;
        }
      }
      
      // Check if current sentence starts with quote and ends with attribution marker
      // And PREVIOUS sentence also had a quote from same speaker (continuation)
      const startsWithQuote = /^["""]/.test(sentence.trim());
      const hasAttributionEnd = /\b(he|she|they|it|[A-Z][a-z]+(\s+[A-Z][a-z]+)*)\s+(said|stated|told|explained|added|noted|continued|emphasized)\b[.!?]*$/i.test(sentence);
      
      if (startsWithQuote && hasAttributionEnd && merged.length > 0) {
        const lastMerged = merged[merged.length - 1];
        // Check if previous sentence had quotes
        if (lastMerged.includes('"') || lastMerged.includes('"') || lastMerged.includes('"')) {
          merged[merged.length - 1] = (lastMerged + ' ' + sentence).trim();
          i++;
          continue;
        }
      }
      
      // Check for attribution at start/middle leading to quote
      const hasLeadingAttribution = /(according to|[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(said|stated|told|explained|noted|emphasized|reported|announced|claimed)\b)/i.test(sentence);
      
      if (hasLeadingAttribution && !hasQuote && i + 1 < sentences.length) {
        const next = sentences[i + 1];
        if (next.trim().startsWith('"') || next.trim().startsWith('"')) {
          merged.push((sentence + ' ' + next).trim());
          i += 2;
          continue;
        }
      }
      
      // Check for sentence ending with colon (introducing quote/explanation)
      const endsWithColon = /:\s*$/.test(sentence);
      if (endsWithColon && i + 1 < sentences.length) {
        merged.push((sentence + ' ' + sentences[i + 1]).trim());
        i += 2;
        continue;
      }
      
      merged.push(sentence);
      i++;
    }
    
    return merged;
  },
  
  /**
   * Split text into sentences, preserving quoted content
   * @param {string} text - Text to split
   * @returns {Array<string>} Array of sentences
   */
  splitIntoSentences(text) {
    // Handle common abbreviations to avoid false splits
    let processed = text
      .replace(/Dr\./g, 'Dr')
      .replace(/Mr\./g, 'Mr')
      .replace(/Mrs\./g, 'Mrs')
      .replace(/Ms\./g, 'Ms')
      .replace(/Prof\./g, 'Prof')
      .replace(/Sr\./g, 'Sr')
      .replace(/Jr\./g, 'Jr')
      .replace(/U\.S\./g, 'US')
      .replace(/U\.K\./g, 'UK')
      .replace(/etc\./g, 'etc')
      .replace(/vs\./g, 'vs')
      .replace(/e\.g\./g, 'eg')
      .replace(/i\.e\./g, 'ie');
    
    // Split on newlines first to preserve paragraph boundaries
    const paragraphs = processed.split(/\n+/);
    const allSentences = [];
    
    for (const para of paragraphs) {
      if (para.trim().length === 0) continue;
      
      // Advanced sentence splitting that respects quotes
      const sentences = this.smartSplitSentences(para);
      allSentences.push(...sentences);
    }
    
    return allSentences.filter(s => s.trim().length > 20); // Filter out very short fragments
  },
  
  /**
   * Smart sentence splitting that respects quote boundaries
   * Don't split inside quotes - keep multi-sentence quotes together
   * @param {string} text - Text to split
   * @returns {Array<string>} Array of sentences
   */
  smartSplitSentences(text) {
    const sentences = [];
    let currentSentence = '';
    let inQuote = false;
    let quoteChar = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      currentSentence += char;
      
      // Track quote state
      if (char === '"' || char === '"') {
        if (!inQuote) {
          inQuote = true;
          quoteChar = char;
        } else if ((char === '"' && quoteChar === '"') || char === '"') {
          inQuote = false;
          quoteChar = '';
        }
      }
      
      // Check for sentence end (but not inside quotes)
      if (!inQuote && /[.!?]/.test(char)) {
        // Look ahead to see if this is truly a sentence boundary
        const nextChar = text[i + 1];
        const nextNextChar = text[i + 2];
        
        // If followed by space and capital letter, it's a sentence boundary
        if (nextChar === ' ' && nextNextChar && /[A-Z]/.test(nextNextChar)) {
          sentences.push(currentSentence.trim());
          currentSentence = '';
          i++; // Skip the space
        }
        // If at end of text, also a sentence
        else if (i === text.length - 1 || !nextChar) {
          sentences.push(currentSentence.trim());
          currentSentence = '';
        }
      }
    }
    
    // Push remaining text
    if (currentSentence.trim().length > 0) {
      sentences.push(currentSentence.trim());
    }
    
    return sentences;
  },
  
  /**
   * Check if sentence is a check-worthy claim using linguistic principles
   * Based on:
   * - Propositional content theory
   * - Semantic role labeling
   * - Argumentation mining research
   * - Fact-checking check-worthiness criteria
   * 
   * @param {string} sentence - Sentence to check
   * @returns {boolean} True if sentence is a check-worthy factual claim
   */
  isCheckWorthyClaim(sentence) {
    const trimmed = sentence.trim();
    const lower = trimmed.toLowerCase();
    
    // === STRUCTURAL REQUIREMENTS ===
    
    // 1. Minimum length for propositional content (relaxed from 30 to 25)
    if (trimmed.length < 25) {
      return false;
    }
    
    // 2. Must be declarative (not a question)
    if (trimmed.endsWith('?')) {
      return false;
    }
    
    // 3. Must contain a predicate (main verb) - essential for propositions
    // Extended to include action verbs and imperatives
    const hasMainVerb = /\b(is|are|was|were|be|been|being|has|have|had|will|would|can|could|may|might|must|shall|should|did|does|do|added|advised|advising|said|ruled|required|estimates|contain|lie|own|varies|depend|decide|sold|guaranteed)\b/i.test(trimmed);
    
    if (!hasMainVerb) {
      return false;
    }
    
    // === NOISE FILTERS ===
    
    // 4. Filter call-to-action and UI patterns
    const uiPatterns = [
      /^(click|tap|download|subscribe|read more|learn more|watch|listen|follow|join)\b/i,
      /\bclick here\b/i,
      /\bsign up\b/i,
      /^(related|trending|popular|advertisement):/i
    ];
    
    if (uiPatterns.some(p => p.test(lower))) {
      return false;
    }
    
    // === SUBJECTIVITY FILTERS ===
    
    // 6. Filter subjective/opinion statements (not verifiable)
    // But be more lenient - only filter strong subjectivity
    const subjectiveMarkers = [
      /\b(i think|i believe|i feel|in my opinion|personally)\b/i,
      /\b(beautiful|ugly|amazing|terrible)\b/i // evaluative adjectives (removed "good|bad|best|worst" as these can be factual)
    ];
    
    if (subjectiveMarkers.some(p => p.test(lower))) {
      return false;
    }
    
    // === CHECK-WORTHINESS INDICATORS ===
    // A claim needs multiple indicators to be worth fact-checking
    
    let score = 0;
    
    // 7. CAUSAL RELATIONS (X causes Y, X leads to Y)
    const causalMarkers = /\b(cause[ds]?|causing|lead[s]?|led|leading to|result[s]?|resulted in|resulting in|contribute[ds]?|trigger[s]?|produce[ds]?|induce[ds]?|create[ds]?)\b/i;
    if (causalMarkers.test(trimmed)) score += 2; // High value
    
    // 8. EPISTEMIC VERBS (reporting findings/knowledge)
    const epistemicVerbs = /\b(conclude[ds]?|determined?|found|discover[eds]?|reveal[s]?|revealed|show[s]?|showed|shown|demonstrate[ds]?|indicate[ds]?|suggest[s]?|confirm[s]?|establish[es]?|prove[ds]?|proven)\b/i;
    if (epistemicVerbs.test(trimmed)) score += 2;
    
    // 9. GOVERNMENT/OFFICIAL ACTIONS (decisions, advisories, rulings)
    const officialActions = /\b(ruled|decided|decide|approved|required|advised|advising|recommended|warned|alert|recall|added|issued|initiated|granted|granting)\b/i;
    if (officialActions.test(trimmed)) score += 2;
    
    // 10. QUANTIFICATION (specific numbers are verifiable)
    const hasNumber = /\d+/.test(trimmed);
    const hasMeasurement = /\d+\s*(million|billion|thousand|hundred|percent|%|times|fold|degrees|years?|months?|days?|hours?|miles?|barrels?)\b/i.test(trimmed);
    if (hasMeasurement) score += 2;
    else if (hasNumber) score += 1;
    
    // 11. NAMED ENTITIES (specific people/organizations/places)
    const namedEntities = /\b([A-Z][a-z]+\s+){1,3}[A-Z][a-z]+\b/.test(trimmed) || // John Smith, Federal Reserve
                         /\b(FDA|CDC|WHO|EPA|FBI|CIA|NASA|UN|EU|UK|US|NATO|Equinor|Rosebank|Shetland|Supreme Court)\b/.test(trimmed);
    if (namedEntities) score += 1;
    
    // 12. TEMPORAL SPECIFICITY (specific times are verifiable)
    const temporal = /(19|20)\d{2}/.test(trimmed) || // Years
                    /\b(yesterday|today|last week|last month|last year|last fall|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(trimmed);
    if (temporal) score += 1;
    
    // 13. ATTRIBUTION/QUOTATION (claims from sources)
    const attribution = /\b(according to|said|stated|told|explained|reported|announced|claimed)\b/i.test(trimmed);
    const hasQuote = /["""]/.test(trimmed);
    if (attribution || hasQuote) score += 1.5; // Increased from 1 to 1.5 for quotes
    
    // 14. COMPARATIVE/SUPERLATIVE (measurable comparisons)
    const comparative = /\b(more|less|higher|lower|greater|smaller|better|worse|increased|decreased|than|compared to|relative to|most|least|highest|lowest|largest|smallest)\b/i.test(trimmed);
    if (comparative) score += 1;
    
    // 15. MODAL VERBS indicating potential/possibility (less certain but still check-worthy)
    const modals = /\b(can|could|may|might|must|should|would|will)\b/i.test(trimmed);
    if (modals) score += 0.5;
    
    // 16. NEGATIVE/LIMITING STATEMENTS (not, unlikely, no, without)
    const negation = /\b(not|no|without|unlikely|wouldn't|won't|hasn't|haven't|didn't|not guaranteed)\b/i.test(trimmed);
    if (negation) score += 0.5;
    
    // 17. CONDITIONAL/VARIABILITY STATEMENTS (varies, depends, factors)
    const variability = /\b(varies|depend[s]?|depending|factor[s]?|influenced by|affected by)\b/i.test(trimmed);
    if (variability) score += 1;
    
    // 18. CONSEQUENCE/IMPACT STATEMENTS (impact, effect, consequence)
    const consequence = /\b(impact|effect[s]?|consequence[s]?|implication[s]?)\b/i.test(trimmed);
    if (consequence) score += 0.5;
    
    // === SCORING THRESHOLD ===
    // Lowered threshold from 3 to 2.5 to catch more legitimate claims
    // This helps catch: "The FDA is advising consumers to throw away..."
    // (official action=2 + named entity=1 = 3 points ✓)
    // And: "Exposures to different sources of lead and someone's age are also factors"
    // (named entity=1 + causal concept=1 + negation/qualifier=0.5 = would still need work...)
    
    return score >= 2.5;
  },
  
  /**
   * Detect if claim is direct or quoted
   * @param {string} sentence - Sentence to analyze
   * @returns {string} "direct" or "quote"
   */
  detectSource(sentence) {
    // Check for quotation marks
    const hasQuotes = sentence.includes('"') || sentence.includes('"') || sentence.includes('"');
    
    // Check for attribution patterns
    const attributionPatterns = [
      /according to/i,
      /said that/i,
      /stated that/i,
      /claimed that/i,
      /reported that/i,
      /announced that/i
    ];
    
    const hasAttribution = attributionPatterns.some(pattern => pattern.test(sentence));
    
    return (hasQuotes || hasAttribution) ? 'quote' : 'direct';
  },
  
  /**
   * Get surrounding context for a sentence
   * @param {Array<string>} sentences - All sentences
   * @param {number} index - Index of current sentence
   * @returns {string} Context string
   */
  getContext(sentences, index) {
    const before = index > 0 ? sentences[index - 1] : '';
    const after = index < sentences.length - 1 ? sentences[index + 1] : '';
    
    return `${before} ${sentences[index]} ${after}`.trim();
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClaimExtractor;
}

