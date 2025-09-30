# Deployment Guide

## Quick Start (Local Testing)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **The input file is already set up at:**
   ```
   storage/key_value_stores/default/INPUT.json
   ```

3. **Run the actor:**
   ```bash
   npm start
   ```

4. **View results:**
   - Output summary: `storage/key_value_stores/default/OUTPUT.json`
   - Dataset items: `storage/datasets/default/`

## Modifying Input

Edit `storage/key_value_stores/default/INPUT.json`:

```json
{
  "location": "New York, NY",
  "numberOfListings": 20
}
```

## Deploy to Apify

### Option 1: Using Apify CLI (Recommended)

1. **Install Apify CLI:**
   ```bash
   npm install -g apify-cli
   ```

2. **Login to Apify:**
   ```bash
   apify login
   ```

3. **Deploy:**
   ```bash
   apify push
   ```

### Option 2: Manual Upload

1. Go to [Apify Console](https://console.apify.com/)
2. Create a new actor
3. Upload the project files or connect your Git repository
4. Build and publish

## Using the Actor via API

### Start a Run

```bash
curl -X POST https://api.apify.com/v2/acts/YOUR_ACTOR_ID/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "location": "Miami, FL",
    "numberOfListings": 10
  }'
```

### Get Results

```bash
curl https://api.apify.com/v2/acts/YOUR_ACTOR_ID/runs/LAST/dataset/items \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Example Response

```json
[
  {
    "listingId": "1506732284117933752",
    "listingUrl": "https://www.airbnb.com/rooms/1506732284117933752",
    "location": "Miami, FL",
    "title": "Bright Private Bed&Bath Neighboring Downtown Miami",
    "description": "Enjoy a private bedroom with an ensuite bathroom...",
    "images": [
      "https://a0.muscache.com/im/pictures/...",
      "https://a0.muscache.com/im/pictures/..."
    ],
    "hostProfileId": "593603218",
    "maxGuests": 2,
    "bedrooms": 1,
    "bathrooms": 3,
    "isGuestFavorite": false,
    "isSuperhost": false
  },
  ...
]
```

## Notes

- The actor uses Playwright to handle JavaScript-rendered content
- Operates in two phases: (1) Collect listing URLs, (2) Scrape detailed data
- First run may take longer as Playwright downloads browser binaries
- Processing time depends on the number of listings (approximately 5-10 seconds per listing)
- Results are stored in both the dataset and OUTPUT key-value store
- For production, consider adding proxy rotation to avoid rate limiting

## Performance

- **Phase 1** (URL Collection): ~5-10 seconds per search page
- **Phase 2** (Detail Scraping): ~5-10 seconds per listing
- **Example**: 10 listings ≈ 1-2 minutes total runtime
