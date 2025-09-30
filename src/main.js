/**
 * Airbnb Listings Finder - Main Entry Point
 * 
 * This actor scrapes Airbnb listings for a given location and extracts detailed information
 * including amenities, reviews, house rules, and host profiles.
 */

import { Actor } from 'apify';
import { log } from 'crawlee';
import { createSearchCrawler } from './crawlers/searchCrawler.js';
import { createDetailCrawler } from './crawlers/detailCrawler.js';

// Main actor entry point
await Actor.init();

try {
    // Get input from Apify (or use defaults for local testing)
    const input = await Actor.getInput() ?? {};
    const { 
        location, 
        numberOfListings = 10,
        minDelayBetweenRequests = 3000, // 3 seconds minimum delay
        maxDelayBetweenRequests = 8000  // 8 seconds maximum delay
    } = input;

    // Validate input
    if (!location) {
        throw new Error('Location parameter is required!');
    }

    log.info(`Starting Airbnb listings search for: ${location}`);
    log.info(`Target number of listings: ${numberOfListings}`);
    log.info(`Delay between requests: ${minDelayBetweenRequests}-${maxDelayBetweenRequests}ms`);

    // Store found listings (URLs only in phase 1)
    const foundListings = [];
    
    // Construct Airbnb search URL
    const searchUrl = `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes`;
    log.info(`Search URL: ${searchUrl}`);

    // PHASE 1: Collect listing URLs from search results
    log.info('=== PHASE 1: Collecting listing URLs ===');
    const searchCrawler = createSearchCrawler(foundListings, numberOfListings, location);
    await searchCrawler.run([searchUrl]);

    // Limit results to requested number
    const finalListings = foundListings.slice(0, numberOfListings);
    log.info(`Successfully collected ${finalListings.length} listing URLs`);

    // PHASE 2: Scrape detailed data from each listing
    log.info('=== PHASE 2: Scraping detailed listing data ===');
    
    // Store detailed listing data
    const detailedListings = [];
    
    // Create detail crawler
    const detailCrawler = createDetailCrawler(
        detailedListings,
        numberOfListings,
        minDelayBetweenRequests,
        maxDelayBetweenRequests
    );
    
    // Prepare detail requests
    const detailRequests = finalListings.map(listing => ({
        url: listing.listingUrl,
        userData: {
            listingId: listing.listingId,
            location: listing.location
        }
    }));
    
    // Run detail crawler
    await detailCrawler.run(detailRequests);
    
    log.info(`Successfully scraped ${detailedListings.length} listings with detailed data`);

    // Push results to Apify dataset
    await Actor.pushData(detailedListings);

    // Set output
    await Actor.setValue('OUTPUT', {
        success: true,
        location: location,
        requestedCount: numberOfListings,
        foundCount: detailedListings.length,
        listings: detailedListings
    });

    log.info('Actor finished successfully');

} catch (error) {
    log.error('Actor failed with error:', error);
    
    // Set error output
    await Actor.setValue('OUTPUT', {
        success: false,
        error: error.message
    });
    
    throw error;
} finally {
    await Actor.exit();
}
