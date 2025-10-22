# Site Content Snapshot API

## Overview

The Site Content Snapshot endpoint provides a focused API for retrieving specific Airbnb listing data without the overhead of scraping all listing details.

## Endpoint

```
POST /api/scrape/listing/snapshot
```

## Authentication

Requires Bearer token authentication via the `Authorization` header.

## Request Body

```json
{
  "listingId": "12345678",
  "minDelayBetweenRequests": 500,
  "maxDelayBetweenRequests": 1000
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `listingId` | string | Yes | - | The Airbnb listing ID |
| `minDelayBetweenRequests` | number | No | 500 | Minimum delay between requests in milliseconds |
| `maxDelayBetweenRequests` | number | No | 1000 | Maximum delay between requests in milliseconds |

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "listingId": "12345678",
    "listingUrl": "https://www.airbnb.com/rooms/12345678",
    "htmlSnapshot": "<div id=\"site-content\">...</div>",
    "images": [
      "https://a0.muscache.com/im/pictures/...",
      "https://a0.muscache.com/im/pictures/..."
    ],
    "amenities": [
      {
        "category": "Bathroom",
        "items": ["Hair dryer", "Shampoo"]
      }
    ],
    "reviews": [
      {
        "author": "John Doe",
        "rating": 5,
        "date": "2024-01-15",
        "comment": "Great place to stay!"
      }
    ],
    "rules": {
      "checkIn": "3:00 PM - 10:00 PM",
      "checkOut": "11:00 AM",
      "additionalRules": ["No smoking", "No pets"]
    }
  },
  "meta": {
    "scrapedAt": "2024-01-20T10:30:00.000Z",
    "processingTime": "45s"
  }
}
```

### Error Response (400/500)

```json
{
  "success": false,
  "error": "Error message",
  "example": {
    "listingId": "12345678"
  }
}
```

## Data Fields Returned

The endpoint returns **only** the following fields:

1. **htmlSnapshot** - The complete HTML of the site-content div
2. **images** - Array of image URLs from the listing
3. **amenities** - Array of amenities organized by category
4. **reviews** - Array of user reviews with ratings and comments
5. **rules** - House rules including check-in/check-out times and restrictions

## Comparison with Full Listing Endpoint

| Feature | `/api/scrape/listing` | `/api/scrape/listing/snapshot` |
|---------|----------------------|-------------------------------|
| HTML Snapshot | ✓ | ✓ |
| Images | ✓ | ✓ |
| Amenities | ✓ | ✓ |
| Reviews | ✓ | ✓ |
| House Rules | ✓ | ✓ |
| Title | ✓ | ✗ |
| Description | ✓ | ✗ |
| Host Profile | ✓ | ✗ |
| Location | ✓ | ✗ |
| Pricing | ✓ | ✗ |
| Property Details | ✓ | ✗ |

## Example Usage

### cURL

```bash
curl -X POST http://localhost:3000/api/scrape/listing/snapshot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-token" \
  -d '{
    "listingId": "12345678",
    "minDelayBetweenRequests": 500,
    "maxDelayBetweenRequests": 1000
  }'
```

### JavaScript/Node.js

```javascript
const response = await fetch('http://localhost:3000/api/scrape/listing/snapshot', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-token'
  },
  body: JSON.stringify({
    listingId: '12345678',
    minDelayBetweenRequests: 500,
    maxDelayBetweenRequests: 1000
  })
});

const result = await response.json();
console.log(result.data);
```

### Python

```python
import requests

response = requests.post(
    'http://localhost:3000/api/scrape/listing/snapshot',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-api-token'
    },
    json={
        'listingId': '12345678',
        'minDelayBetweenRequests': 500,
        'maxDelayBetweenRequests': 1000
    }
)

data = response.json()
print(data['data'])
```

## Use Cases

This endpoint is ideal when you need:

- Quick access to listing content without full details
- HTML snapshot for custom parsing
- Review data for sentiment analysis
- Amenities list for filtering/comparison
- House rules for compliance checking
- Image gallery for display purposes

## Performance

- **Faster** than the full listing endpoint (fewer scraping operations)
- **Lighter** response payload (only essential data)
- **Efficient** for batch processing multiple listings

## Notes

- The HTML snapshot contains the complete site-content div, which includes most visible listing information
- Reviews are scraped from the reviews modal if available
- Amenities are organized by category for easier processing
- All scraping respects the configured delays to avoid rate limiting
