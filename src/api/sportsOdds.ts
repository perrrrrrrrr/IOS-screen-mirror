import fetch from 'node-fetch';

export interface SportsOdds {
    id: string;
    sport_key: string;
    sport_title: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    bookmakers: Array<{
        key: string;
        title: string;
        last_update: string;
        markets: Array<{
            key: string;
            outcomes: Array<{
                name: string;
                price: number;
                point?: number;
            }>;
        }>;
    }>;
}

export interface OddsAPIResponse {
    success: boolean;
    data?: SportsOdds[];
    error?: string;
}

export class ThirdPartyOddsAPI {
    private apiKey?: string;
    private baseURL: string;

    constructor(apiKey?: string) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.the-odds-api.com';
    }

    /**
     * Get available sports from The Odds API (free tier available)
     */
    async getSports(): Promise<OddsAPIResponse> {
        try {
            console.log('🏈 Fetching available sports from The Odds API...');
            
            let url = `${this.baseURL}/v4/sports`;
            if (this.apiKey) {
                url += `?apiKey=${this.apiKey}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'iPad-Screen-Monitor/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            console.log(`✅ Retrieved ${data.length || 0} sports from The Odds API`);

            return {
                success: true,
                data: data
            };

        } catch (error) {
            console.error('❌ The Odds API sports error:', error);
            return {
                success: false,
                error: `Sports API Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get odds for a specific sport
     */
    async getOdds(sportKey: string = 'americanfootball_nfl'): Promise<OddsAPIResponse> {
        try {
            console.log(`🎯 Fetching odds for ${sportKey} from The Odds API...`);
            
            let url = `${this.baseURL}/v4/sports/${sportKey}/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
            if (this.apiKey) {
                url += `&apiKey=${this.apiKey}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'iPad-Screen-Monitor/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as SportsOdds[];
            console.log(`✅ Retrieved odds for ${data.length || 0} ${sportKey} events`);

            return {
                success: true,
                data: data
            };

        } catch (error) {
            console.error('❌ The Odds API odds error:', error);
            return {
                success: false,
                error: `Odds API Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get live/in-play odds
     */
    async getLiveOdds(sportKey: string = 'americanfootball_nfl'): Promise<OddsAPIResponse> {
        try {
            console.log(`⚡ Fetching live odds for ${sportKey}...`);
            
            let url = `${this.baseURL}/v4/sports/${sportKey}/odds?regions=us&markets=h2h&oddsFormat=american&dateFormat=iso`;
            if (this.apiKey) {
                url += `&apiKey=${this.apiKey}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'iPad-Screen-Monitor/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as SportsOdds[];
            
            // Filter for live/upcoming events
            const now = new Date();
            const liveEvents = data.filter(event => {
                const eventTime = new Date(event.commence_time);
                const timeDiff = eventTime.getTime() - now.getTime();
                return timeDiff < 24 * 60 * 60 * 1000; // Events within 24 hours
            });

            console.log(`✅ Retrieved ${liveEvents.length} live/upcoming ${sportKey} events`);

            return {
                success: true,
                data: liveEvents
            };

        } catch (error) {
            console.error('❌ The Odds API live odds error:', error);
            return {
                success: false,
                error: `Live Odds API Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Search for similar odds to detected boost
     */
    async findSimilarOdds(targetOdds: string, tolerance: number = 100): Promise<OddsAPIResponse> {
        try {
            console.log(`🔍 Searching for odds similar to ${targetOdds} (±${tolerance})...`);
            
            const targetValue = parseInt(targetOdds.replace(/[+\-]/g, ''));
            const isPositive = !targetOdds.startsWith('-');
            
            // Get odds from multiple popular sports
            const popularSports = [
                'americanfootball_nfl',
                'basketball_nba',
                'baseball_mlb',
                'soccer_usa_mls',
                'icehockey_nhl'
            ];

            const similarOdds: any[] = [];

            for (const sport of popularSports) {
                try {
                    const oddsResult = await this.getOdds(sport);
                    if (oddsResult.success && oddsResult.data) {
                        // Search through odds for similar values
                        for (const event of oddsResult.data) {
                            for (const bookmaker of event.bookmakers) {
                                for (const market of bookmaker.markets) {
                                    for (const outcome of market.outcomes) {
                                        const oddsValue = Math.abs(outcome.price);
                                        const oddsIsPositive = outcome.price > 0;
                                        
                                        // Check if odds are similar and same sign
                                        if (Math.abs(oddsValue - targetValue) <= tolerance && 
                                            oddsIsPositive === isPositive) {
                                            similarOdds.push({
                                                sport: event.sport_title,
                                                event: `${event.away_team} @ ${event.home_team}`,
                                                bookmaker: bookmaker.title,
                                                market: market.key,
                                                outcome: outcome.name,
                                                odds: outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`,
                                                commence_time: event.commence_time
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (sportError) {
                    console.log(`⚠️ Could not get odds for ${sport}`);
                }
            }

            console.log(`✅ Found ${similarOdds.length} similar odds`);

            return {
                success: true,
                data: similarOdds as any
            };

        } catch (error) {
            console.error('❌ Similar odds search error:', error);
            return {
                success: false,
                error: `Similar Odds Search Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Compare boost odds with market
     */
    async compareBoostWithMarket(preBoostOdds: string, postBoostOdds: string): Promise<{
        success: boolean;
        analysis?: {
            boostValue: number;
            marketComparison: string;
            similarOddsFound: number;
            recommendation: string;
        };
        error?: string;
    }> {
        try {
            console.log(`📊 Comparing boost ${preBoostOdds} -> ${postBoostOdds} with market...`);
            
            const preValue = parseInt(preBoostOdds.replace(/[+\-]/g, ''));
            const postValue = parseInt(postBoostOdds.replace(/[+\-]/g, ''));
            
            // Calculate boost value
            const boostValue = ((postValue - preValue) / preValue) * 100;
            
            // Find similar odds in the market
            const similarOddsResult = await this.findSimilarOdds(postBoostOdds, 50);
            const similarOddsCount = similarOddsResult.success ? 
                (similarOddsResult.data?.length || 0) : 0;
            
            let marketComparison = 'No comparison data available';
            let recommendation = 'Insufficient data for recommendation';
            
            if (similarOddsCount > 0) {
                marketComparison = `Found ${similarOddsCount} similar odds in the market`;
                if (similarOddsCount < 3) {
                    recommendation = 'Rare odds - potential value opportunity';
                } else if (similarOddsCount < 10) {
                    recommendation = 'Moderately common odds - standard market value';
                } else {
                    recommendation = 'Very common odds - likely fair market value';
                }
            } else {
                marketComparison = 'No similar odds found in major markets';
                recommendation = 'Unique odds - high potential value or niche market';
            }

            return {
                success: true,
                analysis: {
                    boostValue: Math.round(boostValue * 100) / 100,
                    marketComparison,
                    similarOddsFound: similarOddsCount,
                    recommendation
                }
            };

        } catch (error) {
            return {
                success: false,
                error: `Boost comparison error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Test API connection
     */
    async testConnection(): Promise<OddsAPIResponse> {
        try {
            console.log('🔍 Testing The Odds API connection...');
            
            const sportsResult = await this.getSports();
            
            if (sportsResult.success) {
                console.log('✅ The Odds API connection successful');
                return {
                    success: true,
                    data: sportsResult.data
                };
            } else {
                throw new Error(sportsResult.error || 'Connection test failed');
            }

        } catch (error) {
            console.error('❌ The Odds API connection test failed:', error);
            return {
                success: false,
                error: `Connection Test Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}

// Export a default instance
export const oddsAPI = new ThirdPartyOddsAPI();
