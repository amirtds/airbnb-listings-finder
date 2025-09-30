# Airbnb Listings Finder

A Crawlee-based Apify actor that extracts Airbnb listing URLs based on a specified location.

## Features

- 🔍 Search Airbnb listings by location
- 📊 Extract specified number of listing URLs
- 🚀 Ready to deploy on Apify platform
- 🔄 Handles pagination automatically
- 📝 Returns structured data with listing URLs and IDs

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

The actor returns an array of listing objects with the following structure:

```json
[
  {
    "listingUrl": "https://www.airbnb.com/rooms/12345678",
    "listingId": "12345678",
    "location": "Miami, FL"
  }
]
```

## Local Development

### Prerequisites

- Node.js 18 or higher
- npm

### Installation

```bash
cd airbnb-listings-finder
npm install
```

### Running Locally

Create a test input file `input.json`:

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

The results will be stored in `./apify_storage/datasets/default/`.

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

1. Actor receives `location` and `numberOfListings` parameters via API POST request
2. Constructs Airbnb search URL based on the location
3. Crawls search results pages using Crawlee's PlaywrightCrawler (handles JavaScript-rendered content)
4. Waits for page to load and scrolls to trigger lazy-loaded content
5. Extracts listing URLs matching the pattern `/rooms/{id}`
6. Handles pagination to find more listings if needed
7. Returns the requested number of unique listing URLs
8. Stores results in Apify dataset

## Notes

- The actor respects Airbnb's website structure as of the implementation date
- Website changes may require updates to the selectors
- Consider adding delays between requests to avoid rate limiting
- For production use, consider implementing proxy rotation

## License

ISC
