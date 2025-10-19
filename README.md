# TruthCheck Browser Extension

A fact-checking browser extension that analyzes and scores claims in news articles using AI, scholarly sources, and web reinforcement.

## Features

- **Automatic Claim Extraction**: Identifies factual claims in news articles
- **AI-Powered Classification**: Categorizes claims as current news, general knowledge, or empirical facts
- **Multi-Dimensional Scoring**: Evaluates claims using 4 dimensions:
  - AI Credibility Rating
  - Tone Analysis (bias detection)
  - Scholarly Match (academic sources)
  - Web Reinforcement (cross-referencing)
- **Visual Highlighting**: Color-coded highlights based on trust scores
  - 🟢 Green: High trust (≥7/10)
  - 🟡 Yellow: Medium trust (3-7/10)
  - 🔴 Red: Low trust (<3/10)
- **Interactive Tooltips**: Detailed score breakdowns on hover

## Installation

### Prerequisites

- Chrome or Chromium-based browser (Edge, Brave, etc.)
- OpenAI API key (for AI scoring)

### Setup Instructions

1. **Clone or download this repository**

2. **Set up your OpenAI API key**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select this extension directory
   - Open the browser console on any news site
   - Run: 
     ```javascript
     chrome.storage.local.set({ openai_api_key: 'your-api-key-here' })
     ```

3. **Load the extension**:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory
   - The extension icon should appear in your toolbar

4. **Add icons** (if not already present):
   - Place icon files (16x16, 32x32, 48x48, 128x128 PNG) in the `icons/` directory

## Usage

1. **Visit a supported news site**:
   - New York Times, Washington Post, The Guardian, BBC, CNN, etc.
   - Or any article page (the extension will attempt to find article content)

2. **Wait for analysis**:
   - The extension automatically runs when the page loads
   - Processing time: 10-30 seconds depending on article length
   - Check browser console for progress (press F12)

3. **View results**:
   - Claims are highlighted in the article text
   - Hover over any highlight to see detailed scores
   - Colors indicate trust level

## Architecture

```
src/
├── content.js              # Main orchestration script
├── background.js           # Service worker
├── config.js              # Configuration constants
├── core/                  # Core pipeline modules
│   ├── claimExtractor.js  # Extract claims from text
│   ├── claimClassifier.js # Classify claim types
│   └── claimScorer.js     # Calculate trust scores
├── scoring/               # Scoring modules
│   ├── aiScorer.js        # AI credibility + tone
│   ├── scholarScorer.js   # Academic source matching
│   └── webScorer.js       # Web reinforcement
├── ui/                    # UI components
│   ├── highlighter.js     # DOM highlighting
│   └── tooltip.js         # Tooltip display
└── utils/                 # Utility modules
    ├── api.js             # OpenAI API wrapper
    ├── cache.js           # Caching layer
    ├── logger.js          # Logging utilities
    └── webSearch.js       # Web search utilities
```

## Scoring System

### Classification Types

1. **Current News**: Recent events, breaking updates, time-sensitive info
2. **General Knowledge**: Historical facts, established understanding
3. **Empirical Fact**: Testable scientific claims, measurable data

### Scoring Weights

Different claim types use different weight distributions:

**Current News & General Knowledge:**
- AI Rating: 40%
- Tone Analysis: 30%
- Scholarly Match: 0%
- Web Reinforced: 30%

**Empirical Fact:**
- AI Rating: 20%
- Tone Analysis: 25%
- Scholarly Match: 30%
- Web Reinforced: 25%

## Configuration

Edit `src/config.js` to customize:

- OpenAI model selection
- Scoring weights
- UI colors
- Cache TTL
- Max claims per article
- Timeout settings

## Debugging

Enable debug logging:

```javascript
localStorage.setItem('truthcheck_debug', 'true')
```

View logs in browser console (F12).

## API Usage & Costs

The extension makes API calls to:

- **OpenAI**: Classification and scoring (~2-4 calls per claim)
- **Google Scholar**: Scholarly source matching (web scraping)
- **DuckDuckGo**: Web search for reinforcement (no API key)

**Estimated costs**: $0.01-0.05 per article (varies by length)

## Limitations

- Requires active internet connection
- OpenAI API key required (paid service)
- Web searches may be rate-limited
- Claim extraction works best on standard article formats
- Does not fact-check images, videos, or complex visualizations

## Privacy

- All processing happens client-side except API calls
- No data is stored on external servers
- Claims are cached locally to reduce API costs
- Article content is only sent to OpenAI for analysis

## Troubleshooting

**Extension doesn't activate:**
- Check that you're on a supported news site
- Open console (F12) and look for "TruthCheck:" messages
- Verify API key is set correctly

**No claims found:**
- Article may be behind paywall or use non-standard format
- Check console for extraction errors
- Try refreshing the page

**API errors:**
- Verify your OpenAI API key is valid
- Check your API usage quota
- Ensure you have internet connectivity

**Clear cache:**
```javascript
chrome.storage.local.get(null, (items) => {
  const keys = Object.keys(items).filter(k => k.startsWith('truthcheck_cache_'));
  chrome.storage.local.remove(keys, () => console.log('Cache cleared'));
})
```

## Development

To modify or extend the extension:

1. Make changes to source files
2. Reload the extension in `chrome://extensions/`
3. Refresh the test page
4. Check console for errors

## License

[Include your license information here]

## Contributing

[Include contribution guidelines here]

## Support

For issues or questions, [include contact information or issue tracker link]

