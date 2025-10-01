/**
 * Scraper for Airbnb listing pricing information
 */

/**
 * Extract pricing information from the listing page
 * @param {Object} page - Playwright page instance
 * @returns {Promise<Object>} Pricing data object
 */
export async function extractPricing(page) {
    try {
        const pricingData = await page.evaluate(() => {
            const result = {
                pricePerNight: null,
                currency: null,
                priceBeforeDiscount: null,
                discountPercentage: null
            };

            // Method 1: Look for price in the booking panel
            const priceElements = document.querySelectorAll('[data-plugin-in-point-id="BOOK_IT_SIDEBAR"] span');
            for (const el of priceElements) {
                const text = el.textContent.trim();
                // Match patterns like "$150", "€120", "£100"
                const priceMatch = text.match(/^([€$£¥₹])\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
                if (priceMatch) {
                    result.currency = priceMatch[1];
                    result.pricePerNight = parseFloat(priceMatch[2].replace(/,/g, ''));
                    break;
                }
            }

            // Method 2: Try to find price in title area
            if (!result.pricePerNight) {
                const titleArea = document.querySelector('h1')?.parentElement?.parentElement;
                if (titleArea) {
                    const priceSpans = titleArea.querySelectorAll('span');
                    for (const span of priceSpans) {
                        const text = span.textContent.trim();
                        const priceMatch = text.match(/([€$£¥₹])\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
                        if (priceMatch) {
                            result.currency = priceMatch[1];
                            result.pricePerNight = parseFloat(priceMatch[2].replace(/,/g, ''));
                            break;
                        }
                    }
                }
            }

            // Method 3: Look for discounted price
            const discountElements = document.querySelectorAll('[data-plugin-in-point-id="BOOK_IT_SIDEBAR"] span[style*="text-decoration"]');
            for (const el of discountElements) {
                const text = el.textContent.trim();
                const priceMatch = text.match(/([€$£¥₹])\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
                if (priceMatch) {
                    result.priceBeforeDiscount = parseFloat(priceMatch[2].replace(/,/g, ''));
                    
                    // Calculate discount percentage
                    if (result.pricePerNight && result.priceBeforeDiscount) {
                        const discount = ((result.priceBeforeDiscount - result.pricePerNight) / result.priceBeforeDiscount) * 100;
                        result.discountPercentage = Math.round(discount);
                    }
                    break;
                }
            }

            return result;
        });

        console.log(`[Pricing] Price: ${pricingData.currency}${pricingData.pricePerNight || 'N/A'} per night`);
        
        return pricingData;
    } catch (error) {
        console.error(`[Pricing] Error extracting pricing: ${error.message}`);
        return {
            pricePerNight: null,
            currency: null,
            priceBeforeDiscount: null,
            discountPercentage: null
        };
    }
}
