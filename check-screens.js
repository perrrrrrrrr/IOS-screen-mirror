const screenshot = require('screenshot-desktop');
const sharp = require('sharp');
const fs = require('fs');

async function checkAllScreens() {
    console.log('🔍 Checking all screens for iPad content...');
    
    const cropArea = {
        x: 906,
        y: 663,
        width: 110,
        height: 31
    };
    
    for (let screen = 0; screen <= 3; screen++) {
        try {
            console.log(`\n📺 Screen ${screen}:`);
            const buffer = await screenshot({ format: 'png', screen });
            const image = sharp(buffer);
            const { width, height } = await image.metadata();
            
            console.log(`   Dimensions: ${width}x${height}`);
            console.log(`   Size: ${Math.round(buffer.length/1024)}KB`);
            
            // Check if crop area fits
            if (cropArea.x + cropArea.width <= width && cropArea.y + cropArea.height <= height) {
                console.log(`   ✅ Crop area fits`);
                
                // Save full screenshot
                fs.writeFileSync(`test_full_screen_${screen}.png`, buffer);
                console.log(`   💾 Saved: test_full_screen_${screen}.png`);
                
                // Crop the area
                const cropBuffer = await image
                    .extract({
                        left: cropArea.x,
                        top: cropArea.y,
                        width: cropArea.width,
                        height: cropArea.height
                    })
                    .png()
                    .toBuffer();
                
                // Save cropped image
                fs.writeFileSync(`test_crop_screen_${screen}.png`, cropBuffer);
                console.log(`   ✂️ Saved: test_crop_screen_${screen}.png (${Math.round(cropBuffer.length/1024)}KB)`);
                
                // Check variance (content detection)
                const stats = await sharp(cropBuffer).stats();
                const variance = stats.channels[0].stdev;
                console.log(`   📊 Content variance: ${variance.toFixed(2)}`);
                
            } else {
                console.log(`   ❌ Crop area doesn't fit`);
            }
            
        } catch (error) {
            console.log(`   ❌ Not available: ${error.message}`);
        }
    }
    
    console.log('\n✅ Screen check complete! Check the test_*.png files to see what was captured.');
}

checkAllScreens().catch(console.error);
