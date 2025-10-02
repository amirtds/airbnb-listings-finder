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

        // Navigating to availability calendar (console.log removed for performance)
        
        // Navigate to the calendar view
        const calendarUrl = `https://www.airbnb.com/rooms/${listingId}#availability-calendar`;
        await page.goto(calendarUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Smart wait: Wait for calendar to appear instead of fixed delay
        await page.waitForSelector('td[role="button"]', { timeout: 5000 }).catch(() => {
            console.log('[Pricing] Calendar not found, using fallback');
        });
        await fixedDelay(800); // Reduced from 3000ms - just enough for calendar to stabilize

        // Find and click available dates
        
        // Find available dates (not disabled, not checkout-only)
        const availableDates = await page.evaluate(() => {
            const dates = [];
            const calendarDays = document.querySelectorAll('td[role="button"]');
            
            for (const day of calendarDays) {
                const isDisabled = day.getAttribute('aria-disabled') === 'true';
                const ariaLabel = day.getAttribute('aria-label') || '';
                const isCheckoutOnly = ariaLabel.includes('only available for checkout');
                const testId = day.querySelector('[data-testid]')?.getAttribute('data-testid');
                
                // Only include days that are available for check-in
                if (!isDisabled && !isCheckoutOnly && testId) {
                    dates.push({
                        testId: testId,
                        ariaLabel: ariaLabel
                    });
                }
                
                // Stop after finding enough dates
                if (dates.length >= 10) break;
            }
            
            return dates;
        });

        // Found available dates (log removed for performance)

        let calendarPricing = {
            currency: null,
            totalPrice: null
        };

        // Try to select dates and get pricing
        if (availableDates.length >= 4) {
            try {
                // Click check-in date using JavaScript (bypasses viewport issues)
                const checkInTestId = availableDates[0].testId;
                await page.evaluate((testId) => {
                    // Find all elements with this testId and click the visible one
                    const elements = document.querySelectorAll(`[data-testid="${testId}"]`);
                    for (const el of elements) {
                        const rect = el.getBoundingClientRect();
                        // Check if element is in viewport
                        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
                            el.click();
                            return;
                        }
                    }
                    // If none in viewport, scroll first one into view and click
                    if (elements[0]) {
                        elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => elements[0].click(), 300);
                    }
                }, checkInTestId);
                // Check-in selected (log removed for performance)
                await fixedDelay(600); // Reduced from 1500ms

                // Click check-out date using JavaScript
                const checkOutTestId = availableDates[3].testId;
                await page.evaluate((testId) => {
                    const elements = document.querySelectorAll(`[data-testid="${testId}"]`);
                    for (const el of elements) {
                        const rect = el.getBoundingClientRect();
                        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
                            el.click();
                            return;
                        }
                    }
                    if (elements[0]) {
                        elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => elements[0].click(), 300);
                    }
                }, checkOutTestId);
                // Check-out selected (log removed for performance)
                await fixedDelay(800); // Reduced from 2000ms

                // Extract the price that appears
                calendarPricing = await page.evaluate(() => {
                    const result = {
                        currency: null,
                        totalPrice: null
                    };

                    // Look for price breakdown text like "$309 for 3 nights"
                    const priceElements = document.querySelectorAll('span, div');
                    for (const el of priceElements) {
                        const text = el.textContent || '';
                        
                        // Match patterns like "$309 for 3 nights" or "$309\nfor 3 nights"
                        const priceMatch = text.match(/([€$£¥₹])\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:for\s*3\s*nights?)?/i);
                        if (priceMatch && text.includes('3 night')) {
                            result.currency = priceMatch[1];
                            result.totalPrice = parseFloat(priceMatch[2].replace(/,/g, ''));
                            break;
                        }
                    }

                    return result;
                });

                // Price extracted from calendar (log removed for performance)
            } catch (error) {
                // Error selecting dates (log removed for performance)
            }
        }

        if (calendarPricing.totalPrice && calendarPricing.totalPrice > 0) {
            pricingData.currency = calendarPricing.currency;
            pricingData.totalFor3Nights = calendarPricing.totalPrice;
            pricingData.pricePerNight = Math.round(calendarPricing.totalPrice / 3);
            
            // Pricing found from calendar (log removed for performance)
        } else {
            // Fallback: Try to extract from booking panel on main page
            
            await page.goto(`https://www.airbnb.com/rooms/${listingId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await fixedDelay(800); // Reduced from 2000ms
            
            const fallbackPricing = await page.evaluate(() => {
                const result = {
                    currency: null,
                    pricePerNight: null
                };

                // Look for price in the booking panel
                const priceElements = document.querySelectorAll('[data-plugin-in-point-id="BOOK_IT_SIDEBAR"] span, [data-section-id="BOOK_IT_SIDEBAR"] span');
                for (const el of priceElements) {
                    const text = el.textContent.trim();
                    const priceMatch = text.match(/([€$£¥₹])\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
                    if (priceMatch) {
                        result.currency = priceMatch[1];
                        result.pricePerNight = parseFloat(priceMatch[2].replace(/,/g, ''));
                        break;
                    }
                }

                return result;
            });

            if (fallbackPricing.pricePerNight) {
                pricingData.currency = fallbackPricing.currency;
                pricingData.pricePerNight = fallbackPricing.pricePerNight;
                // Pricing found from booking panel (log removed for performance)
            }
        }

        return pricingData;
    } catch (error) {
        console.error(`[Pricing] Error extracting pricing: ${error.message}`);
        return {
            pricePerNight: null,
            currency: null,
            totalFor3Nights: null,
            priceBeforeDiscount: null,
            discountPercentage: null
        };
    }
}
