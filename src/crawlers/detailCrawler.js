/**
 * Detail crawler for scraping full listing information
 */

import { PlaywrightCrawler } from 'crawlee';
import { getBrowserLaunchOptions, getPreNavigationHooks } from '../utils/browserConfig.js';
import { randomDelay, fixedDelay } from '../utils/delays.js';
import { scrapeAmenities } from '../scrapers/amenities.js';
import { scrapeReviews } from '../scrapers/reviews.js';
import { scrapeHouseRules } from '../scrapers/houseRules.js';
import { scrapeHostProfile } from '../scrapers/hostProfile.js';
import { extractLocation } from '../scrapers/location.js';
import { extractPricing } from '../scrapers/pricing.js';
import {
    extractTitle,
    extractDescription,
    extractImages,
    extractHostProfileId,
    extractCoHosts,
    extractPropertyDetails,
    isGuestFavorite,
    isSuperhost,
    extractReviewScore
} from '../scrapers/listingDetails.js';

/**
 * Create and configure the detail crawler
 * @param {Array} detailedListings - Array to store detailed listings
 * @param {number} numberOfListings - Target number of listings
 * @param {number} minDelayBetweenRequests - Minimum delay in ms
 * @param {number} maxDelayBetweenRequests - Maximum delay in ms
 * @returns {PlaywrightCrawler} Configured crawler instance
 */
export function createDetailCrawler(
    detailedListings,
    numberOfListings,
    minDelayBetweenRequests,
    maxDelayBetweenRequests,
    quickMode = false
) {
    // Increase concurrency for faster processing
    // Conservative concurrency to prevent resource exhaustion
    const concurrency = quickMode ? 3 : 2;
    
    return new PlaywrightCrawler({
        // Set high limit to avoid premature shutdown
        maxRequestsPerCrawl: Math.max(numberOfListings * 10, 100),
        headless: true,
        
        // Increased concurrency for parallel processing
        maxConcurrency: concurrency,
        minConcurrency: 1,
        maxRequestsPerMinute: quickMode ? 20 : 12,
        
        // CRITICAL: Ensure browsers are closed after each page
        browserPoolOptions: {
            closeInactiveBrowserAfterSecs: 30,
            operationTimeoutSecs: 60,
        },
        
        launchContext: getBrowserLaunchOptions(),
        preNavigationHooks: getPreNavigationHooks(),
        
        async requestHandler({ request, page, log: requestLog }) {
            const listingId = request.userData.listingId;
            const quickModeEnabled = request.userData.quickMode || quickMode;
            requestLog.info(`Scraping details for listing ${listingId}: ${request.url}`);
            
            try {
                // Optimized delays for faster processing
                const minDelay = quickModeEnabled ? 300 : Math.min(minDelayBetweenRequests, 1000);
                const maxDelay = quickModeEnabled ? 600 : Math.min(maxDelayBetweenRequests, 1500);
                await randomDelay(minDelay, maxDelay, requestLog);
                
                // Wait for page to load with reduced timeout
                await page.waitForLoadState('domcontentloaded');
                // Wait for title to appear as indication page is ready
                await page.waitForSelector('h1', { timeout: 5000 }).catch(() => {});
                await fixedDelay(quickModeEnabled ? 500 : 800);
                
                // Extract main listing details
                requestLog.info(`Extracting main details for listing ${listingId}`);
                const title = await extractTitle(page);
                const description = await extractDescription(page, requestLog);
                const images = await extractImages(page);
                const hostProfileId = await extractHostProfileId(page);
                const coHosts = await extractCoHosts(page);
                const propertyDetails = await extractPropertyDetails(page);
                const guestFavorite = await isGuestFavorite(page);
                const superhost = await isSuperhost(page);
                
                // Extract location information
                requestLog.info(`Extracting location for listing ${listingId}`);
                const locationData = await extractLocation(page);
                
                // Extract review scores (overall rating and count)
                requestLog.info(`Extracting review scores for listing ${listingId}`);
                const reviewScore = await extractReviewScore(page, listingId);
                
                // Extract pricing information (only if not in quick mode)
                let pricing = null;
                if (!quickModeEnabled) {
                    requestLog.info(`Extracting pricing for listing ${listingId}`);
                    pricing = await extractPricing(page, listingId);
                } else {
                    requestLog.info(`Skipping pricing extraction in quick mode for listing ${listingId}`);
                }
                
                // Scrape amenities with optimized delays
                requestLog.info(`Scraping amenities for listing ${listingId}`);
                const amenities = await scrapeAmenities(
                    page,
                    listingId,
                    requestLog,
                    minDelay,
                    maxDelay
                );
                
                // Scrape reviews with optimized delays (quick mode skips multiple categories)
                // Retry up to 2 times if reviews are empty
                requestLog.info(`Scraping reviews for listing ${listingId}`);
                let reviews = await scrapeReviews(
                    page,
                    listingId,
                    requestLog,
                    minDelay,
                    maxDelay,
                    quickModeEnabled
                );
                
                // Validate reviews and retry if empty
                const totalReviews = Object.values(reviews.reviews || {}).reduce((sum, arr) => sum + (arr?.length || 0), 0);
                if (totalReviews === 0 && reviewScore?.reviewsCount > 0) {
                    requestLog.warning(`No reviews found but listing has ${reviewScore.reviewsCount} reviews. Retrying...`);
                    
                    // Retry once more
                    await fixedDelay(1000);
                    reviews = await scrapeReviews(
                        page,
                        listingId,
                        requestLog,
                        minDelay,
                        maxDelay,
                        quickModeEnabled
                    );
                    
                    const retryTotal = Object.values(reviews.reviews || {}).reduce((sum, arr) => sum + (arr?.length || 0), 0);
                    if (retryTotal === 0) {
                        requestLog.warning(`Retry failed. Still no reviews found for listing ${listingId}`);
                    } else {
                        requestLog.info(`✓ Retry successful! Found ${retryTotal} reviews on second attempt`);
                    }
                }
                
                // Scrape house rules with optimized delays
                requestLog.info(`Scraping house rules for listing ${listingId}`);
                const houseRules = await scrapeHouseRules(
                    page,
                    listingId,
                    requestLog,
                    minDelay,
                    maxDelay
                );
                
                // Scrape host profile with optimized delays (skip in quick mode)
                let hostProfile = null;
                if (!quickModeEnabled) {
                    requestLog.info(`Scraping host profile for listing ${listingId}`);
                    hostProfile = await scrapeHostProfile(
                        page,
                        hostProfileId,
                        requestLog,
                        minDelay,
                        maxDelay
                    );
                } else {
                    requestLog.info(`Skipping host profile in quick mode for listing ${listingId}`);
                }
                
                // Compile detailed listing data
                const detailedListing = {
                    listingId: listingId,
                    listingUrl: request.url,
                    searchLocation: request.userData.location,  // Original search location
                    location: locationData,  // Detailed location data
                    title: title,
                    description: description,
                    images: images,
                    hostProfileId: hostProfileId,
                    hostProfile: hostProfile,
                    coHosts: coHosts,
                    maxGuests: propertyDetails.maxGuests,
                    bedrooms: propertyDetails.bedrooms,
                    bathrooms: propertyDetails.bathrooms,
                    isGuestFavorite: guestFavorite,
                    isSuperhost: superhost,
                    overallRating: reviewScore?.overallRating || null,
                    reviewsCount: reviewScore?.reviewsCount || null,
                    pricing: pricing,
                    amenities: amenities,
                    reviews: reviews,
                    houseRules: houseRules
                };
                
                detailedListings.push(detailedListing);
                requestLog.info(`✓ Successfully scraped listing ${listingId} (${detailedListings.length}/${numberOfListings})`);
                
            } catch (error) {
                requestLog.error(`Failed to scrape listing ${listingId}:`, error.message);
                // Add partial data with error
                detailedListings.push({
                    listingId: listingId,
                    listingUrl: request.url,
                    searchLocation: request.userData.location,
                    location: null,
                    overallRating: null,
                    reviewsCount: null,
                    pricing: null,
                    error: error.message
                });
            }
        },
        
        failedRequestHandler({ request, log: errorLog }, error) {
            errorLog.error(`Request ${request.url} failed:`, error);
        },
        
        requestHandlerTimeoutSecs: 180,
        maxRequestRetries: 2,
        
        // Ensure proper cleanup on crawler shutdown
        autoscaledPoolOptions: {
            maxConcurrency: concurrency,
        },
    });
}
