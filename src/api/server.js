/**
 * REST API Server for Airbnb Listings Scraper
 * 
 * Endpoints:
 * - POST /api/scrape/search - Scrape listings by location
 * - POST /api/scrape/listing - Scrape individual listing by ID
 */

import express from 'express';
import cors from 'cors';
import { scrapeByLocation } from './controllers/searchController.js';
import { scrapeByListingId } from './controllers/listingController.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Airbnb Listings Scraper API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.post('/api/scrape/search', scrapeByLocation);
app.post('/api/scrape/listing', scrapeByListingId);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
            'POST /api/scrape/search',
            'POST /api/scrape/listing',
            'GET /health'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Airbnb Scraper API running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 Search endpoint: http://localhost:${PORT}/api/scrape/search`);
    console.log(`📍 Listing endpoint: http://localhost:${PORT}/api/scrape/listing`);
});

export default app;
