# Changelog

All notable changes to this project will be documented in this file.

---

## [1.1.0] - 2025-09-30

### ✨ Added
- **Authentication**: Bearer token authentication for all API endpoints
- **Environment Variables**: Support for `.env` file configuration with `dotenv`
- **Deployment Guide**: Complete Ubuntu VPS deployment documentation (`UBUNTU_DEPLOYMENT.md`)
- **Enhanced Logging**: Better debug logging for title, description, and image extraction

### 🚀 Improved
- **Performance**: 3x faster individual listing scraping (reduced from 35-45s to 10-15s)
  - Reduced delays from 3-8s to 0.5-1s for individual listing endpoint
  - Faster page navigation (2s instead of 3s)
- **Title Extraction**: Added 3 fallback methods for more robust title detection
- **Image Extraction**: Multiple extraction methods for better image discovery
- **Amenities**: Simplified to array of strings instead of objects (removed unused `description` field)

### 🔧 Changed
- **Amenities Structure**: Changed from `[{name: string, description: string}]` to `string[]`
  - **Before**: `[{"name": "WiFi", "description": null}, {"name": "Kitchen", "description": null}]`
  - **After**: `["WiFi", "Kitchen"]`
- **Authentication**: All scraping endpoints now require Bearer token (health endpoint remains public)

### 🐛 Fixed
- **Large Listing IDs**: Fixed precision issues with large listing IDs by converting to strings
- **Environment Variables**: Fixed `.env` file not being loaded by adding `dotenv` package

### 📚 Documentation
- Updated `API.md` with authentication examples and amenities structure
- Created `UBUNTU_DEPLOYMENT.md` with complete VPS deployment guide
- Updated `UPDATES_SUMMARY.md` with all recent changes

---

## [1.0.0] - 2025-09-29

### Initial Release
- Basic scraping functionality for Airbnb listings
- Search by location endpoint
- Individual listing scraper
- Extract: title, description, images, host info, amenities, reviews, house rules
- CLI interface for local scraping
