// Tooltip UI for displaying claim scores

const Tooltip = {
  currentTooltip: null,
  
  /**
   * Show tooltip for a claim
   * @param {object} claimData - Claim data including scores
   * @param {HTMLElement} element - Element to attach tooltip to
   */
  show(claimData, element) {
    try {
      // Remove existing tooltip
      this.hide();
      
      // Create tooltip element
      const tooltip = this.create(claimData);
      
      // Position tooltip near element
      this.position(tooltip, element);
      
      // Add to DOM
      document.body.appendChild(tooltip);
      
      // Store reference
      this.currentTooltip = tooltip;
      
      // Add event listeners for hiding
      this.addHideListeners(tooltip, element);
      
      Logger.debug(`Tooltip shown for claim ${claimData.id}`);
    } catch (error) {
      Logger.error('Failed to show tooltip:', error);
    }
  },
  
  /**
   * Hide current tooltip
   */
  hide() {
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
  },
  
  /**
   * Create tooltip element
   * @param {object} claimData - Claim data
   * @returns {HTMLElement} Tooltip element
   */
  create(claimData) {
    const tooltip = document.createElement('div');
    tooltip.className = 'moneo-tooltip';
    tooltip.id = 'moneo-tooltip';
    
    // Determine trust level
    const trustLevel = this.getTrustLevel(claimData.trustScore);
    const trustColor = this.getTrustColor(claimData.trustScore);
    
    // Format classification
    const classificationLabel = this.formatClassification(claimData.classification);
    
    // Build tooltip HTML
    tooltip.innerHTML = `
      <div class="moneo-tooltip-header" style="background-color: ${trustColor}">
        <div class="moneo-tooltip-title">
          📊 Trust Score: ${claimData.trustScore.toFixed(1)}/10
        </div>
        <div class="moneo-tooltip-level">${trustLevel}</div>
      </div>
      <div class="moneo-tooltip-body">
        <div class="moneo-tooltip-section">
          <div class="moneo-tooltip-label">Classification:</div>
          <div class="moneo-tooltip-value">${classificationLabel}</div>
        </div>
        <div class="moneo-tooltip-section">
          <div class="moneo-tooltip-label">Score Breakdown:</div>
          <div class="moneo-tooltip-scores">
            ${this.createScoreBar('AI Rating', claimData.scores.aiRating)}
            ${this.createScoreBar('Tone Analysis', claimData.scores.toneAnalysis)}
            ${claimData.classification === 'empirical_fact' ? 
              this.createScoreBar('Scholarly Match', claimData.scores.scholarlyMatch) : ''}
            ${this.createScoreBar('Web Reinforced', claimData.scores.webReinforced)}
          </div>
        </div>
        <div class="moneo-tooltip-claim">
          <div class="moneo-tooltip-label">Claim:</div>
          <div class="moneo-tooltip-text">"${this.truncate(claimData.claim, 150)}"</div>
        </div>
        ${claimData.note ? `
        <div class="moneo-tooltip-note">
          <div class="moneo-tooltip-label">Note:</div>
          <div class="moneo-tooltip-text">${claimData.note}</div>
        </div>
        ` : ''}
      </div>
    `;
    
    return tooltip;
  },
  
  /**
   * Create score bar HTML
   * @param {string} label - Score label
   * @param {number|string} score - Score value (0-10) or "n/a"
   * @returns {string} HTML for score bar
   */
  createScoreBar(label, score) {
    // Handle n/a values (string or null/undefined)
    if (score === null || score === undefined || score === 'n/a') {
      return `
        <div class="moneo-score-item">
          <div class="moneo-score-label">${label}:</div>
          <div class="moneo-score-bar-container">
            <div class="moneo-score-bar" style="width: 0%; background-color: #9ca3af"></div>
          </div>
          <div class="moneo-score-value">n/a</div>
        </div>
      `;
    }
    
    const percentage = (score / 10) * 100;
    const color = this.getScoreColor(score);
    
    return `
      <div class="moneo-score-item">
        <div class="moneo-score-label">${label}:</div>
        <div class="moneo-score-bar-container">
          <div class="moneo-score-bar" style="width: ${percentage}%; background-color: ${color}"></div>
        </div>
        <div class="moneo-score-value">${score.toFixed(1)}/10</div>
      </div>
    `;
  },
  
  /**
   * Position tooltip near element
   * @param {HTMLElement} tooltip - Tooltip element
   * @param {HTMLElement} element - Target element
   */
  position(tooltip, element) {
    const rect = element.getBoundingClientRect();
    const tooltipHeight = 350; // Approximate height
    const tooltipWidth = 320;
    
    // Calculate position
    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;
    
    // Adjust if tooltip goes off screen
    if (top + tooltipHeight > window.innerHeight + window.scrollY) {
      // Position above element instead
      top = rect.top + window.scrollY - tooltipHeight - 10;
    }
    
    if (left + tooltipWidth > window.innerWidth + window.scrollX) {
      // Align to right edge
      left = window.innerWidth + window.scrollX - tooltipWidth - 10;
    }
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  },
  
  /**
   * Add event listeners to hide tooltip
   * @param {HTMLElement} tooltip - Tooltip element
   * @param {HTMLElement} element - Target element
   */
  addHideListeners(tooltip, element) {
    // Hide on mouse leave from both tooltip and element
    const hideHandler = (e) => {
      // Check if mouse moved to tooltip or back to element
      if (!tooltip.contains(e.relatedTarget) && !element.contains(e.relatedTarget)) {
        this.hide();
      }
    };
    
    element.addEventListener('mouseleave', hideHandler);
    tooltip.addEventListener('mouseleave', hideHandler);
    
    // Hide on scroll
    const scrollHandler = () => this.hide();
    window.addEventListener('scroll', scrollHandler, { once: true });
  },
  
  /**
   * Get trust level label
   * @param {number} score - Trust score
   * @returns {string} Trust level label
   */
  getTrustLevel(score) {
    if (score >= 7) return 'High Trust';
    if (score >= 3) return 'Medium Trust';
    return 'Low Trust';
  },
  
  /**
   * Get trust level color
   * @param {number} score - Trust score
   * @returns {string} Color hex code
   */
  getTrustColor(score) {
    if (score >= 7) return CONFIG.colors.high;
    if (score >= 3) return CONFIG.colors.medium;
    return CONFIG.colors.low;
  },
  
  /**
   * Get score bar color
   * @param {number} score - Score value
   * @returns {string} Color hex code
   */
  getScoreColor(score) {
    if (score >= 7) return CONFIG.colors.high;
    if (score >= 4) return CONFIG.colors.medium;
    return CONFIG.colors.low;
  },
  
  /**
   * Format classification for display
   * @param {string} classification - Classification value
   * @returns {string} Formatted label
   */
  formatClassification(classification) {
    const labels = {
      'current_news': '📰 Current News',
      'general_knowledge': '📚 General Knowledge',
      'empirical_fact': '🔬 Empirical Fact'
    };
    
    return labels[classification] || classification;
  },
  
  /**
   * Truncate text to length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Tooltip;
}

