/**
 * Express API Server for Airbnb Listings Scraper
 * 
 * Endpoints:
 * - GET /health - Health check
 * - POST /api/search/listings - Search listings by location (links only, all pages)
 * - POST /api/scrape/search - Scrape listings by location (with details)
 * - POST /api/scrape/listing - Scrape individual listing by ID
 * - POST /api/scrape/listing/snapshot - Scrape site content snapshot (HTML, reviews, rules, images, amenities)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { scrapeByLocation } from './controllers/searchController.js';
import { scrapeByListingId, scrapeSiteContentSnapshot } from './controllers/listingController.js';
import { searchListingsByLocation } from './controllers/listingsSearchController.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authenticate } from './middleware/auth.js';
import { getBrowserProcessCount, killOrphanedBrowsers } from '../utils/processCleanup.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health check endpoint (no auth required)
app.get('/health', async (req, res) => {
    const browserCount = await getBrowserProcessCount();
    res.json({ 
        status: 'ok', 
        service: 'Airbnb Listings Scraper API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        authentication: process.env.API_TOKENS ? 'enabled' : 'disabled (using default token)',
        browserProcesses: browserCount,
        warning: browserCount > 10 ? 'High number of browser processes detected' : null
    });
});

// Cleanup endpoint to kill orphaned browsers (protected with auth)
app.post('/api/cleanup', authenticate, async (req, res) => {
    try {
        const beforeCount = await getBrowserProcessCount();
        console.log(`[Cleanup] Browser processes before cleanup: ${beforeCount}`);
        
        await killOrphanedBrowsers();
        
        // Wait a bit for processes to die
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterCount = await getBrowserProcessCount();
        console.log(`[Cleanup] Browser processes after cleanup: ${afterCount}`);
        
        res.json({
            success: true,
            message: 'Cleanup completed',
            processesKilled: beforeCount - afterCount,
            remainingProcesses: afterCount
        });
    } catch (error) {
        console.error('[Cleanup] Error during cleanup:', error);
        res.status(500).json({
            success: false,
            error: 'Cleanup failed',
            message: error.message
        });
    }
});

// API Routes (protected with authentication)
app.post('/api/search/listings', authenticate, searchListingsByLocation);
app.post('/api/scrape/search', authenticate, scrapeByLocation);
app.post('/api/scrape/listing/snapshot', authenticate, scrapeSiteContentSnapshot);
app.post('/api/scrape/listing', authenticate, scrapeByListingId);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
            'POST /api/search/listings',
            'POST /api/scrape/search',
            'POST /api/scrape/listing',
            'POST /api/scrape/listing/snapshot',
            'POST /api/cleanup',
            'GET /health'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Airbnb Scraper API running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 Search listings (links only): http://localhost:${PORT}/api/search/listings`);
    console.log(`📍 Search endpoint (with details): http://localhost:${PORT}/api/scrape/search`);
    console.log(`📍 Listing endpoint: http://localhost:${PORT}/api/scrape/listing`);
    console.log(`📍 Snapshot endpoint: http://localhost:${PORT}/api/scrape/listing/snapshot`);
});

export default app;
