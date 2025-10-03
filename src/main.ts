import { AirConnect } from './airconnect';
import { detectPercentage, detectBetAmount, detectOdds, detectOddsComparison, detectSeeAllText } from './text-detection';
import { DiscordBot, testBot } from './discord-bot';
import { ImageCleanup } from './utils/imageCleanup';
import { verifyBoostAccuracy, type BoostCalculation } from './utils/boostCalculator';
// API integrations disabled for now
// import { crazyNinjaAPI, type OddsData } from './api/crazyNinjaOdds';
// import { oddsAPI } from './api/sportsOdds';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Prevent the application from exiting unexpectedly
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.log('🔄 Application will continue running...');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    console.log('🔄 Application will continue running...');
});

// Test the bot
testBot();

// Clean up old images on startup
console.log('🚀 Starting iPhone Screen Monitor...');
console.log('💡 This service will run in the background even when your screen is off');
ImageCleanup.cleanupOldImages();

const airConnect = new AirConnect();
const bot = new DiscordBot();

// Add screen detection debugging
console.log('🖥️ Screen Detection System Enabled:');
console.log('   • Automatically detects iPhone content across multiple displays');
console.log('   • Switches screens when current screen fails or becomes unavailable');
console.log('   • Checks for screen changes every 30 seconds');
console.log('   • Use Ctrl+C to stop the service');

// Graceful shutdown handling (after bot is initialized)
async function gracefulShutdown(signal: string) {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    try {
        // Send shutdown message to Discord
        await bot.sendShutdownMessage();
        console.log('✅ Shutdown message sent');
    } catch (error) {
        console.log('⚠️ Could not send shutdown message');
    }
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Send funny startup message after a short delay to ensure bot is ready
setTimeout(async () => {
    await bot.sendStartupMessage();
    
    // Send initial status update
    setTimeout(async () => {
        await bot.sendStatusUpdate({
            uptime: formatUptime(startTime),
            lastBoostTime,
            lastBoostPercentage,
            totalBoostsDetected
        });
    }, 5000); // Wait 5 seconds after startup message
}, 3000); // Wait 3 seconds for bot to be fully ready

// Add debugging
console.log('Setting up screen monitoring...');

// Status tracking
const startTime = Date.now();
let totalBoostsDetected = 0;
let lastBoostTime: string | undefined;
let lastBoostPercentage: number | undefined;

// No new unique boost tracking (12 minutes)
let lastUniqueBoostTime = Date.now();
let noNewBoostNotified = false;
const NO_NEW_BOOST_TIMEOUT = 12 * 60 * 1000; // 12 minutes in milliseconds

// Numbers detection failure tracking (6 tries)
let consecutiveNumberFailures = 0;
let numberFailureNotified = false;
const MAX_NUMBER_FAILURES = 6;

// Enhanced boost tracking with odds differentiation
interface BoostData {
    percentage: number;
    wasOdds: string | null;  // "Was +xxxx" odds
    nowOdds: string | null;  // "Now +xxxx" odds
    timestamp: number;
}

let lastBoostData: BoostData | null = null;

// Boost tracking system  
let lastNotificationTime = 0; // Keep for logging purposes only
let lastDetectedPercentage = 0;
const PERCENTAGE_CHANGE_THRESHOLD = 1; // Only notify if percentage changes by 1% or more

// Function to format uptime
function formatUptime(startTime: number): string {
    const uptime = Date.now() - startTime;
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

// Send periodic status updates (every 4 hours)
setInterval(async () => {
    try {
        await bot.sendStatusUpdate({
            uptime: formatUptime(startTime),
            lastBoostTime,
            lastBoostPercentage,
            totalBoostsDetected
        });
    } catch (error) {
        console.log('⚠️ Periodic status update failed');
    }
}, 30 * 60 * 1000); // 30 minutes - more frequent for better offline detection

// Check for no new unique boost every 2 minutes
setInterval(async () => {
    try {
        await checkNoNewBoost();
    } catch (error) {
        console.log('⚠️ No new boost check failed');
    }
}, 2 * 60 * 1000); // 2 minutes

// Check for number detection failures every minute
setInterval(async () => {
    try {
        await checkNumberFailures();
    } catch (error) {
        console.log('⚠️ Number failure check failed');
    }
}, 60 * 1000); // 1 minute

// Function to extract "Was +xxxx" odds from detected odds text
function extractWasOdds(detectedOdds: string | null): string | null {
    if (!detectedOdds) return null;
    
    // Look for "Was +xxxx" patterns in the odds text
    const patterns = [
        /Was\s*\+(\d{2,5})/i,
        /was\s*\+(\d{2,5})/i,
        /WAS\s*\+(\d{2,5})/,
        /Waos\s*\+(\d{2,5})/i, // Common OCR misread
        /Was\s*\+\s*(\d{2,5})/i
    ];
    
    for (const pattern of patterns) {
        const match = detectedOdds.match(pattern);
        if (match) {
            const oddsNumber = match[1];
            console.log(`🎯 Extracted "Was" odds: +${oddsNumber}`);
            return `+${oddsNumber}`;
        }
    }
    
    return null;
}

// Function to check if this is a different boost (percentage AND both was/now odds)
function isDifferentBoost(currentPercentage: number, currentWasOdds: string | null, currentNowOdds: string | null): boolean {
    if (!lastBoostData) {
        return true; // First boost detected
    }
    
    const percentageChanged = lastBoostData.percentage !== currentPercentage;
    const wasOddsChanged = lastBoostData.wasOdds !== currentWasOdds;
    const nowOddsChanged = lastBoostData.nowOdds !== currentNowOdds;
    
    if (percentageChanged) {
        console.log(`🎯 Different boost: ${lastBoostData.percentage}% → ${currentPercentage}%`);
        return true;
    }
    
    if (wasOddsChanged) {
        console.log(`🎯 Same percentage but different "was" odds: ${lastBoostData.wasOdds} → ${currentWasOdds}`);
        return true;
    }
    
    if (nowOddsChanged) {
        console.log(`🎯 Same percentage but different "now" odds: ${lastBoostData.nowOdds} → ${currentNowOdds}`);
        return true;
    }
    
    console.log(`🔄 Same boost continuing: ${currentPercentage}% (Was: ${currentWasOdds}, Now: ${currentNowOdds})`);
    return false;
}

// Function to check for no new unique boost (12 minutes)
async function checkNoNewBoost(): Promise<void> {
    const now = Date.now();
    const timeSinceLastUniqueBoost = now - lastUniqueBoostTime;
    
    console.log(`🔍 No new boost check: ${Math.round(timeSinceLastUniqueBoost / 60000)} minutes since last unique boost, threshold: ${Math.round(NO_NEW_BOOST_TIMEOUT / 60000)} minutes, notified: ${noNewBoostNotified}`);
    
    if (timeSinceLastUniqueBoost > NO_NEW_BOOST_TIMEOUT && !noNewBoostNotified) {
        console.log(`🚨 No new unique boost detected for ${Math.round(timeSinceLastUniqueBoost / 60000)} minutes`);
        
        const currentTime = new Date().toLocaleTimeString();
        const minutesWithoutBoost = Math.round(timeSinceLastUniqueBoost / 60000);
        
        await bot.sendSystemAlert(`@everyone 🚨 **SYSTEM ALERT**: No new unique boost detected for ${minutesWithoutBoost} minutes! System may need attention.`);
        
        noNewBoostNotified = true;
        console.log(`📢 No new boost alert sent after ${minutesWithoutBoost} minutes`);
    }
}

// Function to check for consecutive number detection failures
async function checkNumberFailures(): Promise<void> {
    console.log(`🔍 Number failure check: ${consecutiveNumberFailures} failures, threshold: ${MAX_NUMBER_FAILURES}, notified: ${numberFailureNotified}`);
    
    if (consecutiveNumberFailures >= MAX_NUMBER_FAILURES && !numberFailureNotified) {
        console.log(`🚨 Failed to detect numbers for ${consecutiveNumberFailures} consecutive tries`);
        
        const currentTime = new Date().toLocaleTimeString();
        
        await bot.sendSystemAlert(`<@1115811270835306566> **ALERT**: Failed to detect numbers for ${consecutiveNumberFailures} consecutive attempts! Bot is down.`);
        
        numberFailureNotified = true;
        console.log(`📢 Number detection failure alert sent after ${consecutiveNumberFailures} failures`);
    }
}

// Simple sendNotification function (back to working version)
async function sendNotification(data: {
    percentage: number;
    timestamp: string;
    boostImage: string;
    oddsImage: string;
    boostDetailsImage: string;
    boostDetailsAnalysis: { hasSeeAll: boolean; detectedText: string };
    wasOdds?: string | null;
    nowOdds?: string | null;
}) {
    try {
        // Clean up old alert images before saving new one
        ImageCleanup.cleanupDirectory('alerts');
        
        // Save both cropped images
        const timestamp = Date.now();
        
        // Save boost image
        const boostImageBuffer = Buffer.from(data.boostImage.split(',')[1], 'base64');
        const boostImagePath = path.join(process.cwd(), 'alerts', `boost_${timestamp}.png`);
        
        // Save odds image  
        const oddsImageBuffer = Buffer.from(data.oddsImage.split(',')[1], 'base64');
        const oddsImagePath = path.join(process.cwd(), 'alerts', `odds_${timestamp}.png`);
        
        // Save boost details image (no dynamic cropping)
        const boostDetailsImageBuffer = Buffer.from(data.boostDetailsImage.split(',')[1], 'base64');
        
        // Use original OCR-based "See all" detection for Discord alerts
        console.log(`🔍 Analyzing boost details with OCR for Discord alert...`);
        const boostDetailsAnalysis = await detectSeeAllText(data.boostDetailsImage);
        
        if (boostDetailsAnalysis.hasSeeAll) {
            console.log('📋 "See all" text detected - many betting options available');
        } else {
            console.log('📋 No "See all" text - limited betting options, will tag gamblybot');
        }
        
        const boostDetailsImagePath = path.join(process.cwd(), 'alerts', `boost_details_${timestamp}.png`);
        
        if (!fs.existsSync(path.dirname(boostImagePath))) {
            fs.mkdirSync(path.dirname(boostImagePath), { recursive: true });
        }
        fs.writeFileSync(boostImagePath, boostImageBuffer);
        fs.writeFileSync(oddsImagePath, oddsImageBuffer);
        fs.writeFileSync(boostDetailsImagePath, boostDetailsImageBuffer);
        console.log(`💾 Alert images saved: ${boostImagePath}, ${oddsImagePath}, and ${boostDetailsImagePath}`);
        
        // Use was odds as preBoostOdds and now odds as postBoostOdds
        const preBoostOdds = data.wasOdds || detectedPreBoostOdds;
        const postBoostOdds = data.nowOdds || detectedPostBoostOdds;
        
        // Boost verification temporarily disabled
        let boostCalculation = null;
        // if (detectedPreBoostOdds && detectedPostBoostOdds) {
        //     boostCalculation = verifyBoostAccuracy(
        //         data.percentage,
        //         detectedPreBoostOdds,
        //         detectedPostBoostOdds,
        //         10 // 10% discrepancy threshold
        //     );
        //     
        //     // If there's a significant discrepancy, send alert to special channel
        //     if (boostCalculation.isSignificantDiscrepancy) {
        //         console.log(`🚨 Significant boost discrepancy detected! Sending alert...`);
        //         await bot.sendBoostDiscrepancyAlert({
        //             calculation: boostCalculation,
        //             screenshotPath: boostImagePath,
        //             timestamp: data.timestamp
        //         });
        //     }
        // }
        
        // Send Discord notification with both images and boost verification
        await bot.sendBoostAlert({
            percentage: data.percentage,
            timestamp: data.timestamp,
            screenshotPath: boostImagePath,
            oddsScreenshotPath: oddsImagePath,
            boostDetailsScreenshotPath: boostDetailsImagePath,
            boostDetailsAnalysis: boostDetailsAnalysis, // Use Gemini analysis result
            preBoostOdds: preBoostOdds,
            postBoostOdds: postBoostOdds || null,
            betAmount: null, // Bet amount detection disabled
            boostCalculation: boostCalculation
        });
        
        // Update tracking statistics
        totalBoostsDetected++;
        lastBoostTime = data.timestamp;
        lastBoostPercentage = data.percentage;
        
        // CrazyNinjaOdds and market comparison APIs disabled for now
        // TODO: Re-enable when ready to include analysis in notifications
        /*
        // Send odds data to CrazyNinjaOdds API if we have complete odds
        if (detectedPreBoostOdds && detectedPostBoostOdds) {
            console.log('🥷 Sending odds to CrazyNinjaOdds API...');
            
            const oddsData: OddsData = {
                sport: "Unknown", // Could be enhanced to detect sport
                event: "HardRock Boost",
                preBoostOdds: detectedPreBoostOdds,
                postBoostOdds: detectedPostBoostOdds,
                boostPercentage: data.percentage,
                betAmount: detectedBetAmount || undefined,
                timestamp: new Date().toISOString(),
                sportsbook: "HardRock"
            };
            
            const apiResult = await crazyNinjaAPI.submitOdds(oddsData);
            
            if (apiResult.success) {
                console.log('✅ Odds successfully sent to CrazyNinjaOdds');
                if (apiResult.analysis) {
                    console.log(`📈 CrazyNinjaOdds Analysis: EV=${apiResult.analysis.expectedValue}, Rec=${apiResult.analysis.recommendation}`);
                }
            } else {
                console.log('⚠️ CrazyNinjaOdds API submission failed:', apiResult.message);
            }
            
            // Also compare with market odds
            console.log('📊 Comparing boost with market odds...');
            const marketComparison = await oddsAPI.compareBoostWithMarket(detectedPreBoostOdds, detectedPostBoostOdds);
            
            if (marketComparison.success && marketComparison.analysis) {
                console.log('✅ Market comparison completed:');
                console.log(`   Boost Value: ${marketComparison.analysis.boostValue}%`);
                console.log(`   Market Analysis: ${marketComparison.analysis.marketComparison}`);
                console.log(`   Recommendation: ${marketComparison.analysis.recommendation}`);
            } else {
                console.log('⚠️ Market comparison failed:', marketComparison.error);
            }
        }
        */
        
    } catch (error) {
        console.error('❌ Error sending notification:', error);
    }
}

// Enhanced screen monitoring with bet and odds detection
let detectedBoostPercentage: number | null = null;
let detectedBetAmount: string | null = null;
let detectedPreBoostOdds: string | null = null;
let detectedPostBoostOdds: string | null = null;

airConnect.on('screenData', async (data) => {
    // Destructure new payload including grayscale odds buffer and failure flags
    const { boostImage, oddsImage, boostDetailsImage, oddsGrayscaleBuffer, timestamp, fullImageBuffer, hasChanged, cropTooSmall, cropFailed } = data;
    console.log('🔍 Screen captured, analyzing...');

    // Handle crop failures
    if (cropFailed) {
        console.log('❌ Crop failed completely - no boost detection possible');
        consecutiveNumberFailures++;
        return;
    }

    // Handle small crops (skip detailed analysis but still count as failure)
    if (cropTooSmall) {
        console.log('⚠️ Crops too small - likely no boost content visible');
        consecutiveNumberFailures++;
        
        // Still try to save debug screenshots if we have data
        if (boostImage && oddsImage) {
            const boostDebugPath = path.join(process.cwd(), 'debug', `debug_boost_small_${timestamp}.png`);
            const oddsDebugPath = path.join(process.cwd(), 'debug', `debug_odds_small_${timestamp}.png`);
            try {
                const boostImageBuffer = Buffer.from(boostImage.split(',')[1], 'base64');
                const oddsImageBuffer = Buffer.from(oddsImage.split(',')[1], 'base64');
                if (!fs.existsSync(path.dirname(boostDebugPath))) {
                    fs.mkdirSync(path.dirname(boostDebugPath), { recursive: true });
                }
                fs.writeFileSync(boostDebugPath, boostImageBuffer);
                fs.writeFileSync(oddsDebugPath, oddsImageBuffer);
                console.log(`🔍 Debug small crop screenshots saved: ${boostDebugPath} and ${oddsDebugPath}`);
            } catch (error) {
                console.log('⚠️ Could not save debug screenshots for small crops');
            }
        }
        return;
    }

    // Save debug screenshots for both crops
    const boostDebugPath = path.join(process.cwd(), 'debug', `debug_boost_${timestamp}.png`);
    const oddsDebugPath = path.join(process.cwd(), 'debug', `debug_odds_${timestamp}.png`);
    const boostImageBuffer = Buffer.from(boostImage.split(',')[1], 'base64');
    const oddsImageBuffer = Buffer.from(oddsImage.split(',')[1], 'base64');
    if (!fs.existsSync(path.dirname(boostDebugPath))) {
        fs.mkdirSync(path.dirname(boostDebugPath), { recursive: true });
    }
    fs.writeFileSync(boostDebugPath, boostImageBuffer);
    fs.writeFileSync(oddsDebugPath, oddsImageBuffer);
    console.log(`🔍 Debug boost screenshot saved: ${boostDebugPath}`);
    console.log(`🔍 Debug odds screenshot saved: ${oddsDebugPath}`);

    // Analyze the cropped odds area for odds detection using GRAYSCALE version
    console.log('🎯 Detecting odds comparison from grayscale odds crop...');
    const oddsComparison = await detectOddsComparison(oddsGrayscaleBuffer);
    
    // Use the more accurate odds comparison results
    detectedPreBoostOdds = oddsComparison.originalOdds;
    detectedPostBoostOdds = oddsComparison.boostedOdds;

    // Calculate boost percentage using formula: ((now-was)/was)*100
    let percentage: number | null = null;
    if (oddsComparison.originalOdds && oddsComparison.boostedOdds) {
        const wasOddsValue = parseFloat(oddsComparison.originalOdds.replace(/[^0-9.-]/g, ''));
        const nowOddsValue = parseFloat(oddsComparison.boostedOdds.replace(/[^0-9.-]/g, ''));
        
        if (!isNaN(wasOddsValue) && !isNaN(nowOddsValue) && wasOddsValue !== 0) {
            const calculatedPercentage = ((nowOddsValue - wasOddsValue) / wasOddsValue) * 100;
            percentage = Math.round(calculatedPercentage * 10) / 10; // Round to 1 decimal place
            console.log(`🧮 Calculated boost: ((${nowOddsValue} - ${wasOddsValue}) / ${wasOddsValue}) * 100 = ${percentage}%`);
        } else {
            console.log(`⚠️ Could not parse odds values for calculation: was="${oddsComparison.originalOdds}", now="${oddsComparison.boostedOdds}"`);
        }
    } else {
        console.log('⚠️ Cannot calculate boost percentage - missing odds data');
    }
    
    detectedBoostPercentage = percentage;

    // Detect "See all" text in boost details image
    console.log('📋 Analyzing boost details for "See all" text...');
    const boostDetailsAnalysis = await detectSeeAllText(boostDetailsImage);

    if (oddsComparison.originalOdds && oddsComparison.boostedOdds) {
        console.log(`🎯 Odds detected - Pre: ${oddsComparison.originalOdds}, Post: ${oddsComparison.boostedOdds}`);
    } else if (oddsComparison.originalOdds || oddsComparison.boostedOdds) {
        console.log(`🎯 Partial odds detected - Pre: ${oddsComparison.originalOdds}, Post: ${oddsComparison.boostedOdds} (need both for notification)`);
    } else {
        console.log('🎯 No odds detected in this capture');
    }

    // Send odds test results to testing channel
    await bot.sendOddsTest({
        originalOdds: oddsComparison.originalOdds as string | undefined,
        boostedOdds: oddsComparison.boostedOdds as string | undefined,
        screenshotPath: oddsDebugPath,
        timestamp: new Date().toLocaleTimeString(),
        detectedText: oddsComparison.detectedText as string | undefined
    });

    // Bet amount detection disabled for performance
    // if (hasChanged && fullImageBuffer) {
    //     console.log('💰 Detecting bet amount from full screenshot...');
    //     detectedBetAmount = await detectBetAmount(fullImageBuffer);
    // }

    if (percentage !== null) {
        const currentTime = new Date().toLocaleTimeString();
        console.log(`📊 Analysis result: ${percentage}% at ${currentTime}`);
        
        // Extract both "Was" and "Now" odds for comprehensive comparison
        const wasOdds = detectedPreBoostOdds;  // "Was +xxxx" odds
        const nowOdds = detectedPostBoostOdds; // "Now +xxxx" odds
        
        // Create current boost data with both odds
        const currentBoostData: BoostData = {
            percentage,
            wasOdds: wasOdds,
            nowOdds: nowOdds,
            timestamp: Date.now()
        };
        
        // Check if this is a different boost (percentage, was odds, AND now odds must all match to be the same)
        const isNewBoost = isDifferentBoost(percentage, wasOdds, nowOdds);
        
        // Send ALL boosts to Discord channels if they are different
        if (isNewBoost) {
            // Reset consecutive number failures since we detected numbers successfully
            consecutiveNumberFailures = 0;
            numberFailureNotified = false;
            
            // Update last unique boost time
            lastUniqueBoostTime = Date.now();
            noNewBoostNotified = false;
            
            const now = Date.now();
            
            const oddsInfo = wasOdds && nowOdds ? ` (Was ${wasOdds} → Now ${nowOdds})` : wasOdds ? ` (Was ${wasOdds})` : '';
            console.log(`🔍 Notification check: ${percentage}%${oddsInfo} - New boost detected!`);
            
            // For extremely high boosts (>49%), prioritize immediate notification
            const isExtremeBoost = percentage > 49;
            if (isExtremeBoost) {
                console.log(`🔥 EXTREME BOOST DETECTED (${percentage}% > 49%) - Sending immediate notification!`);
            }
            
            // Send notification immediately (no cooldown)
            const isHighValueBoost = percentage >= 29;
            const boostType = isExtremeBoost ? "🔥 EXTREME BOOST" : 
                            isHighValueBoost ? "🚨 HIGH VALUE BOOST" : 
                            percentage >= 1 ? "🎯 BOOST DETECTED" :
                            "📊 DATA DETECTED";
            console.log(`${boostType} DETECTED! New boost with odds - sending alert...`);
            
            // Send notification with odds information
            await sendNotification({
                percentage,
                timestamp: currentTime,
                boostImage,
                oddsImage,
                boostDetailsImage,
                boostDetailsAnalysis,
                wasOdds,
                nowOdds
            });
            
            lastNotificationTime = now; // Keep for logging purposes
            lastDetectedPercentage = percentage;
            
            // Update last boost data
            lastBoostData = currentBoostData;
            
            const oddsInfoLog = wasOdds && nowOdds ? ` (Was ${wasOdds} → Now ${nowOdds})` : wasOdds ? ` (Was ${wasOdds})` : '';
            console.log(`📢 Boost alert sent: ${percentage}%${oddsInfoLog}`);
            
            // Trigger immediate re-scan for extreme boosts to confirm quickly
            if (isExtremeBoost) {
                console.log('🚨 Triggering re-scan for extreme boost confirmation in 2.5 seconds...');
                setTimeout(async () => {
                    await airConnect.triggerImmediateCapture();
                }, 2500); // Wait 2.5 seconds then re-scan for confirmation
            }
        } else if (!isNewBoost) {
            // Reset consecutive number failures since we detected numbers successfully
            consecutiveNumberFailures = 0;
            numberFailureNotified = false;
            
            const oddsInfo = wasOdds && nowOdds ? ` (Was ${wasOdds} → Now ${nowOdds})` : wasOdds ? ` (Was ${wasOdds})` : '';
            console.log(`🔄 Same boost continuing: ${percentage}%${oddsInfo} - no notification needed`);
        }
    } else {
        const currentTime = new Date().toLocaleTimeString();
        console.log(`❌ No percentage text found at ${currentTime}`);
        
        // Increment counter when no numbers are detected
        consecutiveNumberFailures++;
    }
});

// Handle page changes - send full screenshots to original channel with context
airConnect.on('pageChange', async (data: { fullScreenshotPath: string; timestamp: string }) => {
    console.log('📱 Page change detected, sending full screenshot to Discord...');
    
    try {
        // Build context message with boost, bet, and odds info
        let contextMessage = `📱 **Page Changed** at ${data.timestamp}`;
        
        if (detectedBoostPercentage !== null) {
            contextMessage += `\n🎯 **Current Boost:** ${detectedBoostPercentage}%`;
        }
        
        if (detectedBetAmount !== null) {
            contextMessage += `\n💰 **Bet Amount:** $${detectedBetAmount}`;
        }
        
        if (detectedPreBoostOdds !== null || detectedPostBoostOdds !== null) {
            contextMessage += `\n📊 **Odds:**`;
            if (detectedPreBoostOdds !== null) {
                contextMessage += ` Pre-Boost: ${detectedPreBoostOdds}`;
            }
            if (detectedPostBoostOdds !== null) {
                contextMessage += ` | Post-Boost: ${detectedPostBoostOdds}`;
            }
        }
        
        await bot.sendPageChangeScreenshot(data.fullScreenshotPath, contextMessage);
        console.log('✅ Full page screenshot sent to original channel with context');
    } catch (error) {
        console.error('❌ Error sending page change screenshot:', error);
    }
});

console.log('📱 App started - monitoring for screen data...');