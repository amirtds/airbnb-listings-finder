/**
 * Controller for searching listings by location (links only, no details)
 */

import { createSearchCrawler } from '../../crawlers/searchCrawler.js';

/**
 * POST /api/search/listings
 * Search for Airbnb listings by location and return links only
 * 
 * Request body:
 * {
 *   "location": "Miami, FL",
 *   "maxListings": 100  // Optional, defaults to 100. Set to a high number to get all listings
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "location": "Miami, FL",
 *     "totalFound": 50,
 *     "listings": [
 *       {
 *         "listingId": "12345678",
 *         "listingUrl": "https://www.airbnb.com/rooms/12345678",
 *         "location": "Miami, FL"
 *       }
 *     ]
 *   },
 *   "meta": {
 *     "scrapedAt": "2024-10-31T12:34:56.789Z",
 *     "processingTime": "15s"
 *   }
 * }
 */
export async function searchListingsByLocation(req, res, next) {
    const startTime = Date.now();
    
    try {
        const { 
            location,
            maxListings = 100  // Default to 100, but can be set higher to get all listings
        } = req.body;

        // Validate input
        if (!location) {
            return res.status(400).json({
                success: false,
                error: 'Location is required',
                example: {
                    location: "Miami, FL",
                    maxListings: 100
                }
            });
        }

        if (maxListings < 1 || maxListings > 1000) {
            return res.status(400).json({
                success: false,
                error: 'maxListings must be between 1 and 1000'
            });
        }

        console.log(`[API] Starting listing search for location: ${location}, maxListings: ${maxListings}`);

        // Array to store found listings
        const foundListings = [];

        // Create and configure the search crawler
        const searchCrawler = createSearchCrawler(foundListings, maxListings, location);

        // Build the search URL
        const searchUrl = `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes`;
        console.log(`[API] Search URL: ${searchUrl}`);

        // Run the crawler
        await searchCrawler.run([searchUrl]);

        console.log(`[API] Search completed. Found ${foundListings.length} listings`);

        // Calculate processing time
        const processingTime = Math.round((Date.now() - startTime) / 1000);

        // Return results
        res.json({
            success: true,
            data: {
                location: location,
                totalFound: foundListings.length,
                listings: foundListings
            },
            meta: {
                scrapedAt: new Date().toISOString(),
                processingTime: `${processingTime}s`
            }
        });

    } catch (error) {
        console.error('[API] Error in searchListingsByLocation:', error);
        next(error);
    }
}
