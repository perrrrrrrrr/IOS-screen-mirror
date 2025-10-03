/**
 * Utility functions for boost calculations and verification
 */

export interface BoostCalculation {
    actualBoostPercentage: number;
    detectedBoostPercentage: number;
    discrepancy: number;
    isSignificantDiscrepancy: boolean;
    wasOdds: string;
    nowOdds: string;
}

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(americanOdds: string): number {
    const odds = parseInt(americanOdds.replace(/[+\-]/g, ''));
    
    if (americanOdds.startsWith('+')) {
        return (odds / 100) + 1;
    } else if (americanOdds.startsWith('-')) {
        return (100 / odds) + 1;
    } else {
        // Assume positive if no sign
        return (odds / 100) + 1;
    }
}

/**
 * Calculate the actual boost percentage from pre and post boost odds
 */
export function calculateActualBoostPercentage(preBoostOdds: string, postBoostOdds: string): number {
    try {
        const preDecimal = americanToDecimal(preBoostOdds);
        const postDecimal = americanToDecimal(postBoostOdds);
        
        // Calculate percentage increase in decimal odds
        const boostPercentage = ((postDecimal - preDecimal) / preDecimal) * 100;
        
        return Math.round(boostPercentage * 100) / 100; // Round to 2 decimal places
    } catch (error) {
        console.error('❌ Error calculating boost percentage:', error);
        return 0;
    }
}

/**
 * Compare detected boost percentage with actual odds-based calculation
 */
export function verifyBoostAccuracy(
    detectedPercentage: number,
    preBoostOdds: string,
    postBoostOdds: string,
    discrepancyThreshold: number = 10
): BoostCalculation {
    const actualBoostPercentage = calculateActualBoostPercentage(preBoostOdds, postBoostOdds);
    const discrepancy = Math.abs(actualBoostPercentage - detectedPercentage);
    const isSignificantDiscrepancy = discrepancy >= discrepancyThreshold;
    
    console.log(`📊 Boost Verification:`);
    console.log(`   Was: ${preBoostOdds} -> Now: ${postBoostOdds}`);
    console.log(`   Detected: ${detectedPercentage}%`);
    console.log(`   Actual: ${actualBoostPercentage}%`);
    console.log(`   Discrepancy: ${discrepancy.toFixed(2)}%`);
    console.log(`   Significant? ${isSignificantDiscrepancy ? 'YES' : 'NO'} (threshold: ${discrepancyThreshold}%)`);
    
    return {
        actualBoostPercentage,
        detectedBoostPercentage: detectedPercentage,
        discrepancy,
        isSignificantDiscrepancy,
        wasOdds: preBoostOdds,
        nowOdds: postBoostOdds
    };
}

/**
 * Format boost calculation for Discord message
 */
export function formatBoostDiscrepancyMessage(calculation: BoostCalculation): string {
    const emoji = calculation.discrepancy >= 20 ? '🚨' : calculation.discrepancy >= 15 ? '⚠️' : '📊';
    
    return `${emoji} **Boost Percentage Discrepancy Detected**\n\n` +
           `📈 **Odds Change:** ${calculation.wasOdds} → ${calculation.nowOdds}\n` +
           `🎯 **Detected Boost:** ${calculation.detectedBoostPercentage}%\n` +
           `🧮 **Calculated Boost:** ${calculation.actualBoostPercentage}%\n` +
           `📊 **Discrepancy:** ${calculation.discrepancy.toFixed(2)}% difference\n\n` +
           `${calculation.discrepancy >= 20 ? '🚨 **MAJOR DISCREPANCY**' : 
             calculation.discrepancy >= 15 ? '⚠️ **Significant difference**' : 
             '📊 **Notable difference**'}`;
}
