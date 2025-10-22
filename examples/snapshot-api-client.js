/**
 * Example API client for the Site Content Snapshot endpoint
 * 
 * This endpoint returns only:
 * - HTML snapshot (site-content div)
 * - Reviews
 * - House rules
 * - Images
 * - Amenities
 */

const API_BASE_URL = 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN || 'default-dev-token-change-in-production';

/**
 * Scrape site content snapshot for a listing
 * @param {string} listingId - The Airbnb listing ID
 * @param {number} minDelay - Minimum delay between requests in ms (default: 500)
 * @param {number} maxDelay - Maximum delay between requests in ms (default: 1000)
 * @returns {Promise<Object>} Snapshot data
 */
async function scrapeSiteContentSnapshot(listingId, minDelay = 500, maxDelay = 1000) {
    const response = await fetch(`${API_BASE_URL}/api/scrape/listing/snapshot`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`
        },
        body: JSON.stringify({
            listingId: listingId,
            minDelayBetweenRequests: minDelay,
            maxDelayBetweenRequests: maxDelay
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`API Error: ${error.error || response.statusText}`);
    }

    return await response.json();
}

// Example usage
async function main() {
    try {
        console.log('Starting site content snapshot scrape...\n');

        // Example listing ID - replace with actual listing ID
        const listingId = '12345678';
        
        const result = await scrapeSiteContentSnapshot(listingId);

        if (result.success) {
            console.log('✓ Scrape successful!\n');
            console.log('Data structure:');
            console.log('- listingId:', result.data.listingId);
            console.log('- listingUrl:', result.data.listingUrl);
            console.log('- htmlSnapshot:', result.data.htmlSnapshot ? `${result.data.htmlSnapshot.length} characters` : 'null');
            console.log('- images:', result.data.images?.length || 0, 'images');
            console.log('- amenities:', result.data.amenities?.length || 0, 'amenities');
            console.log('- reviews:', result.data.reviews?.length || 0, 'reviews');
            console.log('- rules:', result.data.rules ? 'present' : 'null');
            console.log('\nMeta:');
            console.log('- Scraped at:', result.meta.scrapedAt);
            console.log('- Processing time:', result.meta.processingTime);

            // Example: Access specific data
            if (result.data.images && result.data.images.length > 0) {
                console.log('\nFirst image URL:', result.data.images[0]);
            }

            if (result.data.amenities && result.data.amenities.length > 0) {
                console.log('\nFirst amenity:', result.data.amenities[0]);
            }

            if (result.data.reviews && result.data.reviews.length > 0) {
                console.log('\nFirst review:', {
                    author: result.data.reviews[0].author,
                    rating: result.data.reviews[0].rating,
                    comment: result.data.reviews[0].comment?.substring(0, 100) + '...'
                });
            }

        } else {
            console.error('✗ Scrape failed:', result.error);
        }

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { scrapeSiteContentSnapshot };
