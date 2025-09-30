# Airbnb Listings Finder

A powerful, modular Airbnb scraper with both CLI and REST API interfaces. Built with Crawlee and Playwright for reliable, production-ready scraping.

## Features

- 🔍 **Smart Search**: Search Airbnb listings by any location worldwide
- 📊 **Comprehensive Data**: Extract 15+ data fields per listing
- 👥 **Host & Co-Host Info**: Get host profiles and co-host details with IDs
- 🏠 **Property Details**: Bedrooms, bathrooms, max guests, and property type
- 🎯 **Amenities**: Complete list of all property amenities
- ⭐ **Reviews**: Extract all guest reviews with ratings and dates
- 📋 **House Rules**: Get all property rules and policies
- 🖼️ **Images**: Download all property image URLs
- 📝 **Full Descriptions**: Automatically expands "Show more" to get complete descriptions
- 🚀 **Production Ready**: Deploy on Apify platform with one command
- 🔄 **Auto Pagination**: Handles pagination automatically
- 💪 **Robust**: Built-in error handling and retry logic

## Input Parameters

The actor accepts the following input parameters via API POST request:

```json
{
  "location": "Miami, FL",
  "numberOfListings": 10
}
```

### Parameters

- **location** (required): The location to search for Airbnb listings (e.g., "Miami, FL", "New York, NY", "Paris, France")
- **numberOfListings** (required): Maximum number of listing URLs to extract (1-100)

## Output

The actor returns an array of detailed listing objects with comprehensive data:

```json
[
  {
    "listingId": "12345678",
    "listingUrl": "https://www.airbnb.com/rooms/12345678",
    "location": "Miami, FL",
    "title": "Beautiful Beachfront Apartment",
    "description": "Full description of the property including all sections...",
    "images": [
      "https://a0.muscache.com/im/pictures/...",
      "https://a0.muscache.com/im/pictures/..."
    ],
    "hostProfileId": "123456",
    "hostProfile": {
      "name": "John Doe",
      "profileUrl": "https://www.airbnb.com/users/show/123456",
      "isSuperhost": true,
      "reviewsCount": 150,
      "rating": 4.9,
      "yearsHosting": 5,
      "languages": ["English", "Spanish"],
      "responseRate": "100%",
      "responseTime": "within an hour",
      "bio": "Host biography..."
    },
    "coHosts": [
      {
        "name": "Jane Smith",
        "profileId": "789012"
      }
    ],
    "maxGuests": 4,
    "bedrooms": 2,
    "bathrooms": 1.5,
    "isGuestFavorite": true,
    "isSuperhost": true,
    "amenities": [
      "Wifi",
      "Kitchen",
      "Free parking",
      "Air conditioning",
      "Pool",
      "Hot tub"
    ],
    "reviews": [
      {
        "reviewId": "987654321",
        "reviewerName": "Alice",
        "reviewerProfileId": "456789",
        "rating": 5,
        "date": "2024-01-15",
        "comment": "Amazing place! Highly recommend..."
      }
    ],
    "houseRules": [
      "Check-in: After 3:00 PM",
      "Checkout: 11:00 AM",
      "No smoking",
      "No pets",
      "No parties or events"
    ]
  }
]
```

### Data Fields

#### Basic Information
- **listingId**: Unique Airbnb listing identifier
- **listingUrl**: Direct URL to the listing page
- **location**: Search location provided as input
- **title**: Property title/name
- **description**: Full property description (automatically expands "Show more")
- **images**: Array of all property image URLs (high resolution)

#### Host Information
- **hostProfileId**: Primary host's Airbnb user ID
- **hostProfile**: Detailed host information object containing:
  - `name`: Host's display name
  - `profileUrl`: Link to host's profile
  - `isSuperhost`: Superhost status
  - `reviewsCount`: Total number of reviews
  - `rating`: Average rating
  - `yearsHosting`: Years of hosting experience
  - `languages`: Languages spoken
  - `responseRate`: Response rate percentage
  - `responseTime`: Typical response time
  - `bio`: Host's biography
- **coHosts**: Array of co-host objects with name and profile ID

#### Property Details
- **maxGuests**: Maximum number of guests allowed
- **bedrooms**: Number of bedrooms
- **bathrooms**: Number of bathrooms (can be decimal, e.g., 1.5)
- **isGuestFavorite**: Whether the listing is marked as "Guest Favorite"
- **isSuperhost**: Whether the primary host is a Superhost

#### Amenities & Rules
- **amenities**: Complete array of all property amenities
- **houseRules**: Array of all house rules and policies

#### Reviews
- **reviews**: Array of guest review objects containing:
  - `reviewId`: Unique review identifier
  - `reviewerName`: Name of the reviewer
  - `reviewerProfileId`: Reviewer's profile ID
  - `rating`: Star rating (1-5)
  - `date`: Review date
  - `comment`: Full review text

## 🚀 Quick Start

### Installation

```bash
cd airbnb-listings-finder
npm install
```

### Option 1: REST API (Recommended)

Start the API server:

```bash
npm run api
```

The API will be available at `http://localhost:3000`

**Scrape by location:**
```bash
curl -X POST http://localhost:3000/api/scrape/search \
  -H "Content-Type: application/json" \
  -d '{"location": "Miami, FL", "numberOfListings": 5}'
```

**Scrape individual listing:**
```bash
curl -X POST http://localhost:3000/api/scrape/listing \
  -H "Content-Type: application/json" \
  -d '{"listingId": "12345678"}'
```

📖 **Full API Documentation**: See [API.md](./API.md)

### Option 2: CLI / Apify Actor

Create a test input file `storage/key_value_stores/default/INPUT.json`:

```json
{
  "location": "Miami, FL",
  "numberOfListings": 5
}
```

Run the actor:

```bash
npm start
```

The results will be stored in `./storage/datasets/default/`.

## Deploying to Apify

### Method 1: Using Apify CLI

1. Install Apify CLI:
```bash
npm install -g apify-cli
```

2. Login to Apify:
```bash
apify login
```

3. Deploy the actor:
```bash
apify push
```

### Method 2: Manual Upload

1. Create a new actor on [Apify Console](https://console.apify.com/)
2. Upload the project files or connect your Git repository
3. Build and publish the actor

## Using the Actor via API

Once deployed on Apify, you can call the actor via POST request:

```bash
curl -X POST https://api.apify.com/v2/acts/YOUR_ACTOR_ID/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "location": "Miami, FL",
    "numberOfListings": 10
  }'
```

### Get Run Results

```bash
curl https://api.apify.com/v2/acts/YOUR_ACTOR_ID/runs/LAST/dataset/items \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Project Structure

```
airbnb-listings-finder/
├── .actor/
│   ├── actor.json          # Apify actor configuration
│   ├── input_schema.json   # Input schema definition
│   └── Dockerfile          # Docker configuration
├── src/
│   └── main.js            # Main actor code
├── package.json           # Node.js dependencies
├── .gitignore
└── README.md
```

## How It Works

The actor operates in two main phases with advanced extraction techniques:

### Phase 1: Collect Listing URLs
1. **Input Processing**: Receives `location` and `numberOfListings` via API POST request
2. **Search Construction**: Builds Airbnb search URL with proper encoding
3. **Smart Crawling**: Uses Crawlee's PlaywrightCrawler for JavaScript-rendered content
4. **Dynamic Loading**: Waits for page load and scrolls to trigger lazy-loaded listings
5. **URL Extraction**: Identifies listing URLs matching `/rooms/{id}` pattern
6. **Auto Pagination**: Automatically follows pagination to reach target count

### Phase 2: Deep Data Extraction
For each listing, the actor performs comprehensive extraction:

#### Basic Data Extraction
- **Title & Description**: Automatically clicks "Show more" button to expand full descriptions
- **Images**: Collects all high-resolution image URLs from the gallery
- **Property Details**: Extracts max guests, bedrooms, bathrooms from overview section

#### Host Information Extraction
- **Primary Host**: Identifies host profile ID from HOST_OVERVIEW section (excludes reviewer IDs)
- **Host Profile Scraping**: Visits host profile page to extract:
  - Name, bio, and profile URL
  - Superhost status and years hosting
  - Response rate and response time
  - Languages spoken
  - Total reviews and average rating
- **Co-Hosts**: Detects and extracts all co-host names and profile IDs

#### Amenities & Reviews
- **Amenities**: Clicks "Show all amenities" button to access complete modal list
- **Reviews**: Extracts all visible reviews with:
  - Reviewer name and profile ID
  - Rating, date, and full comment text
  - Automatically excludes host responses

#### House Rules
- **Rules Extraction**: Clicks "Show all rules" to access full modal
- **Structured Data**: Parses check-in/out times, policies, and restrictions

### Error Handling & Robustness
- Built-in retry logic for failed requests
- Graceful fallbacks for missing data
- Timeout handling for slow-loading elements
- Detailed logging for debugging

## Use Cases

This actor is perfect for:

- 🏢 **Real Estate Analysis**: Compare rental prices and amenities across locations
- 📊 **Market Research**: Analyze vacation rental trends and competition
- 🤖 **AI Training Data**: Build datasets for property recommendation systems
- 💼 **Property Management**: Monitor competitor listings and pricing strategies
- 📈 **Investment Analysis**: Evaluate potential rental property investments
- 🔍 **Lead Generation**: Find property owners for business development
- 📱 **App Development**: Power vacation rental aggregator applications
- 🎯 **Marketing Research**: Understand target market preferences and trends

## Technical Details

### Technologies Used
- **Crawlee**: Modern web scraping framework
- **Playwright**: Headless browser automation
- **Apify SDK**: Cloud deployment and dataset management
- **Node.js**: Runtime environment

### Performance
- Scrapes **1 listing in ~10-15 seconds** (including all data)
- Handles **100+ listings** in a single run
- Automatic retry on failures
- Memory-efficient streaming

### Data Quality
- ✅ Excludes reviewer IDs from host extraction
- ✅ Expands all "Show more" sections automatically
- ✅ Validates data structure before storage
- ✅ Handles missing fields gracefully
- ✅ Removes duplicate images and reviews

## Limitations & Best Practices

### Current Limitations
- Extracts visible reviews only (not all historical reviews)
- Requires JavaScript execution (uses Playwright, not simple HTTP)
- Rate limiting may apply for large-scale scraping

### Best Practices
- **Start Small**: Test with 5-10 listings before scaling
- **Add Delays**: Use `maxRequestsPerMinute` to avoid rate limiting
- **Use Proxies**: For production, implement residential proxy rotation
- **Monitor Runs**: Check logs for any extraction errors
- **Update Regularly**: Airbnb's HTML structure may change

### Recommended Settings
```json
{
  "location": "Miami, FL",
  "numberOfListings": 50,
  "maxRequestsPerMinute": 10
}
```

## Troubleshooting

### Common Issues

**Issue**: No listings found
- **Solution**: Check if location name is valid (try "City, State" or "City, Country")

**Issue**: Missing host profile data
- **Solution**: Host profile may be private or restricted

**Issue**: Incomplete reviews
- **Solution**: Only visible reviews are extracted; some listings hide older reviews

**Issue**: Timeout errors
- **Solution**: Increase timeout values or reduce concurrent requests

## Support & Contributions

Found a bug or have a feature request? Please open an issue on the repository.

## License

ISC

---

**Disclaimer**: This actor is for educational and research purposes. Always respect Airbnb's Terms of Service and robots.txt. Use responsibly and ethically.
