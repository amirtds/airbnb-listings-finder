# New Fields Added to /api/scrape/search

## Date: 2025-10-02

## Summary

Added missing fields to `/api/scrape/search` endpoint to match the data available in `/api/scrape/listing`:

✅ **Location Information** - Detailed address, city, state, country, and GPS coordinates  
✅ **Overall Rating** - Average rating (e.g., 4.95)  
✅ **Reviews Count** - Total number of reviews (e.g., 123)  
✅ **Pricing** - Price per night, currency, and total for 3 nights (skipped in quick mode)

---

## New Response Structure

### New Fields Added

```json
{
  "listingId": "12345678",
  "listingUrl": "https://www.airbnb.com/rooms/12345678",
  
  // NEW: Search location (what you searched for)
  "searchLocation": "Miami, FL",
  
  // NEW: Detailed location data with GPS coordinates
  "location": {
    "address": "Miami Beach, FL",
    "city": "Miami Beach",
    "state": "Florida",
    "country": "United States",
    "coordinates": {
      "latitude": 25.7907,
      "longitude": -80.1300
    }
  },
  
  // Existing fields...
  "title": "Luxury Beachfront Condo",
  "description": "...",
  "images": [...],
  
  // NEW: Overall rating (0-5)
  "overallRating": 4.95,
  
  // NEW: Total number of reviews
  "reviewsCount": 123,
  
  // NEW: Pricing information (null in quick mode)
  "pricing": {
    "pricePerNight": 250,
    "currency": "$",
    "totalFor3Nights": 750,
    "priceBeforeDiscount": null,
    "discountPercentage": null
  },
  
  // Rest of fields...
  "hostProfileId": "987654",
  "hostProfile": {...},
  "amenities": [...],
  "reviews": {...},
  "houseRules": {...}
}
```

---

## Field Details

### 1. Location Information

**Field:** `location`  
**Type:** Object

```json
{
  "address": "Miami Beach, FL",
  "city": "Miami Beach",
  "state": "Florida", 
  "country": "United States",
  "coordinates": {
    "latitude": 25.7907,
    "longitude": -80.1300
  }
}
```

**Features:**
- Detailed address information
- City, state, and country parsed separately
- GPS coordinates (latitude/longitude) for mapping
- Extracted from the "Where you'll be" section on listing page

**Use Cases:**
- Display on map
- Filter by specific city/state
- Calculate distance from a point
- Geographic analysis

---

### 2. Overall Rating

**Field:** `overallRating`  
**Type:** Number (or null)  
**Range:** 0.0 - 5.0

```json
"overallRating": 4.95
```

**Features:**
- Average rating across all reviews
- Displayed prominently on listing page
- Can be null if no reviews

**Use Cases:**
- Sort by rating
- Filter listings above certain rating
- Display star ratings in UI

---

### 3. Reviews Count

**Field:** `reviewsCount`  
**Type:** Number (or null)

```json
"reviewsCount": 123
```

**Features:**
- Total number of reviews for the listing
- Can be null if no reviews
- Helps assess listing popularity

**Use Cases:**
- Filter by minimum review count
- Show "123 reviews" in listings
- Sort by most reviewed

---

### 4. Pricing

**Field:** `pricing`  
**Type:** Object (or null in quick mode)

```json
{
  "pricePerNight": 250,
  "currency": "$",
  "totalFor3Nights": 750,
  "priceBeforeDiscount": null,
  "discountPercentage": null
}
```

**Features:**
- Price per night
- Currency symbol ($, €, £, etc.)
- Total for 3 nights
- Discount info (if available)

**Note:** 
- **Skipped in quick mode** for performance
- Pricing extraction adds ~3-5 seconds per listing
- For quick mode, `pricing` will be `null`

**Use Cases:**
- Sort by price
- Filter by price range
- Display pricing in search results
- Compare prices across listings

---

## Performance Impact

### Normal Mode
- **Time added:** ~2-3 seconds per listing
- **Reason:** Location and review score extraction are fast
- **Pricing:** Adds most time (navigates to calendar)

### Quick Mode
- **Time added:** ~1 second per listing
- **Reason:** Pricing is skipped
- **Still includes:** Location, rating, and review count

---

## Migration Guide

### Before (Old Response)
```json
{
  "listingId": "12345678",
  "location": "Miami, FL",  // Just search location
  "title": "...",
  // ... no rating, no reviews count, no pricing
}
```

### After (New Response)
```json
{
  "listingId": "12345678",
  "searchLocation": "Miami, FL",  // What you searched
  "location": {                    // NEW: Detailed location
    "city": "Miami Beach",
    "state": "Florida",
    "coordinates": {...}
  },
  "title": "...",
  "overallRating": 4.95,           // NEW
  "reviewsCount": 123,             // NEW
  "pricing": {...}                 // NEW (null in quick mode)
}
```

---

## Example Request

### Normal Mode (Includes Pricing)
```bash
curl -X POST http://localhost:3000/api/scrape/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "location": "Miami, FL",
    "numberOfListings": 10
  }'
```

**Time:** ~10-15 seconds per listing (includes pricing)

### Quick Mode (No Pricing)
```bash
curl -X POST http://localhost:3000/api/scrape/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "location": "Miami, FL",
    "numberOfListings": 10,
    "quickMode": true
  }'
```

**Time:** ~5-8 seconds per listing (pricing is null)

---

## Use Cases

### Filter by Rating and Price
```javascript
const goodDeals = listings.filter(listing => 
  listing.overallRating >= 4.5 && 
  listing.pricing?.pricePerNight <= 200
);
```

### Sort by Reviews
```javascript
const popular = listings.sort((a, b) => 
  b.reviewsCount - a.reviewsCount
);
```

### Map Display
```javascript
listings.forEach(listing => {
  if (listing.location.coordinates.latitude) {
    addMarkerToMap(
      listing.location.coordinates.latitude,
      listing.location.coordinates.longitude,
      listing.title
    );
  }
});
```

### Price Comparison
```javascript
const avgPrice = listings
  .filter(l => l.pricing)
  .reduce((sum, l) => sum + l.pricing.pricePerNight, 0) / 
  listings.length;
  
console.log(`Average: $${avgPrice}/night`);
```

---

## Backwards Compatibility

⚠️ **Breaking Change:** The `location` field has changed from a string to an object.

**Before:**
```json
"location": "Miami, FL"
```

**After:**
```json
"searchLocation": "Miami, FL",
"location": {
  "city": "Miami Beach",
  "state": "Florida",
  "country": "United States",
  ...
}
```

**Migration:**
- Use `searchLocation` if you need the original search string
- Use `location.city` or `location.country` for detailed location
- Update any code that expects `location` to be a string

---

## Testing

After deployment:

```bash
# Test normal mode
curl -X POST http://localhost:3000/api/scrape/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"location": "Miami, FL", "numberOfListings": 2}' | jq '.data.listings[0] | {overallRating, reviewsCount, pricing, location}'

# Test quick mode (pricing should be null)
curl -X POST http://localhost:3000/api/scrape/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"location": "Miami, FL", "numberOfListings": 2, "quickMode": true}' | jq '.data.listings[0] | {overallRating, reviewsCount, pricing, location}'
```

---

## Files Modified

1. **`src/crawlers/detailCrawler.js`**
   - Added imports for `extractLocation`, `extractPricing`, `extractReviewScore`
   - Extract location, pricing, and review scores
   - Skip pricing in quick mode
   - Updated listing object with new fields

2. **`API.md`**
   - Updated example response to show new fields
   - Added notes about quick mode behavior

---

## Questions?

- **Why is pricing null?** You're using quick mode. Remove `"quickMode": true` to get pricing.
- **Why is location null?** The scraper couldn't find the location section (rare case).
- **Why is overallRating null?** Listing has no reviews yet.
- **Why is pricing taking long?** Pricing requires navigating to calendar and selecting dates.

---

## Date Implemented

2025-10-02
