# Search Listings Endpoint

## Overview
The `/api/search/listings` endpoint allows you to search for Airbnb listings by location and retrieve **links plus summary metadata** without scraping the full listing page. This endpoint automatically loops through all available pages to find as many listings as possible (up to the `maxListings` limit).

## Endpoint
```
POST /api/search/listings
```

## Authentication
Requires API token in the `Authorization` header:
```
Authorization: Bearer YOUR_API_TOKEN
```

## Request Body
```json
{
  "location": "Miami, FL",
  "maxListings": 100
}
```

### Parameters
- **location** (required): The location to search for listings (e.g., "Miami, FL", "New York, NY", "Paris, France")
- **maxListings** (optional): Maximum number of listings to retrieve. Default: 100. Range: 1-1000. Set to a high number (e.g., 1000) to gather more pages.

### Listing Fields Returned
- **title**: Listing title as shown in search results.
- **description**: Short descriptive text or subtitle (if available).
- **bedrooms**: Number of bedrooms parsed from the card text (may be `null` if not displayed).
- **pricePerNight**: Computed nightly rate when total price and stay length are available.
- **totalPrice**: Total price displayed for the stay window on the card (may be `null`).
- **stayLengthNights**: Number of nights Airbnb used for the displayed price (when available).
- **rawPriceText**: Original text from the card's price row for reference/debugging.
- **numberOfReviews**: Count of reviews mentioned on the card (may be `null`).
- **overallReviewScore**: Average review score shown in the card (may be `null`).

## Response
```json
{
  "success": true,
  "data": {
    "location": "Miami, FL",
    "totalFound": 50,
    "listings": [
      {
        "listingId": "12345678",
        "listingUrl": "https://www.airbnb.com/rooms/12345678",
        "location": "Miami, FL",
        "title": "Room in Tamarac",
        "description": "Comfortable private room",
        "bedrooms": 1,
        "pricePerNight": 77.4,
        "totalPrice": 387,
        "stayLengthNights": 5,
        "rawPriceText": "$437 $387 Show price breakdown for 5 nights",
        "numberOfReviews": 3,
        "overallReviewScore": 5
      },
      {
        "listingId": "87654321",
        "listingUrl": "https://www.airbnb.com/rooms/87654321",
        "location": "Miami, FL",
        "title": "Cozy Room in Miami",
        "description": "Private room with shared bathroom",
        "bedrooms": 1,
        "pricePerNight": 40,
        "totalPrice": 200,
        "stayLengthNights": 5,
        "rawPriceText": "$200 for 5 nights",
        "numberOfReviews": 10,
        "overallReviewScore": 4.5
      }
    ]
  },
  "meta": {
    "scrapedAt": "2024-10-31T12:34:56.789Z",
    "processingTime": "15s"
  }
}
```

## Example Usage

### Using cURL
```bash
curl -X POST http://localhost:3000/api/search/listings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "location": "Miami, FL",
    "maxListings": 200
  }'
```

### Using JavaScript (fetch)
```javascript
const response = await fetch('http://localhost:3000/api/search/listings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_TOKEN'
  },
  body: JSON.stringify({
    location: 'Miami, FL',
    maxListings: 200
  })
});

const data = await response.json();
console.log(`Found ${data.data.totalFound} listings`);
console.table(data.data.listings.map(({ listingId, title, pricePerNight, numberOfReviews, overallReviewScore }) => ({ listingId, title, pricePerNight, numberOfReviews, overallReviewScore })));
```

### Using Python (requests)
```python
import requests

url = 'http://localhost:3000/api/search/listings'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_TOKEN'
}
payload = {
    'location': 'Miami, FL',
    'maxListings': 200
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()

print(f"Found {data['data']['totalFound']} listings")
for listing in data['data']['listings']:
    print(
        f"ID: {listing['listingId']}, title: {listing['title']}, "
        f"price/night: {listing['pricePerNight']}, reviews: {listing['numberOfReviews']}"
    )
```

## Key Features
- ✅ **Links only**: Returns only listing IDs and URLs (no detailed scraping)
- ✅ **All pages**: Automatically loops through all available search result pages
- ✅ **Fast**: Much faster than the full scraping endpoint since it doesn't fetch details
- ✅ **Efficient**: Uses the search crawler with pagination support

## Comparison with Other Endpoints

| Endpoint | Purpose | Speed | Data Returned |
|----------|---------|-------|---------------|
| `/api/search/listings` | Get listing links with summary card metadata | Fast | IDs, URLs, title, summary price/reviews |
| `/api/scrape/search` | Scrape listings with full details | Slow | Full listing details |
| `/api/scrape/listing` | Scrape single listing | Medium | Full details for one listing |

## Use Cases
1. **Discovery**: Find all available listings in a location
2. **Monitoring**: Track new listings in an area
3. **Bulk Processing**: Get all listing URLs first, then scrape details selectively
4. **Data Pipeline**: First step in a two-phase scraping process

## Error Responses

### Missing Location
```json
{
  "success": false,
  "error": "Location is required",
  "example": {
    "location": "Miami, FL",
    "maxListings": 100
  }
}
```

### Invalid maxListings
```json
{
  "success": false,
  "error": "maxListings must be between 1 and 1000"
}
```

### Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing API token"
}
```

## Notes
- The crawler respects rate limits to avoid being blocked by Airbnb
- Processing time depends on the number of pages to crawl
- Duplicate listings are automatically filtered out
- The crawler will stop when it reaches `maxListings` or when there are no more pages
