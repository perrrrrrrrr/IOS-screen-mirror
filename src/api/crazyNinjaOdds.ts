import fetch from 'node-fetch';

export interface OddsData {
    sport: string;
    event: string;
    preBoostOdds: string;
    postBoostOdds: string;
    boostPercentage: number;
    betAmount?: string;
    timestamp: string;
    sportsbook: string;
}

export interface CrazyNinjaResponse {
    success: boolean;
    message?: string;
    data?: any;
    analysis?: {
        expectedValue: number;
        recommendation: string;
        confidence: number;
        evPercent?: number;
        evDollar?: number;
        freeBetPercent?: number;
        kellyUnits?: number;
        devigMethod?: string;
    };
}

export class CrazyNinjaOddsAPI {
    private baseURL: string;
    private apiKey?: string;

    constructor(baseURL: string = 'http://api.crazyninjaodds.com', apiKey?: string) {
        this.baseURL = baseURL;
        this.apiKey = apiKey;
    }

    /**
     * Use the devigger API to analyze odds and boost
     */
    async analyzeOddsWithDevigger(oddsData: OddsData): Promise<CrazyNinjaResponse> {
        try {
            console.log('🥷 Analyzing odds with CrazyNinjaOdds Devigger API...');
            
            // Build the devigger API URL with query parameters
            const params = new URLSearchParams({
                'api': 'open',
                'LegOdds': oddsData.preBoostOdds,
                'FinalOdds': oddsData.postBoostOdds,
                'Boost_Bool': '1', // Enable boost calculation
                'Boost_Text': oddsData.boostPercentage.toString(),
                'Boost_Type': '0', // 0=profit, 1=all
                'DevigMethod': '0', // 0=multi, 1=additive, 2=power, 3=shin, 4=worstcase, 5=weightedaverage
                'Args': 'ev_p,ev_d,fb_p,kelly,dm,fo_o' // Include EV%, EV$, Free Bet%, Kelly, Devig Method, Final Odds
            });

            const url = `${this.baseURL}/api/devigger/v1/sportsbook_devigger.aspx?${params}`;
            console.log('🔗 Devigger API URL:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'iPad-Screen-Monitor/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('📄 Raw API response:', responseText);

            // Parse the response (it appears to be plain text or specific format)
            const result = this.parseDeviggerResponse(responseText, oddsData);
            
            console.log('✅ CrazyNinjaOdds Devigger analysis complete');
            
            return result;

        } catch (error) {
            console.error('❌ CrazyNinjaOdds Devigger API error:', error);
            return {
                success: false,
                message: `Devigger API Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Parse the devigger API response
     */
    private parseDeviggerResponse(responseText: string, originalData: OddsData): CrazyNinjaResponse {
        try {
            // Try to parse as JSON first
            let parsedData: any;
            try {
                parsedData = JSON.parse(responseText);
            } catch {
                // If not JSON, treat as text response
                parsedData = { rawResponse: responseText };
            }

            // Extract analysis data if available
            const analysis: any = {
                expectedValue: 0,
                recommendation: 'Analysis pending',
                confidence: 0
            };

            // Look for specific values in the response
            if (typeof parsedData === 'object') {
                if (parsedData.ev_p) analysis.evPercent = parseFloat(parsedData.ev_p);
                if (parsedData.ev_d) analysis.evDollar = parseFloat(parsedData.ev_d);
                if (parsedData.fb_p) analysis.freeBetPercent = parseFloat(parsedData.fb_p);
                if (parsedData.kelly) analysis.kellyUnits = parseFloat(parsedData.kelly);
                if (parsedData.dm) analysis.devigMethod = parsedData.dm;
                if (parsedData.fo_o) analysis.finalOdds = parsedData.fo_o;
            }

            // Generate recommendation based on EV
            if (analysis.evPercent > 5) {
                analysis.recommendation = 'Strong positive EV - Consider betting';
                analysis.confidence = 85;
            } else if (analysis.evPercent > 0) {
                analysis.recommendation = 'Positive EV - Mild recommendation';
                analysis.confidence = 65;
            } else {
                analysis.recommendation = 'Negative EV - Avoid';
                analysis.confidence = 75;
            }

            return {
                success: true,
                data: parsedData,
                analysis,
                message: `Analyzed odds: ${originalData.preBoostOdds} → ${originalData.postBoostOdds} (${originalData.boostPercentage}% boost)`
            };

        } catch (error) {
            return {
                success: false,
                message: `Response parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                data: { rawResponse: responseText }
            };
        }
    }

    /**
     * Submit odds data (using devigger API as primary method)
     */
    async submitOdds(oddsData: OddsData): Promise<CrazyNinjaResponse> {
        console.log('🥷 Submitting odds to CrazyNinjaOdds...');
        return this.analyzeOddsWithDevigger(oddsData);
    }

    /**
     * Get betting recommendations (using devigger API)
     */
    async getRecommendations(oddsData: Partial<OddsData>): Promise<CrazyNinjaResponse> {
        console.log('🎯 Getting recommendations from CrazyNinjaOdds...');
        
        if (!oddsData.preBoostOdds || !oddsData.postBoostOdds || !oddsData.boostPercentage) {
            return {
                success: false,
                message: 'Missing required odds data for recommendations'
            };
        }

        const fullOddsData: OddsData = {
            sport: oddsData.sport || "Unknown",
            event: oddsData.event || "Boost Analysis",
            preBoostOdds: oddsData.preBoostOdds,
            postBoostOdds: oddsData.postBoostOdds,
            boostPercentage: oddsData.boostPercentage,
            betAmount: oddsData.betAmount,
            timestamp: new Date().toISOString(),
            sportsbook: oddsData.sportsbook || "Unknown"
        };

        return this.analyzeOddsWithDevigger(fullOddsData);
    }

    /**
     * Test API connection using the devigger endpoint
     */
    async testConnection(): Promise<CrazyNinjaResponse> {
        try {
            console.log('🔍 Testing CrazyNinjaOdds Devigger API connection...');
            
            // Test with simple odds
            const testParams = new URLSearchParams({
                'api': 'open',
                'LegOdds': '+100',
                'FinalOdds': '+150',
                'DevigMethod': '0'
            });

            const url = `${this.baseURL}/api/devigger/v1/sportsbook_devigger.aspx?${testParams}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'iPad-Screen-Monitor/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('✅ CrazyNinjaOdds Devigger API connection successful');

            return {
                success: true,
                message: 'Connection test successful',
                data: { testResponse: responseText }
            };

        } catch (error) {
            console.error('❌ CrazyNinjaOdds API connection test failed:', error);
            return {
                success: false,
                message: `Connection Test Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}

export const crazyNinjaAPI = new CrazyNinjaOddsAPI();
