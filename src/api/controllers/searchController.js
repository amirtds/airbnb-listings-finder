/**
 * Controller for scraping listings by location
 */

import { PlaywrightCrawler } from 'crawlee';
import { createSearchCrawler } from '../../crawlers/searchCrawler.js';
import { createDetailCrawler } from '../../crawlers/detailCrawler.js';

/**
 * POST /api/scrape/search
 * Scrape Airbnb listings by location
 * 
 * Request body:
 * {
 *   "location": "Miami, FL",
 *   "numberOfListings": 10,
 *   "minDelayBetweenRequests": 3000,
 *   "maxDelayBetweenRequests": 8000
 * }
 */
export async function scrapeByLocation(req, res, next) {
    let searchCrawler = null;
    let detailCrawler = null;
    
    try {
        const { 
            location, 
            numberOfListings = 10,
            minDelayBetweenRequests = 3000,
            maxDelayBetweenRequests = 8000,
            quickMode = false
        } = req.body;

        // Validate input
        if (!location) {
            return res.status(400).json({
                success: false,
                error: 'Location is required',
                example: {
                    location: "Miami, FL",
                    numberOfListings: 10
                }
            });
        }

        if (numberOfListings < 1 || numberOfListings > 100) {
            return res.status(400).json({
                success: false,
                error: 'numberOfListings must be between 1 and 100'
            });
        }

        console.log(`[API] Starting scrape for location: ${location}, count: ${numberOfListings}, quickMode: ${quickMode}`);

        // Store found listings
        const foundListings = [];
        const detailedListings = [];

        // Construct search URL
        const searchUrl = `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes`;

        // PHASE 1: Collect listing URLs
        console.log('[API] Phase 1: Collecting listing URLs...');
        searchCrawler = createSearchCrawler(foundListings, numberOfListings, location);
        await searchCrawler.run([searchUrl]);

        const finalListings = foundListings.slice(0, numberOfListings);
        console.log(`[API] Collected ${finalListings.length} listing URLs`);

        // PHASE 2: Scrape detailed data
        console.log('[API] Phase 2: Scraping detailed listing data...');
        detailCrawler = createDetailCrawler(
            detailedListings,
            numberOfListings,
            minDelayBetweenRequests,
            maxDelayBetweenRequests,
            quickMode
        );

        const detailRequests = finalListings.map(listing => ({
            url: listing.listingUrl,
            userData: {
                listingId: listing.listingId,
                location: listing.location,
                quickMode: quickMode
            }
        }));

        await detailCrawler.run(detailRequests);

        console.log(`[API] Successfully scraped ${detailedListings.length} listings`);

        // Return results
        res.json({
            success: true,
            data: {
                location: location,
                requestedCount: numberOfListings,
                foundCount: detailedListings.length,
                listings: detailedListings
            },
            meta: {
                scrapedAt: new Date().toISOString(),
                processingTime: `${Math.round((Date.now() - req.startTime) / 1000)}s`
            }
        });

    } catch (error) {
        console.error('[API] Error in scrapeByLocation:', error);
        next(error);
    } finally {
        // CRITICAL: Clean up crawler resources to prevent memory leaks
        console.log('[API] Cleaning up crawler resources...');
        
        if (searchCrawler) {
            try {
                await searchCrawler.teardown();
                console.log('[API] Search crawler cleaned up');
            } catch (e) {
                console.error('[API] Error cleaning up search crawler:', e);
            }
        }
        
        if (detailCrawler) {
            try {
                await detailCrawler.teardown();
                console.log('[API] Detail crawler cleaned up');
            } catch (e) {
                console.error('[API] Error cleaning up detail crawler:', e);
            }
        }
    }
}
