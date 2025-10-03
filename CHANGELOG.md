## [Unreleased]

### Added
- Environment variable configuration system for Discord channel and role IDs
- Support for development and production environment separation
- Dotenv package integration for secure configuration management
- Template `.env.example` file for easy setup

### Changed
- Discord bot configuration now uses environment variables instead of hardcoded values
- Main application constructor no longer requires hardcoded bot token parameter
- Simplified notification logic with immediate boost detection
- Enhanced logging for boost detection without stability delays

### Removed
- **BREAKING**: Complete removal of boost wheel stability check system
- Removed `checkBoostWheelStability()` function and all related logic
- Removed stability variables: `lastStablePercentage`, `percentageStabilityCount`, `lastPercentageChangeTime`
- Removed stability constants: `STABILITY_REQUIRED_COUNT`, `STABILITY_TIMEOUT`, `MIN_STABILITY_DURATION`
- Removed expedited stability logic for extreme boosts
- Disabled boost verification accuracy system (temporarily)

### Security
- Discord bot token and channel IDs moved to environment variables
- Added `.env` to `.gitignore` for credential protection
- Removed hardcoded sensitive data from source code

## [1.0.0] - 2024-08-13

### Added
- Initial iPad screen monitoring system using AirConnect
- Discord bot integration for boost notifications
- Automated screen capture and OCR text detection using Tesseract.js
- Dual crop area system for boost percentage and odds detection
- Real-time boost percentage detection from iPad screen mirroring
- Discord notification system with multiple channel support:
  - Original channel for startup/shutdown messages
  - All boosts channel for general boost notifications
  - Test boosts channel for testing features
  - High boosts channel for boosts over 28.5%
  - Super high boosts channel for boosts over 50%
  - Testing channel for odds scraping results
- Enhanced odds detection system with "Was" vs "Now" comparison
- Grayscale image processing for improved OCR accuracy
- Boost verification system with calculated vs detected percentage comparison
- Image cleanup utilities for managing debug and alert screenshots
- Background service support with Windows PowerShell scripts
- Graceful shutdown handling with Discord notifications
- Periodic status updates and heartbeat monitoring
- Multi-screen detection and automatic screen switching
- Boost tracking with odds differentiation to prevent duplicate notifications
- Role-based Discord mentions for different boost thresholds
- Error handling and recovery mechanisms
- Debug screenshot saving for troubleshooting

### Added - Screen Detection & Monitoring
- Automatic iPad content detection across multiple displays
- Screen variance analysis for optimal screen selection
- Dynamic screen switching when current screen fails
- 30-second interval screen change detection
- Background monitoring that continues when screen is off

### Added - OCR & Text Detection
- Tesseract.js integration for text recognition
- Percentage detection from boost wheel area
- Odds comparison detection (original vs boosted odds)
- Bet amount detection (disabled for performance)
- Pattern matching for various odds formats
- OCR error correction and pattern recognition

### Added - Discord Integration
- Multi-channel notification system
- Role-based mentions for high-value boosts
- Screenshot attachments with cropped boost and odds areas
- Startup and shutdown messages
- Status updates with uptime and boost statistics
- Testing channel for odds detection validation
- Page change notifications with full screenshots

### Added - Boost Detection Logic
- Comprehensive boost tracking with percentage and odds
- Duplicate detection prevention using boost fingerprinting
- Cooldown system to prevent notification spam
- Different boost classification (standard, high-value, extreme)
- Boost verification with calculated accuracy checking
- Recovery notifications after detection outages

### Added - API Integration Framework
- CrazyNinjaOdds API integration (disabled pending activation)
- SportsOdds API for market comparison (disabled pending activation)
- Boost calculation utilities for accuracy verification
- Market analysis and expected value calculations

### Added - Utilities & Maintenance
- Image cleanup system for managing storage
- Debug screenshot preservation
- Alert image archiving
- Automatic old file cleanup on startup
- Comprehensive error logging and recovery

### Added - Service Management
- Windows service configuration scripts
- PowerShell service management utilities
- Background process monitoring
- Automatic restart capabilities
- Service installation and configuration

### Technical Details
- TypeScript implementation with strict type checking
- Node.js runtime with ES modules
- Sharp library for high-performance image processing
- Screenshot-desktop for cross-platform screen capture
- Robust error handling with process continuation
- Memory-efficient image processing pipeline
- Configurable detection thresholds and timeouts

## [0.1.0] - Initial Development

### Added
- Basic project structure and TypeScript configuration
- Initial AirConnect integration for iPad screen mirroring
- Basic OCR functionality with Tesseract.js
- Simple Discord bot implementation
- Core screen capture functionality

---

## Notes

### Breaking Changes in 1.0.0
- Complete restructure of boost detection logic
- New Discord channel configuration system
- Enhanced OCR pipeline with dual crop areas
- New boost verification and accuracy checking

### Migration Guide
1. Copy `.env.example` to `.env`
2. Fill in your Discord bot token and channel IDs
3. Update any scripts that depend on the old boost detection logic
4. Test the new environment variable system

### Future Roadmap
- Re-enable API integrations for market analysis
- Enhanced boost calculation verification
- Mobile app companion for remote monitoring
- Web dashboard for boost analytics
- Advanced OCR accuracy improvements
