import sharp from 'sharp';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface TextBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

interface CropBounds {
    width: number;
    height: number;
}

interface GeminiAnalysis {
    cropBounds: CropBounds | null;
    hasSeeAll: boolean;
    detectedText: string;
}

/**
 * Analyzes an image using Gemini AI for both cropping bounds and text content
 */
export async function analyzeImageWithGemini(imageBuffer: Buffer, padding: number = 15): Promise<GeminiAnalysis> {
    try {
        console.log('🔍 Analyzing image with Gemini AI for cropping and text detection...');
        
        // Get image metadata
        const metadata = await sharp(imageBuffer).metadata();
        const originalWidth = metadata.width || 0;
        const originalHeight = metadata.height || 0;
        
        console.log(`📏 Original dimensions: ${originalWidth}x${originalHeight}`);
        
        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Convert image to base64
        const base64Image = imageBuffer.toString('base64');
        
        const prompt = `Please analyze this sports betting boost details image and provide TWO pieces of information:

1. CROPPING ANALYSIS: Find the optimal crop that contains ALL meaningful content without cutting off any text.
   - This shows betting options like "Over 9.5", "Tie", etc.
   - Find the pixel coordinates where content ends, but ensure NO TEXT is cut off
   - RIGHT_EDGE: rightmost pixel where actual text/content appears (include full words)
   - BOTTOM_EDGE: bottommost pixel where meaningful content appears (include full text lines)
   - Be precise but NOT aggressive - better to include extra space than cut off text
   - IMPORTANT: Coordinates must be within image bounds (0 to ${originalWidth} for width, 0 to ${originalHeight} for height)
   - CRITICAL: Ensure the bottom edge includes the complete last line of text

2. TEXT CONTENT ANALYSIS: Read all the text in the image and look for:
   - Does it contain "See all [number] selections" or similar text indicating more options?
   - Extract all readable text content

Original dimensions: ${originalWidth}x${originalHeight}

Respond in this EXACT format:
RIGHT_EDGE: [number between 0 and ${originalWidth}]
BOTTOM_EDGE: [number between 0 and ${originalHeight}]
HAS_SEE_ALL: [true/false]
DETECTED_TEXT: [all text content separated by newlines]`;

        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64Image,
                    mimeType: "image/png"
                }
            },
            prompt
        ]);
        
        const response = await result.response;
        const text = response.text();
        
        console.log('🤖 Gemini AI response:', text);
        
        // Parse the response
        const rightMatch = text.match(/RIGHT_EDGE:\s*(\d+)/);
        const bottomMatch = text.match(/BOTTOM_EDGE:\s*(\d+)/);
        const seeAllMatch = text.match(/HAS_SEE_ALL:\s*(true|false)/i);
        const textMatch = text.match(/DETECTED_TEXT:\s*([\s\S]*?)(?=\n\n|$)/);
        
        let cropBounds: CropBounds | null = null;
        
        if (rightMatch && bottomMatch) {
            const rightEdge = parseInt(rightMatch[1]);
            const bottomEdge = parseInt(bottomMatch[1]);
            
            console.log(`📊 Gemini detected content bounds: right=${rightEdge}, bottom=${bottomEdge}`);
            
            // Validate Gemini's coordinates against actual image dimensions
            if (rightEdge > originalWidth || bottomEdge > originalHeight) {
                console.log(`⚠️ Gemini coordinates exceed image bounds (${originalWidth}x${originalHeight}), adjusting...`);
            }
            
            // Calculate optimal crop dimensions with padding, being less aggressive to avoid cutting text
            const cropWidth = Math.min(rightEdge + padding + 10, originalWidth); // Extra 10px buffer for width
            const cropHeight = Math.min(bottomEdge + padding + 20, originalHeight); // Extra 20px buffer for height
            
            // Additional validation to ensure we don't exceed image bounds
            const finalWidth = Math.max(Math.min(cropWidth, originalWidth), 200);
            const finalHeight = Math.max(Math.min(cropHeight, originalHeight), 100);
            
            cropBounds = {
                width: finalWidth,
                height: finalHeight
            };
            
            const widthReduction = Math.round(((originalWidth - finalWidth) / originalWidth) * 100);
            const heightReduction = Math.round(((originalHeight - finalHeight) / originalHeight) * 100);
            
            console.log(`✂️ Optimal crop (Gemini): ${finalWidth}x${finalHeight} (${widthReduction}% width reduction, ${heightReduction}% height reduction, +30px buffer applied)`);
        } else {
            console.log('⚠️ Could not parse Gemini crop coordinates');
        }
        
        const hasSeeAll = seeAllMatch ? seeAllMatch[1].toLowerCase() === 'true' : false;
        const detectedText = textMatch ? textMatch[1].trim() : '';
        
        console.log(`📋 Gemini text analysis: hasSeeAll=${hasSeeAll}`);
        if (detectedText) {
            console.log(`📝 Gemini detected text: ${detectedText.substring(0, 200)}${detectedText.length > 200 ? '...' : ''}`);
        }
        
        return {
            cropBounds,
            hasSeeAll,
            detectedText
        };
        
    } catch (error) {
        console.error('❌ Error analyzing with Gemini AI:', error);
        return {
            cropBounds: null,
            hasSeeAll: false,
            detectedText: ''
        };
    }
}

/**
 * Fallback method using pixel analysis to find content boundaries
 */
async function getPixelBasedCropBounds(imageBuffer: Buffer, padding: number = 20): Promise<CropBounds | null> {
    try {
        console.log('🔍 Using pixel-based analysis as fallback...');
        
        const metadata = await sharp(imageBuffer).metadata();
        const originalWidth = metadata.width || 0;
        const originalHeight = metadata.height || 0;
        
        // Convert to grayscale and get raw pixel data
        const { data, info } = await sharp(imageBuffer)
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });
        
        const width = info.width;
        const height = info.height;
        
        // Find rightmost content by scanning from right to left
        let rightmostContent = 0;
        const threshold = 240; // Pixels darker than this are considered content
        
        // Scan columns from right to left
        for (let x = width - 1; x >= 0; x--) {
            let hasContent = false;
            
            // Check if this column has any dark pixels (content)
            for (let y = 0; y < height; y++) {
                const pixelIndex = y * width + x;
                const pixelValue = data[pixelIndex];
                
                if (pixelValue < threshold) {
                    hasContent = true;
                    break;
                }
            }
            
            if (hasContent) {
                rightmostContent = x;
                break;
            }
        }
        
        console.log(`📊 Pixel analysis: rightmost content at x=${rightmostContent}`);
        
        if (rightmostContent === 0) {
            console.log('⚠️ No content detected via pixel analysis');
            return null;
        }
        
        const cropWidth = Math.min(rightmostContent + padding, originalWidth);
        // Reduce height by 50 pixels to avoid bottom UI elements
        const adjustedHeight = Math.max(originalHeight - 50, 100);
        
        console.log(`✂️ Optimal crop (pixel): ${cropWidth}x${adjustedHeight} (added ${padding}px padding, reduced bottom by 50px)`);
        
        return {
            width: Math.max(cropWidth, 200),
            height: adjustedHeight
        };
        
    } catch (error) {
        console.error('❌ Error in pixel-based analysis:', error);
        return null;
    }
}

/**
 * Crops an image to optimal dimensions based on Gemini AI analysis
 */
export async function cropToTextBounds(imageBuffer: Buffer, padding: number = 15): Promise<Buffer | null> {
    try {
        console.log('🔍 Starting dynamic cropping with Gemini AI...');
        const analysis = await analyzeImageWithGemini(imageBuffer, padding);
        
        if (!analysis.cropBounds) {
            console.log('⚠️ Could not determine optimal crop bounds, trying pixel analysis fallback');
            const fallbackBounds = await getPixelBasedCropBounds(imageBuffer, padding);
            if (!fallbackBounds) {
                console.log('⚠️ Fallback also failed, returning original image');
                return imageBuffer;
            }
            analysis.cropBounds = fallbackBounds;
        }
        
        // Crop the image to the optimal bounds
        const croppedBuffer = await sharp(imageBuffer)
            .extract({
                left: 0,
                top: 0,
                width: analysis.cropBounds.width,
                height: analysis.cropBounds.height
            })
            .png()
            .toBuffer();
        
        const originalMetadata = await sharp(imageBuffer).metadata();
        const originalSize = `${originalMetadata.width}x${originalMetadata.height}`;
        const newSize = `${analysis.cropBounds.width}x${analysis.cropBounds.height}`;
        const sizeDiff = Math.round(((originalMetadata.width! - analysis.cropBounds.width) / originalMetadata.width!) * 100);
        
        console.log(`✅ Dynamic crop: ${originalSize} → ${newSize} (${sizeDiff}% width reduction)`);
        
        return croppedBuffer;
        
    } catch (error) {
        console.error('❌ Error cropping image to text bounds:', error);
        return imageBuffer; // Return original on error
    }
}

/**
 * Crops an image and analyzes text content using Gemini AI (combined operation)
 */
export async function cropAndAnalyzeWithGemini(imageBuffer: Buffer, padding: number = 15): Promise<{ croppedBuffer: Buffer; hasSeeAll: boolean; detectedText: string }> {
    try {
        console.log('🔍 Starting combined Gemini AI cropping and text analysis...');
        const analysis = await analyzeImageWithGemini(imageBuffer, padding);
        
        let croppedBuffer = imageBuffer; // Default to original
        
        if (analysis.cropBounds) {
            // Crop the image to the optimal bounds
            croppedBuffer = await sharp(imageBuffer)
                .extract({
                    left: 0,
                    top: 0,
                    width: analysis.cropBounds.width,
                    height: analysis.cropBounds.height
                })
                .png()
                .toBuffer();
            
            const originalMetadata = await sharp(imageBuffer).metadata();
            const originalSize = `${originalMetadata.width}x${originalMetadata.height}`;
            const newSize = `${analysis.cropBounds.width}x${analysis.cropBounds.height}`;
            const widthReduction = Math.round(((originalMetadata.width! - analysis.cropBounds.width) / originalMetadata.width!) * 100);
            const heightReduction = Math.round(((originalMetadata.height! - analysis.cropBounds.height) / originalMetadata.height!) * 100);
            
            console.log(`✅ Dynamic crop: ${originalSize} → ${newSize} (${widthReduction}% width reduction, ${heightReduction}% height reduction)`);
        } else {
            console.log('⚠️ Using original image dimensions (no crop applied)');
        }
        
        return {
            croppedBuffer,
            hasSeeAll: analysis.hasSeeAll,
            detectedText: analysis.detectedText
        };
        
    } catch (error) {
        console.error('❌ Error in combined Gemini analysis:', error);
        return {
            croppedBuffer: imageBuffer,
            hasSeeAll: false,
            detectedText: ''
        };
    }
}
