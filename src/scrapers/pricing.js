/**
 * Scraper for Airbnb listing pricing information
 */

import { fixedDelay } from '../utils/delays.js';

/**
 * Extract pricing information from the availability calendar
 * @param {Object} page - Playwright page instance
 * @param {string} listingId - Listing ID
 * @returns {Promise<Object>} Pricing data object
 */
export async function extractPricing(page, listingId) {
    try {
        const pricingData = {
            pricePerNight: null,
            currency: null,
            totalFor3Nights: null,
            priceBeforeDiscount: null,
            discountPercentage: null
        };

        // FAST METHOD: Extract price directly from current page without navigation
        const quickPricing = await page.evaluate(() => {
            const result = {
                currency: null,
                pricePerNight: null
            };

            // Method 1: Look for price with "night" in booking panel or anywhere
            const allElements = document.querySelectorAll('span, div');
            for (const el of allElements) {
                const text = el.textContent.trim();
                // Skip if it says "Add dates"
                if (text.includes('Add dates')) continue;
                
                // Match patterns like "$141 night", "$141 / night", "$141/night"
                const nightMatch = text.match(/([€$£¥₹])\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/\s*)?night/i);
                if (nightMatch) {
                    result.currency = nightMatch[1];
                    result.pricePerNight = parseFloat(nightMatch[2].replace(/,/g, ''));
                    break;
                }
            }

            // Method 2: Look in structured pricing data attributes
            if (!result.pricePerNight) {
                const priceElements = document.querySelectorAll('[data-testid*="price"], [class*="price"]');
                for (const el of priceElements) {
                    const text = el.textContent.trim();
                    if (text.includes('Add dates')) continue;
                    
                    const match = text.match(/([€$£¥₹])\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
                    if (match && text.toLowerCase().includes('night')) {
                        result.currency = match[1];
                        result.pricePerNight = parseFloat(match[2].replace(/,/g, ''));
                        break;
                    }
                }
            }

            return result;
        });

        if (quickPricing.pricePerNight && quickPricing.pricePerNight > 0) {
            pricingData.currency = quickPricing.currency;
            pricingData.pricePerNight = quickPricing.pricePerNight;
            console.log(`[Pricing] Found price: ${quickPricing.currency}${quickPricing.pricePerNight}/night`);
            return pricingData;
        }

        // FALLBACK: If quick method fails, add dates to URL and extract price
        console.log('[Pricing] Quick method failed, trying with URL dates...');
        
        // Calculate check-in (1 month from now) and check-out (1 month + 3 nights)
        const checkInDate = new Date();
        checkInDate.setMonth(checkInDate.getMonth() + 1); // 1 month from now
        const checkIn = checkInDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        
        const checkOutDate = new Date(checkInDate);
        checkOutDate.setDate(checkOutDate.getDate() + 3); // 3 nights
        const checkOut = checkOutDate.toISOString().split('T')[0];
        
        // Navigate with dates in URL
        const urlWithDates = `https://www.airbnb.com/rooms/${listingId}?check_in=${checkIn}&check_out=${checkOut}`;
        await page.goto(urlWithDates, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait for pricing to load
        await fixedDelay(800); // Wait for price to render

        // Extract price from page with dates
        let calendarPricing = await page.evaluate(() => {
            const result = {
                currency: null,
                totalPrice: null
            };

            // Look for price breakdown text like "$856 for 3 nights"
            const allText = document.body.innerText;
            
            // Method 1: Look for exact pattern "$XXX for 3 nights"
            const exactMatch = allText.match(/([€$£¥₹])\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s+for\s+3\s+nights?/i);
            if (exactMatch) {
                result.currency = exactMatch[1];
                result.totalPrice = parseFloat(exactMatch[2].replace(/,/g, ''));
                return result;
            }
            
            // Method 2: Look in specific elements
            const priceElements = document.querySelectorAll('span.a8jt5op, span[class*="price"], div[class*="price"], span._pf2f4z');
            for (const el of priceElements) {
                const text = el.textContent || '';
                if (text.includes('for 3 night')) {
                    const priceMatch = text.match(/([€$£¥₹])\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
                    if (priceMatch) {
                        result.currency = priceMatch[1];
                        result.totalPrice = parseFloat(priceMatch[2].replace(/,/g, ''));
                        break;
                    }
                }
            }

            return result;
        });

        if (calendarPricing.totalPrice && calendarPricing.totalPrice > 0) {
            pricingData.currency = calendarPricing.currency;
            pricingData.totalFor3Nights = calendarPricing.totalPrice;
            pricingData.pricePerNight = Math.round(calendarPricing.totalPrice / 3);
            
            // Pricing found from calendar (log removed for performance)
        }

        return pricingData;
    } catch (error) {
        console.error(`[Pricing] Error: ${error.message}`);
        return {
            pricePerNight: null,
            currency: null,
            totalFor3Nights: null,
            priceBeforeDiscount: null,
            discountPercentage: null
        };
    }
}

/**
 * FAST pricing extraction - extracts from current page without navigation
 * Use this for bulk scraping to save time
 */
export async function extractPricingFast(page) {
    try {
        const pricing = await page.evaluate(() => {
            const result = {
                currency: null,
                pricePerNight: null
            };

            // Look for price with "night" keyword anywhere on page
            const allElements = document.querySelectorAll('span, div');
            for (const el of allElements) {
                const text = el.textContent.trim();
                // Skip if it says "Add dates"
                if (text.includes('Add dates')) continue;
                
                // Match patterns like "$141 night", "$141 / night", "$141/night"
                const nightMatch = text.match(/([€$£¥₹])\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/\s*)?night/i);
                if (nightMatch) {
                    result.currency = nightMatch[1];
                    result.pricePerNight = parseFloat(nightMatch[2].replace(/,/g, ''));
                    break;
                }
            }

            return result;
        });

        return {
            pricePerNight: pricing.pricePerNight,
            currency: pricing.currency,
            totalFor3Nights: null,
            priceBeforeDiscount: null,
            discountPercentage: null
        };
    } catch (error) {
        return {
            pricePerNight: null,
            currency: null,
            totalFor3Nights: null,
            priceBeforeDiscount: null,
            discountPercentage: null
        };
    }
}
