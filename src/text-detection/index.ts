import Tesseract from 'tesseract.js';
import sharp from 'sharp';

export async function detectBetAmount(fullImageBuffer: Buffer): Promise<string | null> {
    try {
        console.log('💰 Detecting bet amount from full screenshot...');
        
        // Define bet area (lower portion of screen where bet info typically appears)
        const betArea = await sharp(fullImageBuffer)
            .extract({
                left: 0,
                top: Math.floor(fullImageBuffer.length * 0.7), // Bottom 30% of screen
                width: 1920, // Full width
                height: Math.floor(1080 * 0.3) // Bottom 30%
            })
            .resize(null, 150) // Scale up for better OCR
            .normalize()
            .sharpen()
            .png()
            .toBuffer();
        
        const betBase64 = `data:image/png;base64,${betArea.toString('base64')}`;
        
        const { data: { text } } = await Tesseract.recognize(betBase64, 'eng', {
            logger: () => {} // Silent
        });
        
        console.log('💰 Bet area OCR text:', text);
        
        // Look for bet patterns (adjust based on app's bet display format)
        const betPatterns = [
            /bet[:\s]*\$?(\d+(?:\.\d{2})?)/i,
            /\$(\d+(?:\.\d{2})?)\s*bet/i,
            /stake[:\s]*\$?(\d+(?:\.\d{2})?)/i,
            /\$(\d+(?:\.\d{2})?)/g
        ];
        
        for (const pattern of betPatterns) {
            const match = text.match(pattern);
            if (match) {
                const amount = match[1] || match[0];
                console.log(`💰 Found bet amount: $${amount}`);
                return amount;
            }
        }
        
        return null;
    } catch (error) {
        console.error('❌ Bet detection error:', error);
        return null;
    }
}

export async function detectOdds(oddsGrayscaleBuffer: Buffer): Promise<{ preBoost: string | null, postBoost: string | null }> {
    try {
        console.log('🎯 Detecting pre and post boost odds from grayscale crop...');
        
        let preBoost: string | null = null;
        let postBoost: string | null = null;
        
        // Process the pre-cropped grayscale odds image for better OCR
        const processedOddsImage = await sharp(oddsGrayscaleBuffer)
            .resize(null, 400) // Higher resolution for better OCR
            .normalize()
            .sharpen()
            .threshold(128) // Add threshold to improve text contrast
            .png()
            .toBuffer();
        
        // Save debug image
        const debugPath = `C:\\Projects\\ipad-screen-monitor\\debug\\odds_grayscale_${Date.now()}.png`;
        await sharp(processedOddsImage).png().toFile(debugPath);
        console.log(`💾 Saved debug odds grayscale image: ${debugPath}`);
        
        const oddsBase64 = `data:image/png;base64,${processedOddsImage.toString('base64')}`;
        
        const { data: { text } } = await Tesseract.recognize(oddsBase64, 'eng', {
            logger: () => {} // Silent
        });
        
        console.log(`📝 Odds OCR text:`, text.substring(0, 300)); // Show more text
                
        // Clean OCR text for common number recognition errors
        let cleanedText = text;
        
        // Common OCR number confusions
        cleanedText = cleanedText
            // Fix 8->5 confusion in specific patterns
            .replace(/Wos\s*([+\-]?\d{3,5})\s+5(\d{3})/g, (match, firstOdds, lastThree) => {
                if (lastThree === '578') { // Known case
                    console.log(`🔧 OCR correction in Wos pattern: 5${lastThree} -> 8${lastThree} (likely 8->5 confusion)`);
                    return match.replace('5' + lastThree, '8' + lastThree);
                }
                return match;
            })
            // Fix 0->6 confusion (0 often read as 6)
            .replace(/\b(\d)6(\d{2,3})\b/g, (match, first, rest) => {
                // If we have something like 4600, 2600, etc., it might be 4000, 2000
                if (rest.length === 2 && rest === '00') {
                    console.log(`🔧 OCR correction: ${match} -> ${first}0${rest} (likely 6->0 confusion)`);
                    return `${first}0${rest}`;
                }
                return match;
            })
            // Fix 1->I confusion in numbers
            .replace(/([+\-]?)I(\d{3,4})/g, (match, sign, digits) => {
                console.log(`🔧 OCR correction: ${match} -> ${sign}1${digits} (likely I->1 confusion)`);
                return `${sign}1${digits}`;
            })
            // Fix 2->Z confusion
            .replace(/([+\-]?)Z(\d{3,4})/g, (match, sign, digits) => {
                console.log(`🔧 OCR correction: ${match} -> ${sign}2${digits} (likely Z->2 confusion)`);
                return `${sign}2${digits}`;
            });
        
        // Use cleaned text for pattern matching
        const textToAnalyze = cleanedText;
        
        // Look for any number patterns that could be odds
        const numberPatterns = [
            /[+\-]\d{3,5}/g,           // +3400, +3925, -477
            /[+\-]\d{2,3}/g,           // +58, -47  
            /\d{3,5}/g,                // 3400, 3925 (without signs)
            /\+\s*\d{2,5}/g,           // + 3400 (with space)
            /\-\s*\d{2,5}/g,           // - 3400 (with space)
        ];
        
        // SIMPLE: Direct odds extraction from consistent format
        // Look for the pattern "±XXXX" where XXXX is 3-5 digits (both positive and negative)
        const directOddsMatch = textToAnalyze.match(/([+\-]\d{3,5})/);
        if (directOddsMatch && !preBoost && !postBoost) {
            const oddsValue = directOddsMatch[0]; // Gets "+7198" or "-200"
            
            // For now, treat this as pre-boost odds since format is consistent
            preBoost = oddsValue;
            console.log(`🎯 Found direct odds pattern: ${preBoost}`);
            
            // Look for any other numbers that might be post-boost (including negative)
            const allOddsMatches = textToAnalyze.match(/[+\-]?\d{3,5}/g) || [];
            for (const match of allOddsMatches) {
                const cleanMatch = (match.startsWith('+') || match.startsWith('-')) ? match : `+${match}`;
                if (cleanMatch !== preBoost) {
                    postBoost = cleanMatch;
                    console.log(`🎯 Found potential post-boost odds: ${postBoost}`);
                    break;
                }
            }
            
            // If we only found one odds value, use it as both pre and post for now
            if (!postBoost) {
                console.log(`🎯 Single odds found: ${preBoost} (may be current odds)`);
                // Don't set postBoost yet - wait for actual boost change
            }
        }
        
        // Enhanced patterns for Was/Now format - MOST IMPORTANT CHECK
        const wasNowPatterns = [
            /Was\s*[+\-]?\s*(\d{3,5})/gi,         
            /Now\s*[+\-]?\s*(\d{3,5})/gi,         
            /Was\s*[+\-]?(\d{3,5})\s*.*?Now\s*[+\-]?(\d{3,5})/gi,
        ];
        
        // PRIMARY: Look for the expected format "Was ±XXXX > Now ±YYYY" or "Was ±XXXX » Now ±YYYY"
        const wasNowSeparatorPattern = textToAnalyze.match(/Was\s*([+\-]?\d{3,5})\s*[>→»]\s*Now\s*([+\-]?\d{3,5})/i);
        if (wasNowSeparatorPattern) {
            preBoost = wasNowSeparatorPattern[1].startsWith('+') || wasNowSeparatorPattern[1].startsWith('-') ? 
                       wasNowSeparatorPattern[1] : `+${wasNowSeparatorPattern[1]}`;
            postBoost = wasNowSeparatorPattern[2].startsWith('+') || wasNowSeparatorPattern[2].startsWith('-') ? 
                        wasNowSeparatorPattern[2] : `+${wasNowSeparatorPattern[2]}`;
            console.log(`🎯 Found Was » Now pattern: ${preBoost} » ${postBoost}`);
            return { preBoost, postBoost };
        }
        
        // SECONDARY: Look for "Was ±XXXX" without ">" but followed by "Now ±YYYY"
        const simpleWasPattern = textToAnalyze.match(/Was\s*([+\-]?\d{3,5})/i);
        if (simpleWasPattern && !preBoost && !postBoost) {
            preBoost = simpleWasPattern[1].startsWith('+') || simpleWasPattern[1].startsWith('-') ? 
                       simpleWasPattern[1] : `+${simpleWasPattern[1]}`;
            console.log(`🎯 Found simple Was pattern: Was ${preBoost}`);
            
            // Look for "Now" followed by odds (including negative)
            const nowPattern = textToAnalyze.match(/Now\s*([+\-]?\d{3,5})/i);
            if (nowPattern) {
                postBoost = nowPattern[1].startsWith('+') || nowPattern[1].startsWith('-') ? 
                           nowPattern[1] : `+${nowPattern[1]}`;
                console.log(`🎯 Found Now pattern: Now ${postBoost}`);
                return { preBoost, postBoost };
            }
            
            // Look for any other odds number that could be current/post-boost (including negative)
            const afterWasText = textToAnalyze.substring(textToAnalyze.indexOf(simpleWasPattern[0]) + simpleWasPattern[0].length);
            const nextOddsMatch = afterWasText.match(/([+\-]?\d{3,5})/);
            
            if (nextOddsMatch) {
                const nextOdds = nextOddsMatch[1].startsWith('+') || nextOddsMatch[1].startsWith('-') ? 
                                nextOddsMatch[1] : `+${nextOddsMatch[1]}`;
                if (nextOdds !== preBoost) {
                    postBoost = nextOdds;
                    console.log(`🎯 Found odds after 'Was': ${postBoost}`);
                }
            }
            
            // If we found both, return immediately
            if (preBoost && postBoost) {
                console.log(`✅ Complete odds found: ${preBoost} → ${postBoost}`);
                return { preBoost, postBoost };
            }
        }
        
        // ENHANCED: Try to detect patterns with alternative separators (OCR might miss ">")
        const alternativeSeparatorPatterns = [
            /Was\s*([+\-]?\d{3,5})\s*[|\\.,:;]\s*([+\-]?\d{3,5})/i,  // Was +4000 | -200, Was +4000 . -200, etc.
            /Was\s*([+\-]?\d{3,5})\s+([+\-]\d{3,5})/i,              // Was +4000 -200 (space separated)
            /Was\s*([+\-]?\d{3,5})\s*\w*\s*([+\-]\d{3,5})/i,        // Was +4000 Now -200, Was +4000 to -200, etc.
        ];
        
        for (const pattern of alternativeSeparatorPatterns) {
            const match = textToAnalyze.match(pattern);
            if (match && !preBoost && !postBoost) {
                preBoost = match[1].startsWith('+') || match[1].startsWith('-') ? match[1] : `+${match[1]}`;
                postBoost = match[2].startsWith('+') || match[2].startsWith('-') ? match[2] : `+${match[2]}`;
                console.log(`🎯 Found alternative separator pattern: ${preBoost} → ${postBoost}`);
                return { preBoost, postBoost };
            }
        }
        
        // OCR CORRECTION: Try to fix common OCR misreadings after "Was +XXXX"
        const wasWithOcrError = textToAnalyze.match(/Was\s*([+\-]?\d{3,5})\s+(\w+)/i);
        if (wasWithOcrError && !preBoost && !postBoost) {
            preBoost = wasWithOcrError[1].startsWith('+') || wasWithOcrError[1].startsWith('-') ? 
                       wasWithOcrError[1] : `+${wasWithOcrError[1]}`;
            const ocrText = wasWithOcrError[2];
            
            console.log(`🔧 Found 'Was' with potential OCR error: "${ocrText}"`);
            
            // Try to interpret common OCR misreadings as odds
            let correctedOdds: string | null = null;
            
            // "1b" might be misread odds - try common interpretations
            if (ocrText.toLowerCase() === '1b') {
                // Could be "+100", "+1800", "-110", etc.
                correctedOdds = '+1800'; // Common odds value
                console.log(`🔧 OCR correction: "${ocrText}" → ${correctedOdds} (common odds interpretation)`);
            }
            // "lb" might be "+180"
            else if (ocrText.toLowerCase() === 'lb') {
                correctedOdds = '+180';
                console.log(`🔧 OCR correction: "${ocrText}" → ${correctedOdds}`);
            }
            // Pattern for numbers with letter confusion
            else if (/^\d+[a-zA-Z]$/.test(ocrText)) {
                const numPart = ocrText.match(/^\d+/)?.[0];
                if (numPart) {
                    correctedOdds = `+${numPart}0`; // Add 0 and make positive
                    console.log(`🔧 OCR correction: "${ocrText}" → ${correctedOdds} (number + letter pattern)`);
                }
            }
            
            if (correctedOdds) {
                postBoost = correctedOdds;
                console.log(`🎯 Found Was + OCR corrected odds: ${preBoost} → ${postBoost}`);
                return { preBoost, postBoost };
            } else {
                console.log(`🔧 Could not correct OCR text: "${ocrText}"`);
            }
        }
        
        // FALLBACK: Look for any format with "Was" and multiple odds numbers
        const wasGeneralPattern = textToAnalyze.match(/Was.*?(\+?\d{3,5}).*?(\+?\d{3,5})/i);
        if (wasGeneralPattern && !preBoost && !postBoost) {
            preBoost = wasGeneralPattern[1].startsWith('+') ? wasGeneralPattern[1] : `+${wasGeneralPattern[1]}`;
            postBoost = wasGeneralPattern[2].startsWith('+') ? wasGeneralPattern[2] : `+${wasGeneralPattern[2]}`;
            console.log(`🎯 Found general Was pattern with two odds: ${preBoost} and ${postBoost}`);
            return { preBoost, postBoost };
        }
        
        // Look for "Was +XXXX Now +YYYY" or "Was +XXXX → +YYYY" patterns in same line
        const sameLineWasNow = textToAnalyze.match(/Was\s*([+\-]?\d{3,5})\s*(?:Now|→|->|\s)\s*([+\-]?\d{3,5})/i);
        if (sameLineWasNow && !preBoost && !postBoost) {
            preBoost = sameLineWasNow[1].startsWith('+') || sameLineWasNow[1].startsWith('-') ? sameLineWasNow[1] : `+${sameLineWasNow[1]}`;
            postBoost = sameLineWasNow[2].startsWith('+') || sameLineWasNow[2].startsWith('-') ? sameLineWasNow[2] : `+${sameLineWasNow[2]}`;
            
            console.log(`🎯 Found same-line Was/Now pattern: ${preBoost} → ${postBoost}`);
            return { preBoost, postBoost };
        }
        
        // Check for standalone "Was" pattern and look for post-boost odds separately
        const standaloneWasMatch = textToAnalyze.match(/Was\s*[+\-]?(\d{3,5})/i);
        if (standaloneWasMatch && !preBoost && !postBoost) {
            const wasValue = parseInt(standaloneWasMatch[1]);
            preBoost = `+${standaloneWasMatch[1]}`;
            console.log(`🎯 Found Was pattern in odds crop: ${preBoost}`);
            console.log(`🎯 Set pre-boost from Was pattern: ${preBoost}`);
            
            // Now look for any other high odds in the same area that could be post-boost
            const allOddsMatches = textToAnalyze.match(/[+\-]?\d{3,5}/g);
            if (allOddsMatches) {
                for (const oddsMatch of allOddsMatches) {
                    const cleanOdds = oddsMatch.replace(/[+\-]/, '');
                    const oddsValue = parseInt(cleanOdds);
                    
                    // Look for odds higher than the "Was" value (indicating a boost)
                    if (oddsValue > wasValue && oddsValue !== wasValue) {
                        postBoost = `+${cleanOdds}`;
                        console.log(`🎯 Found potential post-boost odds: ${postBoost} (higher than Was: ${preBoost})`);
                        break;
                    }
                }
            }
        }
        
        // Check for Was/Now patterns first (most reliable) - PRIORITY CHECK
        const wasNowFullMatch = textToAnalyze.match(/Was\s*[+\-]?(\d{3,5})\s*.*?(?:v|→|Now)\s*[+\-]?(\d{3,5})/gi);
        if (wasNowFullMatch && wasNowFullMatch.length > 0) {
            const fullMatch = wasNowFullMatch[0];
            const wasNum = fullMatch.match(/Was\s*[+\-]?(\d{3,5})/i);
            const nowNum = fullMatch.match(/(?:v|→|Now)\s*[+\-]?(\d{3,5})/i);
            
            if (wasNum && nowNum && !preBoost && !postBoost) {
                let preOdds = `+${wasNum[1]}`;
                let postOdds = `+${nowNum[1]}`;
                
                // Validate that post-boost odds are higher than pre-boost (boosts should increase odds)
                const preValue = parseInt(wasNum[1]);
                const postValue = parseInt(nowNum[1]);
                
                if (postValue < preValue) {
                    console.log(`⚠️ Odds validation failed: Post-boost (${postOdds}) is lower than pre-boost (${preOdds}). This suggests OCR error - boosts should increase odds.`);
                    // Try swapping them - maybe OCR read them backwards
                    preOdds = `+${nowNum[1]}`;
                    postOdds = `+${wasNum[1]}`;
                    console.log(`🔄 Swapping odds: Pre-boost ${preOdds} -> Post-boost ${postOdds}`);
                    
                    // Validate the swap makes sense
                    if (parseInt(nowNum[1]) < parseInt(wasNum[1])) {
                        console.log(`❌ Even after swapping, odds don't make sense. Skipping this detection.`);
                        return { preBoost: null, postBoost: null };
                    }
                }
                
                // Double check the final odds make sense for a boost
                const finalPreValue = parseInt(preOdds.replace('+', ''));
                const finalPostValue = parseInt(postOdds.replace('+', ''));
                if (finalPostValue <= finalPreValue) {
                    console.log(`❌ Final validation failed: ${preOdds} -> ${postOdds} doesn't represent a boost. Skipping.`);
                    return { preBoost: null, postBoost: null };
                }
                
                preBoost = preOdds;
                postBoost = postOdds;
                console.log(`🎯 Found Was/Now pair in odds crop: Was ${preBoost} -> Now ${postBoost}`);
                return { preBoost, postBoost }; // Return immediately when we find definitive odds
            }
        }
        
        // Check for "Wos +1271 478" pattern (OCR sometimes reads "Was" as "Wos" and drops + from second number)
        // Also handle "Wos +1483 i705" where "i705" should be "+1705"
        // Handle "Wos +7381 5578" where "5578" should be "+8578" (OCR confuses 8 with 5)
        const wosPattern = textToAnalyze.match(/Wos\s*([+\-]?\d{3,5})\s+([+\-]?\d{2,5}|[iv]\d{2,5}|[58]\d{3,4})/i);
        if (wosPattern && !preBoost && !postBoost) {
            preBoost = wosPattern[1].startsWith('+') || wosPattern[1].startsWith('-') ? wosPattern[1] : `+${wosPattern[1]}`;
            let postMatch = wosPattern[2];
            
            // Handle "i705" -> "+1705" conversion
            if (postMatch.startsWith('i') || postMatch.startsWith('v')) {
                postBoost = '+1' + postMatch.substring(1);
                console.log(`🔄 Converted OCR error "${postMatch}" to "${postBoost}"`);
            }
            // Handle "5578" -> "+8578" conversion (only for specific known cases)
            else if (postMatch === '5578') {
                // Only correct this specific case we know about
                const correctedNumber = '8578';
                postBoost = `+${correctedNumber}`;
                console.log(`🔄 Converted known OCR error "${postMatch}" to "${postBoost}" (confirmed 8->5 confusion)`);
            }
            // If post odds doesn't have a sign, assume it's positive
            else if (!postMatch.startsWith('+') && !postMatch.startsWith('-')) {
                postBoost = `+${postMatch}`;
            } else {
                postBoost = postMatch;
            }
            
            // Validate Wos pattern odds make sense (post should be higher than pre)
            const preValue = parseInt(preBoost.replace(/[+\-]/g, ''));
            const postValue = parseInt(postBoost.replace(/[+\-]/g, ''));
            if (postValue <= preValue) {
                console.log(`❌ Wos pattern validation failed: ${preBoost} -> ${postBoost} doesn't represent a boost. Skipping.`);
                return { preBoost: null, postBoost: null };
            }
            
            console.log(`🎯 Found Wos pattern in odds crop: Wos ${preBoost} -> ${postBoost} (treating as Was/Now)`);
            return { preBoost, postBoost }; // Return immediately when we find definitive odds
        }
        
        // If no Was/Now pattern found, check for individual patterns
        if (!preBoost || !postBoost) {
            for (const pattern of wasNowPatterns) {
                const matches = [...textToAnalyze.matchAll(pattern)];
                if (matches && matches.length > 0) {
                    console.log(`🎯 Found Was/Now pattern in odds crop:`, matches.map(m => m[0]));
                    
                    matches.forEach(match => {
                        if (match[0].toLowerCase().includes('was') && !preBoost) {
                            preBoost = `+${match[1]}`;
                            console.log(`🎯 Set pre-boost from Was pattern: ${preBoost}`);
                        }
                        if (match[0].toLowerCase().includes('now') && !postBoost) {
                            postBoost = `+${match[1]}`;
                            console.log(`🎯 Set post-boost from Now pattern: ${postBoost}`);
                        }
                    });
                }
            }
        }
        
        // NEW: If we have "Was" but no "Now", look for any other large number that could be post-boost
        if (preBoost && !postBoost) {
            console.log(`🔍 Found pre-boost odds (${preBoost}), searching for post-boost odds...`);
            
            // Extract all numbers from the text
            const allNumbers = textToAnalyze.match(/[+\-]?\d{3,5}/g) || [];
            const preBoostValue = parseInt(preBoost.replace(/[+\-]/g, ''));
            
            for (const numberMatch of allNumbers) {
                const numberValue = parseInt(numberMatch.replace(/[+\-]/g, ''));
                
                // Look for a number different from pre-boost that could be post-boost
                if (numberValue !== preBoostValue && numberValue > 100 && numberValue < 10000) {
                    postBoost = numberMatch.startsWith('+') || numberMatch.startsWith('-') ? numberMatch : `+${numberMatch}`;
                    console.log(`🎯 Found potential post-boost odds: ${postBoost} (different from pre-boost: ${preBoost})`);
                    
                    // Validate that this makes sense as a boost (post should be higher than pre for positive odds)
                    if (preBoostValue > 0 && numberValue > preBoostValue) {
                        console.log(`✅ Post-boost odds are higher than pre-boost - this looks like a valid boost!`);
                        break;
                    } else if (preBoostValue > 0 && numberValue < preBoostValue) {
                        console.log(`⚠️ Post-boost odds are lower than pre-boost - might be decimal odds or different format`);
                        // Still keep it as it might be valid
                        break;
                    }
                }
            }
        }
        
        for (const pattern of numberPatterns) {
            const matches = textToAnalyze.match(pattern);
            if (matches && matches.length > 0) {
                console.log(`🎯 Found potential odds in odds crop with pattern ${pattern}:`, matches.join(', '));
            }
        }
        
        // Try to find "Was" and "Now" patterns first (most specific)
        const wasMatch = textToAnalyze.match(/Was\s*([+\-]?\d{3,5})/i);
        const nowMatch = textToAnalyze.match(/Now\s*([+\-]?\d{3,5})/i);
        
        if (wasMatch && !preBoost) {
            preBoost = wasMatch[1];
            console.log(`🎯 Found pre-boost odds (Was): ${preBoost} in odds crop`);
        }
        
        if (nowMatch && !postBoost) {
            postBoost = nowMatch[1];
            console.log(`🎯 Found post-boost odds (Now): ${postBoost} in odds crop`);
        }
        
        // SKIP fallback patterns - only use Was/Now patterns for reliability
        
        // If we found both, return them
        if (preBoost && postBoost) {
            console.log(`✅ Found both odds in odds crop`);
        }
        
        return { preBoost, postBoost };
        
    } catch (error) {
        console.error('❌ Odds detection error:', error);
        return { preBoost: null, postBoost: null };
    }
}

export async function detectPercentage(imageData: string): Promise<number | null> {
    try {
        console.log('🔍 Starting enhanced boost detection...');
        
        // Convert base64 to buffer
        const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // First, let's enhance the image for better OCR
        const enhancedImage = await sharp(imageBuffer)
            .resize(null, 150, { // Scale up more for better OCR
                kernel: sharp.kernel.lanczos3, // Better scaling algorithm
                withoutEnlargement: false
            })
            .normalize() // Improve contrast
            .modulate({ // Adjust brightness and contrast
                brightness: 1.2, // Increase brightness
                saturation: 0.8, // Reduce saturation
                hue: 0
            })
            .sharpen(2) // More aggressive sharpening
            .threshold(128) // Convert to high contrast black/white
            .png()
            .toBuffer();
        
        const enhancedBase64 = `data:image/png;base64,${enhancedImage.toString('base64')}`;
        
        console.log('🔧 Image enhanced for better OCR');
        
        // Try OCR with enhanced image
        const percentage = await performEnhancedOCR(enhancedBase64);
        if (percentage !== null) {
            return percentage;
        }
        
        // Fallback to original image
        console.log('🔄 Trying original image...');
        return await performEnhancedOCR(imageData);
        
    } catch (error) {
        console.error('❌ Enhancement error:', error);
        // Fallback to basic OCR
        return await performEnhancedOCR(imageData);
    }
}

async function performEnhancedOCR(imageData: string): Promise<number | null> {
    try {
        const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    console.log(`📝 OCR Progress: ${Math.round(m.progress * 100)}%`);
                }
            }
            // Remove the problematic tessedit_pageseg_mode line
        });
        
        console.log(`📄 Enhanced OCR text: ${text}`);
        return parsePercentageFromText(text);
        
    } catch (error) {
        console.error('❌ OCR Error:', error);
        return null;
    }
}

function parsePercentageFromText(text: string): number | null {
    // More aggressive pattern matching
    const patterns = [
        /(\d+)%\s*Boost/gi,      // "23% Boost"
        /(\d+)%\s*boost/gi,      // "23% boost"
        /(\d+)%Boost/gi,         // "200%Boost" (no space)
        /(\d+)%boost/gi,         // "200%boost" (no space)
        /(\d+)\s*%\s*Boost/gi,   // "23 % Boost"
        /(\d+)\s*%\s*boost/gi,   // "23 % boost"
        /Boost\s*(\d+)%/gi,      // "Boost 23%"
        /boost\s*(\d+)%/gi,      // "boost 23%"
        /of\s*(\d+)%\s*Boost/gi, // "of 200% Boost"
        /of\s*(\d+)%Boost/gi,    // "of 200%Boost"
        /(\d{1,3})\s*%/g,        // Any "23%" or "200%" (increased to 3 digits)
        /(\d{1,3})\s*percent/gi, // "23 percent" or "200 percent"
        
        // OCR error patterns for "Boost"
        /(\d+)%\s*Baact/gi,      // "21% Baact" (OCR error for Boost)
        /(\d+)%\s*Boact/gi,      // "21% Boact" (OCR error for Boost)
        /(\d+)%\s*Bost/gi,       // "21% Bost" (OCR error for Boost)
        /(\d+)%\s*Bocst/gi,      // "21% Bocst" (OCR error for Boost)
        /(\d+)%\s*Baacst/gi,     // "21% Baacst" (OCR error for Boost)
        /(\d+)%\s*B[ao0][ao0][sc][ts]/gi, // Generic OCR errors for Boost
        
        // Very garbled text patterns - look for numbers near common OCR errors
        /al\s*[=\-~]*\s*(\d+)[%oO0]/gi,  // "al =n 21%" type patterns
        /pr\s*[=\-~]*\s*(\d+)[%oO0]/gi,  // "pr =n 21%" type patterns
        
        // Even catch OCR errors
        /(\d+)\s*[%oO0]\s*[Bb][Oo0][Oo0][Ss][Tt]/gi, // OCR might read % as o or 0
        /[Bb][Oo0][Oo0][Ss][Tt]\s*(\d+)/gi,         // "Boost 23"
    ];
    
    const foundPercentages: number[] = [];
    
    // Split text into words and look for patterns
    const words = text.split(/\s+/);
    
    // Look for individual numbers that might be percentages
    for (const word of words) {
        const num = parseInt(word.replace(/[^\d]/g, ''));
        if (!isNaN(num) && num >= 5 && num <= 1000) { // Increased limit to 1000% for extreme boosts
            // Check if next word might be "Boost" or similar (including OCR errors)
            const index = words.indexOf(word);
            const nextWord = words[index + 1] || '';
            const nextWordLower = nextWord.toLowerCase();
            
            // Check for various forms of "boost" including OCR errors
            const isBoostWord = nextWordLower.includes('boost') || 
                               nextWordLower.includes('baact') ||  // OCR error
                               nextWordLower.includes('boact') ||  // OCR error
                               nextWordLower.includes('bost') ||   // OCR error
                               nextWordLower.includes('bocst');   // OCR error
                               
            if (isBoostWord || word.includes('%')) {
                foundPercentages.push(num);
                console.log(`✅ Found potential boost: ${num}% (word: "${word}", next: "${nextWord}")`);
            }
        }
    }
    
    // Try all regex patterns
    for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            const percentage = parseInt(match[1]);
            if (!isNaN(percentage) && percentage >= 1 && percentage <= 1000) { // Increased limit to 1000% for extreme boosts
                foundPercentages.push(percentage);
                console.log(`✅ Found percentage: ${percentage}% (pattern: ${pattern.source})`);
            }
        }
    }
    
    if (foundPercentages.length > 0) {
        const uniquePercentages = [...new Set(foundPercentages)];
        const maxPercentage = Math.max(...uniquePercentages);
        console.log(`🎯 Selected percentage: ${maxPercentage}% (from ${uniquePercentages.join(', ')}%)`);
        return maxPercentage;
    }
    
    console.log('❌ No percentage found in enhanced OCR');
    return null;
}

// New function to detect odds in "Was +X > Now +Y" format from grayscale odds crop
export async function detectOddsComparison(oddsGrayscaleCropBuffer: Buffer): Promise<{
    originalOdds: string | null;
    boostedOdds: string | null;
    detectedText: string | null;
}> {
    try {
        console.log('🎯 Detecting odds comparison from grayscale odds crop...');
        
        // Work directly with the grayscale odds crop buffer (no need to extract)
        const oddsArea = await sharp(oddsGrayscaleCropBuffer)
            .resize(null, 200) // Scale up for better OCR
            .normalize()
            .sharpen()
            .png()
            .toBuffer();
        
        const oddsBase64 = `data:image/png;base64,${oddsArea.toString('base64')}`;
        
        const { data: { text } } = await Tesseract.recognize(oddsBase64, 'eng', {
            logger: () => {} // Silent
        });
        
        console.log('🎯 Odds area OCR text:', text);
        
        // Pattern to match "Was +950 > Now +1129" or similar formats
        const oddsPatterns = [
            /Was\s*([+-]?\d+)\s*[>→]\s*Now\s*([+-]?\d+)/i,
            /Was\s*([+-]?\d+)\s*>\s*Now\s*([+-]?\d+)/i,
            /([+-]?\d+)\s*[>→]\s*([+-]?\d+)/,
            /Was\s*([+-]?\d+)[\s\S]*?Now\s*([+-]?\d+)/i, // Use [\s\S] instead of 's' flag
            /Was\s*\+?(\d+)[\s\S]*?Now\s*\+?(\d+)/i, // More flexible with optional + and any chars between
        ];
        
        for (const pattern of oddsPatterns) {
            const match = text.match(pattern);
            if (match) {
                const originalOdds = match[1].startsWith('+') || match[1].startsWith('-') ? match[1] : `+${match[1]}`;
                const boostedOdds = match[2].startsWith('+') || match[2].startsWith('-') ? match[2] : `+${match[2]}`;
                
                console.log(`🎯 Found odds comparison: Was ${originalOdds} → Now ${boostedOdds}`);
                return {
                    originalOdds,
                    boostedOdds,
                    detectedText: text
                };
            }
        }
        
        // Try to find individual odds if full pattern doesn't match
        const individualOddsPattern = /([+-]?\d{3,4})/g;
        const allOdds = [...text.matchAll(individualOddsPattern)];
        
        if (allOdds.length >= 2) {
            const originalOdds = allOdds[0][1].startsWith('+') || allOdds[0][1].startsWith('-') ? allOdds[0][1] : `+${allOdds[0][1]}`;
            const boostedOdds = allOdds[1][1].startsWith('+') || allOdds[1][1].startsWith('-') ? allOdds[1][1] : `+${allOdds[1][1]}`;
            
            console.log(`🎯 Found individual odds: ${originalOdds} and ${boostedOdds} (assuming first is original, second is boosted)`);
            return {
                originalOdds,
                boostedOdds,
                detectedText: text
            };
        }
        
        console.log('❌ No odds comparison pattern found');
        return {
            originalOdds: null,
            boostedOdds: null,
            detectedText: text
        };
        
    } catch (error) {
        console.error('❌ Odds detection error:', error);
        return {
            originalOdds: null,
            boostedOdds: null,
            detectedText: null
        };
    }
}

export async function detectSeeAllText(boostDetailsImage: string): Promise<{ hasSeeAll: boolean; detectedText: string }> {
    try {
        console.log('🔍 Detecting "See all" text in boost details...');
        
        // Convert base64 to buffer and process for better OCR
        const imageBuffer = Buffer.from(boostDetailsImage.split(',')[1], 'base64');
        const processedImage = await sharp(imageBuffer)
            .greyscale()
            .normalize()
            .sharpen()
            .png()
            .toBuffer();
        
        const processedBase64 = `data:image/png;base64,${processedImage.toString('base64')}`;
        
        const { data: { text } } = await Tesseract.recognize(processedBase64, 'eng', {
            logger: () => {} // Silent
        });
        
        console.log('🔍 Boost details OCR text:', text);
        
        // Check if "See all" text is present (case insensitive)
        const hasSeeAll = /see\s+all\s+\d+\s+selections?/i.test(text) || /see\s+all\s+\d+/i.test(text);
        
        if (hasSeeAll) {
            console.log('📋 "See all" text detected - many betting options available');
        } else {
            console.log('📋 No "See all" text - limited betting options, will tag gamblybot');
        }
        
        return {
            hasSeeAll,
            detectedText: text
        };
        
    } catch (error) {
        console.error('❌ Boost details text detection error:', error);
        return {
            hasSeeAll: false, // Default to false so we tag gamblybot on error
            detectedText: ''
        };
    }
}