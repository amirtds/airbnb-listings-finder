/**
 * Scraper for Airbnb listing house rules
 */

import { randomDelay, fixedDelay } from '../utils/delays.js';

/**
 * Scrape house rules from a listing
 * @param {Object} page - Playwright page instance
 * @param {string} listingId - Listing ID
 * @param {Object} requestLog - Logger instance
 * @param {number} minDelay - Minimum delay between requests
 * @param {number} maxDelay - Maximum delay between requests
 * @returns {Promise<Object|null>} House rules object
 */
export async function scrapeHouseRules(page, listingId, requestLog, minDelay, maxDelay) {
    try {
        // Add random delay before navigating to house rules
        await randomDelay(minDelay, maxDelay, requestLog);
        
        const rulesUrl = `https://www.airbnb.com/rooms/${listingId}/house-rules`;
        await page.goto(rulesUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await fixedDelay(1500);
        
        // Check if there's a "Show more" button for additional rules and click it
        try {
            const showMoreBtn = await page.$('button:has-text("Show more")');
            if (showMoreBtn) {
                await showMoreBtn.scrollIntoViewIfNeeded();
                await fixedDelay(300);
                await showMoreBtn.click({ timeout: 5000 });
                await fixedDelay(1000);
            }
        } catch (e) {
            requestLog.warning(`Could not click "Show more" for house rules: ${e.message}`);
        }
        
        // Extract house rules from the modal
        const rules = await page.evaluate(() => {
            const result = {
                checkIn: '',
                checkOut: '',
                selfCheckIn: false,
                maxGuests: 0,
                pets: false,
                quietHours: '',
                noParties: false,
                noCommercialPhotography: false,
                noSmoking: false,
                additionalRules: '',
                beforeYouLeave: []
            };
            
            // Extract check-in time
            const checkInText = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('Check-in'));
            if (checkInText) {
                result.checkIn = checkInText.textContent.replace(/Check-in\s+(after|:)\s*/i, '').trim();
            }
            
            // Extract checkout time
            const checkOutEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('Checkout'));
            if (checkOutEl) {
                result.checkOut = checkOutEl.textContent.replace(/Checkout\s+before\s*/i, '').trim();
            }
            
            // Check for self check-in
            const selfCheckInEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('Self check-in'));
            result.selfCheckIn = !!selfCheckInEl;
            
            // Extract max guests
            const guestsEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('guests maximum'));
            if (guestsEl) {
                const match = guestsEl.textContent.match(/(\d+)\s+guests?\s+maximum/i);
                if (match) result.maxGuests = parseInt(match[1]);
            }
            
            // Check for pets - if "No pets" is found, pets = false
            const petsEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('No pets'));
            result.pets = !petsEl;
            
            // Extract quiet hours
            const quietHoursEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('Quiet hours'));
            if (quietHoursEl) {
                const nextEl = quietHoursEl.nextElementSibling;
                if (nextEl && nextEl.classList.contains('s1q8hkgb')) {
                    result.quietHours = nextEl.textContent.trim();
                }
            }
            
            // Check for no parties
            const partiesEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('No parties'));
            result.noParties = !!partiesEl;
            
            // Check for no commercial photography
            const photoEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('No commercial photography'));
            result.noCommercialPhotography = !!photoEl;
            
            // Check for no smoking
            const smokingEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('No smoking'));
            result.noSmoking = !!smokingEl;
            
            // Extract additional rules - get full text after clicking "Show more"
            const additionalRulesEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('Additional rules'));
            if (additionalRulesEl) {
                const parentDiv = additionalRulesEl.closest('.c1rc5p4c');
                if (parentDiv) {
                    const rulesDiv = parentDiv.querySelector('.s1q8hkgb');
                    if (rulesDiv) {
                        // Get all text content, including after "Show more" was clicked
                        const spanContent = rulesDiv.querySelector('span span');
                        if (spanContent) {
                            result.additionalRules = spanContent.textContent.trim();
                        } else {
                            result.additionalRules = rulesDiv.textContent.trim();
                        }
                    }
                }
            }
            
            // Extract "Before you leave" items
            const beforeLeaveSection = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.includes('Before you leave'));
            if (beforeLeaveSection) {
                const section = beforeLeaveSection.closest('.ce5nonf');
                if (section) {
                    const items = section.querySelectorAll('.t1yw48g8');
                    items.forEach(item => {
                        result.beforeYouLeave.push(item.textContent.trim());
                    });
                }
            }
            
            return result;
        });
        
        requestLog.info(`Scraped house rules for listing ${listingId}`);
        return rules;
    } catch (error) {
        requestLog.error(`Failed to scrape house rules: ${error.message}`);
        return null;
    }
}
