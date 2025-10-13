/**
 * Scraper for Airbnb listing amenities
 */

import { randomDelay, fixedDelay } from '../utils/delays.js';

/**
 * Scrape amenities from a listing
 * @param {Object} page - Playwright page instance
 * @param {string} listingId - Listing ID
 * @param {Object} requestLog - Logger instance
 * @param {number} minDelay - Minimum delay between requests
 * @param {number} maxDelay - Maximum delay between requests
 * @returns {Promise<Array>} Array of amenities
 */
export async function scrapeAmenities(page, listingId, requestLog, minDelay, maxDelay) {
    try {
        // Navigate to amenities page (no delay needed - browser handles rate limiting)
        const amenitiesUrl = `https://www.airbnb.com/rooms/${listingId}/amenities`;
        await page.goto(amenitiesUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await fixedDelay(400); // Reduced from 1500ms - just enough for content to render
        
        // Scroll to bottom of modal to load all amenities
        await page.evaluate(async () => {
            const scrollableDiv = document.querySelector('[data-testid="pdp-reviews-modal-scrollable-panel"], .dir.dir-ltr');
            if (scrollableDiv) {
                scrollableDiv.scrollTo(0, scrollableDiv.scrollHeight);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        });
        
        // Extract amenities - try multiple selectors
        const amenities = await page.evaluate(() => {
            const result = [];
            
            // Method 1: Look for amenity items with pdp_v3_ prefix
            const amenityItems = document.querySelectorAll('[id^="pdp_v3_"]');
            amenityItems.forEach(item => {
                const titleEl = item.querySelector('[id$="-row-title"]');
                
                if (titleEl) {
                    const name = titleEl.textContent.trim();
                    if (name && !result.includes(name)) {
                        result.push(name);
                    }
                }
            });
            
            // Method 2: If no amenities found, try alternative selector
            if (result.length === 0) {
                const altAmenityItems = document.querySelectorAll('[data-testid*="amenity"]');
                altAmenityItems.forEach(item => {
                    const text = item.textContent.trim();
                    if (text && !result.includes(text)) {
                        result.push(text);
                    }
                });
            }
            
            return result;
        });
        
        requestLog.info(`Found ${amenities.length} amenities`);
        return amenities;
    } catch (error) {
        requestLog.error(`Failed to scrape amenities: ${error.message}`);
        return [];
    }
}
