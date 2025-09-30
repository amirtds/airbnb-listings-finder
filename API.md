# Airbnb Listings Scraper API Documentation

## 🚀 Getting Started

### Installation

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and add your API tokens
nano .env
```

### Configuration

Edit `.env` file:
```env
PORT=3000
NODE_ENV=development
API_TOKENS=your-secret-token-here,another-token-here
```

**Generate secure tokens:**
```bash
openssl rand -hex 32
```

### Start the Server

```bash
# Start the API server
npm run api

# Or use nodemon for development (auto-reload)
npm run dev
```

The API will be available at `http://localhost:3000`

### Authentication

All API endpoints (except `/health`) require authentication using Bearer tokens.

**Include the token in your requests:**
```bash
curl -X POST http://localhost:3000/api/scrape/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token-here" \
  -d '{"location": "Miami, FL", "numberOfListings": 5}'
```

---

## 📡 API Endpoints

### 1. Health Check

**GET** `/health`

Check if the API is running.

**Response:**
```json
{
  "status": "ok",
  "service": "Airbnb Listings Scraper API",
  "version": "1.0.0",
  "timestamp": "2025-09-30T20:42:55.123Z"
}
```

---

### 2. Scrape Listings by Location

**POST** `/api/scrape/search`

Scrape multiple Airbnb listings for a given location.

**Request Body:**
```json
{
  "location": "Miami, FL",
  "numberOfListings": 10,
  "minDelayBetweenRequests": 3000,
  "maxDelayBetweenRequests": 8000
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `location` | string | ✅ Yes | - | Search location (e.g., "Miami, FL", "New York, NY") |
| `numberOfListings` | number | No | 10 | Number of listings to scrape (1-100) |
| `minDelayBetweenRequests` | number | No | 3000 | Minimum delay between requests in ms |
| `maxDelayBetweenRequests` | number | No | 8000 | Maximum delay between requests in ms |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "location": "Miami, FL",
    "requestedCount": 10,
    "foundCount": 10,
    "listings": [
      {
        "listingId": "12345678",
        "listingUrl": "https://www.airbnb.com/rooms/12345678",
        "location": "Miami, FL",
        "title": "Luxury Beachfront Condo",
        "description": "Beautiful oceanfront property...",
        "images": ["https://...", "https://..."],
        "hostProfileId": "987654",
        "hostProfile": {
          "name": "John Doe",
          "isSuperhost": true,
          "rating": 4.9,
          "reviewsCount": 150
        },
        "coHosts": [],
        "maxGuests": 4,
        "bedrooms": 2,
        "bathrooms": 2,
        "isGuestFavorite": true,
        "isSuperhost": true,
        "amenities": [
          {
            "name": "WiFi",
            "description": "High-speed internet"
          }
        ],
        "reviews": [
          {
            "reviewId": "123",
            "name": "Jane Smith",
            "text": "Amazing place!",
            "score": 5,
            "reviewDetails": {
              "city": "Los Angeles",
              "country": "United States",
              "date": "October 2024"
            }
          }
        ],
        "houseRules": {
          "checkIn": "3:00 PM",
          "checkOut": "11:00 AM",
          "selfCheckIn": true,
          "maxGuests": 4,
          "pets": false,
          "noParties": true,
          "noSmoking": true
        }
      }
    ]
  },
  "meta": {
    "scrapedAt": "2025-09-30T20:42:55.123Z",
    "processingTime": "45s"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Location is required",
  "example": {
    "location": "Miami, FL",
    "numberOfListings": 10
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/scrape/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token-here" \
  -d '{
    "location": "Miami, FL",
    "numberOfListings": 5
  }'
```

**Authentication Error (401):**
```json
{
  "success": false,
  "error": "Authentication required",
  "message": "Please provide an Authorization header with a valid token",
  "example": "Authorization: Bearer YOUR_API_TOKEN"
}
```

**Invalid Token Error (403):**
```json
{
  "success": false,
  "error": "Invalid token",
  "message": "The provided token is not valid"
}
```

---

### 3. Scrape Individual Listing

**POST** `/api/scrape/listing`

Scrape detailed information for a single Airbnb listing by ID.

**Request Body:**
```json
{
  "listingId": "12345678",
  "minDelayBetweenRequests": 3000,
  "maxDelayBetweenRequests": 8000
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `listingId` | string/number | ✅ Yes | - | Airbnb listing ID (from URL: airbnb.com/rooms/**12345678**). Can be string or number - will be converted to string internally. |
| `minDelayBetweenRequests` | number | No | 3000 | Minimum delay between requests in ms |
| `maxDelayBetweenRequests` | number | No | 8000 | Maximum delay between requests in ms |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "listingId": "12345678",
    "listingUrl": "https://www.airbnb.com/rooms/12345678",
    "title": "Luxury Beachfront Condo",
    "description": "Beautiful oceanfront property with stunning views...",
    "images": [
      "https://a0.muscache.com/im/pictures/...",
      "https://a0.muscache.com/im/pictures/..."
    ],
    "hostProfileId": "987654",
    "hostProfile": {
      "name": "John Doe",
      "isSuperhost": true,
      "isIdentityVerified": true,
      "reviewsCount": 150,
      "rating": 4.9,
      "yearsHosting": 5,
      "work": "Real Estate",
      "languages": ["English", "Spanish"],
      "location": "Miami, Florida",
      "about": "Passionate host...",
      "listings": []
    },
    "coHosts": [],
    "maxGuests": 4,
    "bedrooms": 2,
    "bathrooms": 2,
    "isGuestFavorite": true,
    "isSuperhost": true,
    "amenities": [...],
    "reviews": [...],
    "houseRules": {...}
  },
  "meta": {
    "scrapedAt": "2025-09-30T20:42:55.123Z",
    "processingTime": "25s"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "listingId is required",
  "example": {
    "listingId": "12345678"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/scrape/listing \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token-here" \
  -d '{
    "listingId": "12345678"
  }'
```

**⚠️ Important Notes:**

**1. Authentication Required:**
All scraping endpoints require a valid Bearer token in the Authorization header.

**2. Large Listing IDs:**

For very large listing IDs (e.g., `1429341905176538313`), always send them as **strings** to avoid JavaScript number precision issues:

```json
{
  "listingId": "1429341905176538313"
}
```

If you send it as a number without quotes, JavaScript may round it due to precision limits. The API automatically converts all listing IDs to strings internally, but it's best practice to send them as strings from the start.

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
```

### Rate Limiting

To avoid being blocked by Airbnb:

- **Search endpoint**: Processes 1 page at a time, max 10 requests/minute
- **Listing endpoint**: Processes 1 listing at a time, max 8 requests/minute
- **Delays**: Random delays between 3-8 seconds (configurable)

---

## 📊 Response Data Structure

### Listing Object

```typescript
{
  listingId: string;
  listingUrl: string;
  location?: string;
  title: string | null;
  description: string | null;
  images: string[];
  hostProfileId: string | null;
  hostProfile: HostProfile | null;
  coHosts: CoHost[];
  maxGuests: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  isGuestFavorite: boolean;
  isSuperhost: boolean;
  amenities: Amenity[];
  reviews: Review[];
  houseRules: HouseRules | null;
}
```

### Host Profile Object

```typescript
{
  name: string;
  isSuperhost: boolean;
  isIdentityVerified: boolean;
  reviewsCount: number;
  rating: number;
  yearsHosting: number;
  work: string;
  uniqueHome: string;
  languages: string[];
  location: string;
  about: string;
  listings: HostListing[];
}
```

---

## ⚠️ Error Handling

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `500` - Internal Server Error (scraping failed)

---

## 🧪 Testing with Postman

### Import Collection

Create a Postman collection with these requests:

1. **Health Check**
   - Method: GET
   - URL: `http://localhost:3000/health`

2. **Scrape by Location**
   - Method: POST
   - URL: `http://localhost:3000/api/scrape/search`
   - Body (JSON):
     ```json
     {
       "location": "Miami, FL",
       "numberOfListings": 5
     }
     ```

3. **Scrape by Listing ID**
   - Method: POST
   - URL: `http://localhost:3000/api/scrape/listing`
   - Body (JSON):
     ```json
     {
       "listingId": "12345678"
     }
     ```

---

## 🚨 Rate Limiting & Best Practices

1. **Don't abuse the API**: Airbnb may block your IP if you make too many requests
2. **Use appropriate delays**: Keep default delays (3-8 seconds) or increase them
3. **Limit concurrent requests**: The API processes one request at a time
4. **Monitor for 429 errors**: If you get blocked, wait 30-60 minutes
5. **Use proxies for production**: Consider using residential proxies for large-scale scraping

---

## 📝 Example Use Cases

### Use Case 1: Real Estate Analysis
```bash
# Scrape all listings in a specific area
curl -X POST http://localhost:3000/api/scrape/search \
  -H "Content-Type: application/json" \
  -d '{"location": "Manhattan, NY", "numberOfListings": 50}'
```

### Use Case 2: Competitor Analysis
```bash
# Analyze a specific competitor's listing
curl -X POST http://localhost:3000/api/scrape/listing \
  -H "Content-Type: application/json" \
  -d '{"listingId": "12345678"}'
```

### Use Case 3: Market Research
```bash
# Compare multiple locations
for location in "Miami, FL" "Los Angeles, CA" "Austin, TX"; do
  curl -X POST http://localhost:3000/api/scrape/search \
    -H "Content-Type: application/json" \
    -d "{\"location\": \"$location\", \"numberOfListings\": 20}"
done
```

---

## 🛠️ Development

### Project Structure
```
src/
├── api/
│   ├── server.js                 # Express server
│   ├── controllers/
│   │   ├── searchController.js  # Location search endpoint
│   │   └── listingController.js # Individual listing endpoint
│   └── middleware/
│       ├── errorHandler.js      # Error handling
│       └── requestLogger.js     # Request logging
├── crawlers/                     # Crawler modules
├── scrapers/                     # Scraper modules
└── utils/                        # Utility functions
```

### Adding New Endpoints

1. Create controller in `src/api/controllers/`
2. Add route in `src/api/server.js`
3. Update this documentation

---

## 📞 Support

For issues or questions:
- Check the logs for error messages
- Ensure all dependencies are installed
- Verify Airbnb hasn't changed their HTML structure
- Wait if you're getting 429 errors (rate limited)
