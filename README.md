# Delos - Making Truth Visible

An AI-powered fact-checking browser extension that automatically analyzes news articles, extracts factual claims, and scores them for credibility using multi-dimensional verification across AI analysis, academic sources, and cross-spectrum web validation.

## ✨ Features

### 🎯 Intelligent Claim Detection
- **Research-Based Extraction**: Uses linguistic analysis and argumentation mining principles to identify check-worthy claims
- **Smart Filtering**: Automatically removes UI noise, navigation elements, and non-factual content
- **Quote Preservation**: Intelligently handles multi-sentence quotes and attributions

### 🧠 Multi-Dimensional Scoring System
Every claim is evaluated across **4 independent dimensions**:

1. **AI Credibility Rating** (0-10)
   - Logical consistency and plausibility analysis
   - Verifiability assessment using GPT-4o-mini

2. **Tone Analysis** (0-10)
   - Detects emotional language and bias
   - Identifies loaded terms and propaganda techniques

3. **Scholarly Match** (0-10)
   - Searches Google Scholar for academic backing
   - Prioritizes authoritative domains (.edu, .nih.gov, nature.com)
   - Only applies to empirical/scientific claims

4. **Web Reinforcement** (0-10)
   - Cross-verifies claims across independent news sources
   - **Political Spectrum Analysis**: Rewards claims verified across left, center, and right-leaning sources
   - Detects potential echo chambers

### 🎨 Visual Feedback
- **Color-Coded Highlights**:
  - 🟢 **Green** (≥7/10): High trust - Well-verified claim
  - 🟡 **Yellow** (3-7/10): Medium trust - Requires further verification
  - 🔴 **Red** (<3/10): Low trust - Questionable or unverified

- **Interactive Tooltips**: Hover to see score breakdown and classification
- **Source Bibliography**: Click any claim to see full sources with political spectrum visualization

### 📊 Claim Classification
Claims are automatically categorized:
- **📰 Current News**: Recent events, breaking updates, time-sensitive information
- **📚 General Knowledge**: Historical facts, established understanding
- **🔬 Empirical Fact**: Testable scientific claims, measurable data, research findings

Different classifications use optimized scoring weights for best accuracy.

## 🚀 Installation

### Prerequisites

- Chrome, Edge, Brave, or any Chromium-based browser
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- ~$0.01-0.05 per article in API costs

### Quick Setup (5 minutes)

1. **Clone or Download**
   ```bash
   git clone https://github.com/BenNormann/Delos.git
   cd Delos
   ```

2. **Configure API Key**
   
   Create your `secrets.json` file:
   ```bash
   # Windows (PowerShell)
   Copy-Item secrets.template.json secrets.json
   
   # Mac/Linux
   cp secrets.template.json secrets.json
   ```
   
   Edit `secrets.json` and add your OpenAI API key:
   ```json
   {
     "openai_api_key": "sk-proj-your-actual-key-here"
   }
   ```
   
   > **🔒 Security**: `secrets.json` is automatically ignored by git and will never be committed

3. **Load Extension**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle in top-right corner)
   - Click **"Load unpacked"**
   - Select the `Delos` directory
   - ✅ The Delos icon should appear in your toolbar

4. **Verify Setup**
   - Visit any news article (e.g., [BBC News](https://www.bbc.com/news))
   - Look for the loading indicator (lighthouse animation)
   - Within 10-30 seconds, claims will be highlighted
   - Check console (F12) for detailed logs

## 📖 Usage

### Basic Workflow

1. **Visit a News Site**
   - Navigate to any major news outlet article
   - Supported sites: NYT, Washington Post, The Guardian, BBC, CNN, Reuters, AP News, NPR, Bloomberg, WSJ, Fox News, and more

2. **Automatic Analysis**
   - Delos runs automatically on page load
   - Watch the loading indicator for progress:
     - Analyzing article...
     - Extracting claims...
     - Classifying claims...
     - Scoring claims...
     - Highlighting claims...

3. **Explore Results**
   - **Hover** over highlighted claims to see score breakdown
   - **Click** claims to view full source bibliography and political spectrum
   - **Open popup** (click extension icon) to see article-level statistics

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

