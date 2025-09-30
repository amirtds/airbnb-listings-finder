/**
 * Example API Client for Airbnb Listings Scraper
 * 
 * This demonstrates how to use the API endpoints
 */

const API_BASE_URL = 'http://localhost:3000';

/**
 * Scrape listings by location
 */
async function scrapeByLocation(location, numberOfListings = 10) {
    try {
        console.log(`\n🔍 Scraping listings for: ${location}`);
        console.log(`📊 Requesting ${numberOfListings} listings...\n`);

        const response = await fetch(`${API_BASE_URL}/api/scrape/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                location,
                numberOfListings,
                minDelayBetweenRequests: 3000,
                maxDelayBetweenRequests: 8000
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log(`✅ Success! Found ${data.data.foundCount} listings`);
            console.log(`⏱️  Processing time: ${data.meta.processingTime}`);
            console.log(`\n📋 Listings:`);
            
            data.data.listings.forEach((listing, index) => {
                console.log(`\n${index + 1}. ${listing.title}`);
                console.log(`   ID: ${listing.listingId}`);
                console.log(`   URL: ${listing.listingUrl}`);
                console.log(`   Guests: ${listing.maxGuests} | Bedrooms: ${listing.bedrooms} | Bathrooms: ${listing.bathrooms}`);
                console.log(`   Superhost: ${listing.isSuperhost ? '⭐ Yes' : 'No'}`);
                console.log(`   Guest Favorite: ${listing.isGuestFavorite ? '❤️  Yes' : 'No'}`);
                console.log(`   Amenities: ${listing.amenities.length}`);
                console.log(`   Reviews: ${listing.reviews.length}`);
            });

            return data.data;
        } else {
            console.error(`❌ Error: ${data.error}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Request failed: ${error.message}`);
        return null;
    }
}

/**
 * Scrape individual listing by ID
 */
async function scrapeByListingId(listingId) {
    try {
        console.log(`\n🔍 Scraping listing ID: ${listingId}\n`);

        const response = await fetch(`${API_BASE_URL}/api/scrape/listing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                listingId,
                minDelayBetweenRequests: 3000,
                maxDelayBetweenRequests: 8000
            })
        });

        const data = await response.json();

        if (data.success) {
            const listing = data.data;
            console.log(`✅ Success!`);
            console.log(`⏱️  Processing time: ${data.meta.processingTime}\n`);
            
            console.log(`📋 Listing Details:`);
            console.log(`   Title: ${listing.title}`);
            console.log(`   URL: ${listing.listingUrl}`);
            console.log(`   Description: ${listing.description?.substring(0, 100)}...`);
            console.log(`\n🏠 Property:`);
            console.log(`   Max Guests: ${listing.maxGuests}`);
            console.log(`   Bedrooms: ${listing.bedrooms}`);
            console.log(`   Bathrooms: ${listing.bathrooms}`);
            console.log(`   Superhost: ${listing.isSuperhost ? '⭐ Yes' : 'No'}`);
            console.log(`   Guest Favorite: ${listing.isGuestFavorite ? '❤️  Yes' : 'No'}`);
            
            console.log(`\n👤 Host:`);
            if (listing.hostProfile) {
                console.log(`   Name: ${listing.hostProfile.name}`);
                console.log(`   Superhost: ${listing.hostProfile.isSuperhost ? '⭐ Yes' : 'No'}`);
                console.log(`   Rating: ${listing.hostProfile.rating}`);
                console.log(`   Reviews: ${listing.hostProfile.reviewsCount}`);
                console.log(`   Years Hosting: ${listing.hostProfile.yearsHosting}`);
            }

            console.log(`\n🎯 Amenities: ${listing.amenities.length}`);
            listing.amenities.slice(0, 5).forEach(amenity => {
                console.log(`   • ${amenity.name}`);
            });
            if (listing.amenities.length > 5) {
                console.log(`   ... and ${listing.amenities.length - 5} more`);
            }

            console.log(`\n⭐ Reviews: ${listing.reviews.length}`);
            listing.reviews.slice(0, 3).forEach(review => {
                console.log(`   • ${review.name} (${review.score}/5): ${review.text?.substring(0, 50)}...`);
            });
            if (listing.reviews.length > 3) {
                console.log(`   ... and ${listing.reviews.length - 3} more`);
            }

            console.log(`\n📜 House Rules:`);
            if (listing.houseRules) {
                console.log(`   Check-in: ${listing.houseRules.checkIn}`);
                console.log(`   Check-out: ${listing.houseRules.checkOut}`);
                console.log(`   Self Check-in: ${listing.houseRules.selfCheckIn ? 'Yes' : 'No'}`);
                console.log(`   Pets: ${listing.houseRules.pets ? 'Allowed' : 'Not Allowed'}`);
                console.log(`   Parties: ${listing.houseRules.noParties ? 'Not Allowed' : 'Allowed'}`);
                console.log(`   Smoking: ${listing.houseRules.noSmoking ? 'Not Allowed' : 'Allowed'}`);
            }

            return data.data;
        } else {
            console.error(`❌ Error: ${data.error}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Request failed: ${error.message}`);
        return null;
    }
}

/**
 * Check API health
 */
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        
        if (data.status === 'ok') {
            console.log(`✅ API is healthy`);
            console.log(`   Service: ${data.service}`);
            console.log(`   Version: ${data.version}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ API is not reachable: ${error.message}`);
        return false;
    }
}

// Example usage
async function main() {
    console.log('🚀 Airbnb Listings Scraper API Client\n');
    console.log('=' .repeat(50));

    // Check if API is running
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        console.log('\n⚠️  Please start the API server first:');
        console.log('   npm run api\n');
        return;
    }

    console.log('\n' + '='.repeat(50));

    // Example 1: Scrape by location
    await scrapeByLocation('Miami, FL', 5);

    console.log('\n' + '='.repeat(50));

    // Example 2: Scrape individual listing
    // Replace with an actual listing ID
    // await scrapeByListingId('12345678');

    console.log('\n✨ Done!\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

// Export functions for use in other modules
export { scrapeByLocation, scrapeByListingId, checkHealth };
