# Search Listings Endpoint

## Overview
The `/api/search/listings` endpoint allows you to search for Airbnb listings by location and retrieve **only the listing IDs and URLs** without scraping detailed information. This endpoint automatically loops through all available pages to find all possible listings.

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
- **maxListings** (optional): Maximum number of listings to retrieve. Default: 100. Range: 1-1000. Set to a high number (e.g., 1000) to get all available listings.

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
        "location": "Miami, FL"
      },
      {
        "listingId": "87654321",
        "listingUrl": "https://www.airbnb.com/rooms/87654321",
        "location": "Miami, FL"
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
console.log(data.data.listings);
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
    print(f"ID: {listing['listingId']}, URL: {listing['listingUrl']}")
```

## Key Features
- ✅ **Links only**: Returns only listing IDs and URLs (no detailed scraping)
- ✅ **All pages**: Automatically loops through all available search result pages
- ✅ **Fast**: Much faster than the full scraping endpoint since it doesn't fetch details
- ✅ **Efficient**: Uses the search crawler with pagination support

## Comparison with Other Endpoints

| Endpoint | Purpose | Speed | Data Returned |
|----------|---------|-------|---------------|
| `/api/search/listings` | Get all listing links | Fast | IDs & URLs only |
| `/api/scrape/search` | Scrape listings with details | Slow | Full listing details |
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
