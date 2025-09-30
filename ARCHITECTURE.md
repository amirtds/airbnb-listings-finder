# Airbnb Listings Finder - Architecture

## 📁 Project Structure

```
src/
├── main.js                      # Main entry point (106 lines)
├── crawlers/
│   ├── searchCrawler.js        # Search results crawler
│   └── detailCrawler.js        # Listing details crawler
├── scrapers/
│   ├── amenities.js            # Amenities scraper
│   ├── reviews.js              # Reviews scraper
│   ├── houseRules.js           # House rules scraper
│   ├── hostProfile.js          # Host profile scraper
│   └── listingDetails.js      # Main listing details extractor
└── utils/
    ├── delays.js               # Delay utilities
    └── browserConfig.js        # Browser configuration
```

## 🏗️ Module Overview

### **Main Entry Point** (`main.js`)
- **Lines**: 106
- **Purpose**: Orchestrates the two-phase scraping process
- **Responsibilities**:
  - Input validation
  - Phase 1: Collect listing URLs
  - Phase 2: Scrape detailed data
  - Output formatting

### **Crawlers**

#### `searchCrawler.js`
- **Purpose**: Crawl Airbnb search results pages
- **Features**:
  - Pagination handling
  - Lazy loading support (scrolling)
  - Duplicate removal
  - Rate limiting (10 requests/minute)

#### `detailCrawler.js`
- **Purpose**: Scrape full details from individual listings
- **Features**:
  - Orchestrates all scraper modules
  - Rate limiting (8 requests/minute)
  - Error handling with partial data fallback
  - Random delays between requests

### **Scrapers**

#### `amenities.js`
- **Function**: `scrapeAmenities(page, listingId, requestLog, minDelay, maxDelay)`
- **Returns**: Array of amenity objects with name and description

#### `reviews.js`
- **Function**: `scrapeReviews(page, listingId, requestLog, minDelay, maxDelay)`
- **Returns**: Array of review objects with reviewer info, text, score, and date

#### `houseRules.js`
- **Function**: `scrapeHouseRules(page, listingId, requestLog, minDelay, maxDelay)`
- **Returns**: Object with check-in/out times, policies, and additional rules

#### `hostProfile.js`
- **Function**: `scrapeHostProfile(page, hostProfileId, requestLog, minDelay, maxDelay)`
- **Returns**: Object with host info, stats, and other listings

#### `listingDetails.js`
- **Functions**:
  - `extractTitle(page)` - Extract listing title
  - `extractDescription(page, requestLog)` - Extract full description
  - `extractImages(page)` - Extract all image URLs
  - `extractHostProfileId(page)` - Find host profile ID
  - `extractCoHosts(page)` - Extract co-host information
  - `extractPropertyDetails(page)` - Extract guests, bedrooms, bathrooms
  - `isGuestFavorite(page)` - Check if Guest Favorite
  - `isSuperhost(page)` - Check if Superhost

### **Utilities**

#### `delays.js`
- **Functions**:
  - `randomDelay(minDelay, maxDelay, logger)` - Random delay with logging
  - `fixedDelay(ms)` - Fixed delay

#### `browserConfig.js`
- **Functions**:
  - `getBrowserLaunchOptions()` - Stealth browser launch options
  - `getPreNavigationHooks()` - Pre-navigation hooks for anti-detection

## 🔄 Data Flow

```
1. User Input
   ↓
2. Search Crawler (searchCrawler.js)
   → Collects listing URLs
   ↓
3. Detail Crawler (detailCrawler.js)
   ↓
4. For each listing:
   ├── listingDetails.js (title, description, images, etc.)
   ├── amenities.js
   ├── reviews.js
   ├── houseRules.js
   └── hostProfile.js
   ↓
5. Compiled Output
```

## 🎯 Benefits of Modular Architecture

1. **Maintainability**: Each module has a single responsibility
2. **Testability**: Individual modules can be tested in isolation
3. **Reusability**: Scrapers can be used independently
4. **Readability**: Main file is only 106 lines (was 1089 lines)
5. **Scalability**: Easy to add new scrapers or modify existing ones
6. **Debugging**: Easier to identify and fix issues in specific modules

## 🚀 Usage Example

```javascript
// Import only what you need
import { scrapeAmenities } from './scrapers/amenities.js';
import { scrapeReviews } from './scrapers/reviews.js';

// Use individual scrapers
const amenities = await scrapeAmenities(page, listingId, log, 3000, 8000);
const reviews = await scrapeReviews(page, listingId, log, 3000, 8000);
```

## 🔧 Configuration

All scrapers accept delay parameters for rate limiting:
- `minDelayBetweenRequests`: Minimum delay in milliseconds (default: 3000)
- `maxDelayBetweenRequests`: Maximum delay in milliseconds (default: 8000)

Browser configuration is centralized in `utils/browserConfig.js` for:
- Stealth mode settings
- User agent spoofing
- Anti-detection measures
