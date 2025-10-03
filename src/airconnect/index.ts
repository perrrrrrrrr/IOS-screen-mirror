import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { ImageCleanup } from '../utils/imageCleanup';

const screenshot = require('screenshot-desktop');

export class AirConnect extends EventEmitter {
    private isCapturing: boolean = false;
    private captureInterval: NodeJS.Timeout | null = null;
    private activeScreen: number = 0; // Will be determined automatically
    
    // Crop area for boost percentage (iPhone XR Portrait - reduced height)
    private readonly BOOST_CROP_AREA = {
        x: 890,           // Moved left from 912 to 890 (22 pixels left)
        y: 447,           // Center 462 - 15 = 447  
        width: 144,       // Increased from 100 to 144 (44 pixels wider)
        height: 35        // Decreased from 40 to 35 (5 pixels shorter)
    };

    // Crop area for odds (iPhone XR Portrait - wider on both sides)
    private readonly ODDS_CROP_AREA = {
        x: 762,           // Moved left from 772 to 762 (10 pixels left)
        y: 493,           // Moved up from 495 to 493 (2 pixels up)
        width: 420,       // Increased from 280 to 420 (50% increase)
        height: 35        // Slightly taller to ensure full capture
    };

    // Crop area for boost details (iPhone XR Portrait - adjusted width)
    private readonly BOOST_DETAILS_CROP_AREA = {
        x: 737,           // Moved right from 732 to 737 (5 pixels right)
        y: 560,           // Moved up from 570 to 560 (10 pixels higher)
        width: 445,       // Reduced from 450 to 445 (5 pixels narrower)
        height: 280       // Increased from 250 to 280 (30 pixels taller)
    };

    constructor() {
        super();
        console.log('🖥️ AirConnect starting...');
        this.listAvailableDisplays();
        this.findActiveScreen();
        this.startScreenCapture();
    }

    // Simple one-time check to find which screen has meaningful content
    private async findActiveScreen(): Promise<void> {
        console.log('🔍 Testing screens for iPhone content...');
        
        // Try screens 0, 1, 2 to find the one with actual content
        for (let screen of [1, 2, 0]) {  // Try screen 1 and 2 first since 0 was showing "ET"/"CED"
            try {
                console.log(`   Testing screen ${screen}...`);
                const buffer = await screenshot({ format: 'png', screen });
                const image = sharp(buffer);
                const { width, height } = await image.metadata();
                
                // Check if boost crop area fits
                if (this.BOOST_CROP_AREA.x + this.BOOST_CROP_AREA.width <= width && 
                    this.BOOST_CROP_AREA.y + this.BOOST_CROP_AREA.height <= height) {
                    const cropBuffer = await image
                        .extract({
                            left: this.BOOST_CROP_AREA.x,
                            top: this.BOOST_CROP_AREA.y,
                            width: this.BOOST_CROP_AREA.width,
                            height: this.BOOST_CROP_AREA.height
                        })
                        .png()
                        .toBuffer();
                    if (cropBuffer.length > 1000) { 
                        // Save a test crop to see what we're getting
                        require('fs').writeFileSync(`test_screen_${screen}_boost_crop.png`, cropBuffer);
                        console.log(`   📸 Saved test boost crop: test_screen_${screen}_boost_crop.png`);
                        const stats = await sharp(cropBuffer).stats();
                        const variance = stats.channels[0].stdev;
                        console.log(`   📊 Screen ${screen} boost variance: ${variance.toFixed(2)}`);
                        // Lower threshold - if it has any meaningful variation, use it
                        if (variance > 3.0) { 
                            console.log(`✅ Using screen ${screen} (boost variance: ${variance.toFixed(2)})`);
                            this.activeScreen = screen;
                            return;
                        }
                    }
                }
                console.log(`   ❌ Screen ${screen}: insufficient content`);
            } catch (error) {
                console.log(`   ❌ Screen ${screen}: not available`);
            }
        }
        
        console.log(`⚠️ No suitable screen found, defaulting to screen 1`);
        this.activeScreen = 1;
    }

    private async listAvailableDisplays() {
        try {
            const displays = await screenshot.listDisplays();
            console.log('📺 Available displays:', displays);
        } catch (error) {
            console.log('ℹ️ Could not list displays, using primary screen');
        }
    }

    private startScreenCapture() {
        console.log('📸 Starting screen capture every 7.5 seconds...');
        this.captureInterval = setInterval(() => {
            this.captureScreen();
        }, 7500); // Changed to 7500ms (7.5 seconds) for optimal efficiency
    }

    private async captureScreen() {
        if (this.isCapturing) {
            console.log('⏳ Capture already in progress, skipping...');
            return;
        }
        
        this.isCapturing = true;
        console.log('📸 Taking screenshot...');

        try {
            const timestamp = Date.now();
            
            // Take screenshot from the detected active screen
            console.log(`🔍 Capturing from screen ${this.activeScreen}...`);
            const fullImageBuffer = await screenshot({ 
                format: 'png', 
                screen: this.activeScreen
            });
            console.log(`✅ Successfully captured from screen ${this.activeScreen}`);
            
            // Get image dimensions
            const fullImage = sharp(fullImageBuffer);
            const { width: fullWidth, height: fullHeight } = await fullImage.metadata();
            console.log(`📐 Full screen dimensions: ${fullWidth}x${fullHeight}`);
            
            // Validate boost crop coordinates
            const boostCropRight = this.BOOST_CROP_AREA.x + this.BOOST_CROP_AREA.width;
            const boostCropBottom = this.BOOST_CROP_AREA.y + this.BOOST_CROP_AREA.height;
            if (boostCropRight > fullWidth || boostCropBottom > fullHeight) {
                console.log(`⚠️ WARNING: Boost crop area extends beyond screen bounds!`);
                console.log(`⚠️ Boost Crop: (${this.BOOST_CROP_AREA.x}, ${this.BOOST_CROP_AREA.y}) to (${boostCropRight}, ${boostCropBottom})`);
                console.log(`⚠️ Screen: (0, 0) to (${fullWidth}, ${fullHeight})`);
            }
            // Validate odds crop coordinates
            const oddsCropRight = this.ODDS_CROP_AREA.x + this.ODDS_CROP_AREA.width;
            const oddsCropBottom = this.ODDS_CROP_AREA.y + this.ODDS_CROP_AREA.height;
            if (oddsCropRight > fullWidth || oddsCropBottom > fullHeight) {
                console.log(`⚠️ WARNING: Odds crop area extends beyond screen bounds!`);
                console.log(`⚠️ Odds Crop: (${this.ODDS_CROP_AREA.x}, ${this.ODDS_CROP_AREA.y}) to (${oddsCropRight}, ${oddsCropBottom})`);
                console.log(`⚠️ Screen: (0, 0) to (${fullWidth}, ${fullHeight})`);
            }
            
            // Save full screenshot for debugging (in grayscale)
            const fullDebugPath = path.join(process.cwd(), 'debug', `full_${timestamp}.png`);
            if (!require('fs').existsSync(path.dirname(fullDebugPath))) {
                require('fs').mkdirSync(path.dirname(fullDebugPath), { recursive: true });
            }

            // Clean up old debug images before saving new ones
            ImageCleanup.keepRecentImages('debug', 2);

            const grayscaleFullImageBuffer = await sharp(fullImageBuffer)
                .grayscale()
                .png()
                .toBuffer();
            require('fs').writeFileSync(fullDebugPath, grayscaleFullImageBuffer);
            console.log(`🖼️ Full screenshot saved (grayscale): ${fullDebugPath}`);

            // Crop boost area (color)
            console.log(`✂️ Cropping boost: x=${this.BOOST_CROP_AREA.x}, y=${this.BOOST_CROP_AREA.y}, w=${this.BOOST_CROP_AREA.width}, h=${this.BOOST_CROP_AREA.height}`);
            const boostCropBuffer = await sharp(fullImageBuffer)
                .extract({
                    left: Math.max(0, this.BOOST_CROP_AREA.x),
                    top: Math.max(0, this.BOOST_CROP_AREA.y),
                    width: Math.min(this.BOOST_CROP_AREA.width, fullWidth - this.BOOST_CROP_AREA.x),
                    height: Math.min(this.BOOST_CROP_AREA.height, fullHeight - this.BOOST_CROP_AREA.y)
                })
                .png()
                .toBuffer();
            const boostCropDebugPath = path.join(process.cwd(), 'debug', `boost_crop_${timestamp}.png`);
            require('fs').writeFileSync(boostCropDebugPath, boostCropBuffer);
            console.log(`✂️ Boost cropped screenshot saved: ${boostCropDebugPath}`);
            // Crop odds area (color for Discord, grayscale for OCR)
            console.log(`✂️ Cropping odds: x=${this.ODDS_CROP_AREA.x}, y=${this.ODDS_CROP_AREA.y}, w=${this.ODDS_CROP_AREA.width}, h=${this.ODDS_CROP_AREA.height}`);
            
            // Color version for Discord
            const oddsCropBuffer = await sharp(fullImageBuffer)
                .extract({
                    left: Math.max(0, this.ODDS_CROP_AREA.x),
                    top: Math.max(0, this.ODDS_CROP_AREA.y),
                    width: Math.min(this.ODDS_CROP_AREA.width, fullWidth - this.ODDS_CROP_AREA.x),
                    height: Math.min(this.ODDS_CROP_AREA.height, fullHeight - this.ODDS_CROP_AREA.y)
                })
                .png()
                .toBuffer();
            
            // Grayscale version for OCR analysis
            const oddsGrayscaleCropBuffer = await sharp(fullImageBuffer)
                .extract({
                    left: Math.max(0, this.ODDS_CROP_AREA.x),
                    top: Math.max(0, this.ODDS_CROP_AREA.y),
                    width: Math.min(this.ODDS_CROP_AREA.width, fullWidth - this.ODDS_CROP_AREA.x),
                    height: Math.min(this.ODDS_CROP_AREA.height, fullHeight - this.ODDS_CROP_AREA.y)
                })
                .grayscale()
                .png()
                .toBuffer();
                
            const oddsCropDebugPath = path.join(process.cwd(), 'debug', `odds_crop_${timestamp}.png`);
            const oddsGrayscaleDebugPath = path.join(process.cwd(), 'debug', `odds_grayscale_${timestamp}.png`);
            require('fs').writeFileSync(oddsCropDebugPath, oddsCropBuffer);
            require('fs').writeFileSync(oddsGrayscaleDebugPath, oddsGrayscaleCropBuffer);
            console.log(`✂️ Odds cropped screenshot saved: ${oddsCropDebugPath}`);
            console.log(`🔍 Odds grayscale for OCR saved: ${oddsGrayscaleDebugPath}`);

            // Crop boost details area (large area under the odds)
            console.log(`✂️ Cropping boost details: x=${this.BOOST_DETAILS_CROP_AREA.x}, y=${this.BOOST_DETAILS_CROP_AREA.y}, w=${this.BOOST_DETAILS_CROP_AREA.width}, h=${this.BOOST_DETAILS_CROP_AREA.height}`);
            const boostDetailsCropBuffer = await sharp(fullImageBuffer)
                .extract({
                    left: Math.max(0, this.BOOST_DETAILS_CROP_AREA.x),
                    top: Math.max(0, this.BOOST_DETAILS_CROP_AREA.y),
                    width: Math.min(this.BOOST_DETAILS_CROP_AREA.width, fullWidth - this.BOOST_DETAILS_CROP_AREA.x),
                    height: Math.min(this.BOOST_DETAILS_CROP_AREA.height, fullHeight - this.BOOST_DETAILS_CROP_AREA.y)
                })
                .png()
                .toBuffer();
            
            // Regular crop for debug purposes (no dynamic cropping for every capture)
            const finalBoostDetailsBuffer = boostDetailsCropBuffer;
            
            const boostDetailsCropDebugPath = path.join(process.cwd(), 'debug', `boost_details_crop_${timestamp}.png`);
            require('fs').writeFileSync(boostDetailsCropDebugPath, finalBoostDetailsBuffer);
            console.log(`✂️ Boost details cropped screenshot saved: ${boostDetailsCropDebugPath}`);

            // Compare sizes to verify cropping worked
            const fullSize = fullImageBuffer.length;
            const boostCropSize = boostCropBuffer.length;
            const oddsCropSize = oddsCropBuffer.length;
            const oddsGrayscaleSize = oddsGrayscaleCropBuffer.length;
            const boostDetailsCropSize = finalBoostDetailsBuffer.length;
            console.log(`📊 Size: Full=${Math.round(fullSize/1024)}KB, Boost=${Math.round(boostCropSize/1024)}KB, Odds=${Math.round(oddsCropSize/1024)}KB, OddsGray=${Math.round(oddsGrayscaleSize/1024)}KB, BoostDetails=${Math.round(boostDetailsCropSize/1024)}KB`);
            if (boostCropSize === 0 || oddsCropSize === 0 || oddsGrayscaleSize === 0 || boostDetailsCropSize === 0) {
                console.log('❌ ERROR: One of the cropped images is 0KB - crop coordinates are invalid!');
                // Still emit screenData for failure tracking
                this.emit('screenData', {
                    boostImage: `data:image/png;base64,`,
                    oddsImage: `data:image/png;base64,`,
                    boostDetailsImage: `data:image/png;base64,`,
                    oddsGrayscaleBuffer: Buffer.alloc(0),
                    timestamp: timestamp,
                    fullImageBuffer: fullImageBuffer,
                    hasChanged: true,
                    cropFailed: true
                });
                return;
            }
            
            // Check if crops are too small (likely missed content) - iPhone XR adjusted thresholds
            let cropTooSmall = false;
            if (boostCropSize < 500) {
                console.log(`⚠️ Boost crop too small (${Math.round(boostCropSize/1024)}KB) - likely missed content`);
                cropTooSmall = true;
            }
            if (oddsCropSize < 1500) {
                console.log(`⚠️ Odds crop too small (${Math.round(oddsCropSize/1024)}KB) - likely missed content`);
                cropTooSmall = true;
            }
            if (boostDetailsCropSize < 3000) {
                console.log(`⚠️ Boost details crop too small (${Math.round(boostDetailsCropSize/1024)}KB) - likely missed content`);
                cropTooSmall = true;
            }
            
            // Convert cropped images to base64
            const base64BoostImage = boostCropBuffer.toString('base64');
            const base64OddsImage = oddsCropBuffer.toString('base64');
            const base64BoostDetailsImage = finalBoostDetailsBuffer.toString('base64');
            
            if (cropTooSmall) {
                console.log(`⚠️ Crops too small - emitting screenData for failure tracking`);
            } else {
                console.log(`✅ Screenshot captured - Boost, Odds, and Boost Details cropped areas (good size)`);
            }
            
            console.log(`📤 Emitting screenData event`);
            // Emit both cropped screen data WITH full image buffer AND grayscale odds for OCR
            this.emit('screenData', {
                boostImage: `data:image/png;base64,${base64BoostImage}`,
                oddsImage: `data:image/png;base64,${base64OddsImage}`,
                boostDetailsImage: `data:image/png;base64,${base64BoostDetailsImage}`,
                oddsGrayscaleBuffer: oddsGrayscaleCropBuffer,
                timestamp: timestamp,
                fullImageBuffer: fullImageBuffer,
                hasChanged: true,
                cropTooSmall: cropTooSmall
            });
            
        } catch (error) {
            console.error('❌ Error taking screenshot:', error);
        } finally {
            this.isCapturing = false;
        }
    }

    public stop() {
        console.log('🛑 Stopping screen capture...');
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
    }

    // Method to trigger immediate capture for high-value boosts
    public async triggerImmediateCapture() {
        console.log('🚨 Triggering immediate capture for high-value boost...');
        await this.captureScreen();
    }
}