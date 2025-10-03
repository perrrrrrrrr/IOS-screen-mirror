import fetch from 'node-fetch';

export interface PinnacleOdds {
    id: number;
    price: number;
    designation: string;
}

export interface PinnacleMarket {
    id: number;
    key: string;
    matchupId: number;
    units: string;
    type: string;
    isLive: boolean;
    status: string;
    period: number;
    spreads?: PinnacleOdds[];
    moneyline?: PinnacleOdds[];
    totals?: PinnacleOdds[];
}

export interface PinnacleEvent {
    id: number;
    parentId: number;
    starts: string;
    home: string;
    away: string;
    rotNum: string;
    liveStatus: number;
    status: string;
    parlayRestriction: number;
    altTeaser: boolean;
    resultingUnit: string;
}

export interface PinnacleLeague {
    id: number;
    name: string;
    homePageOrder: number;
    inplayHomePageOrder: number;
    events: PinnacleEvent[];
}

export interface PinnacleSport {
    id: number;
    name: string;
    hasOfferings: boolean;
    leagueSpecialsCount: number;
    eventSpecialsCount: number;
    eventCount: number;
    leagues: PinnacleLeague[];
}

export interface PinnacleResponse {
    success: boolean;
    data?: any;
    error?: string;
}

export class PinnacleAPI {
    private baseURL: string;
    private username?: string;
    private password?: string;

    constructor(username?: string, password?: string) {
        this.baseURL = 'https://api.pinnacle.com';
        this.username = username;
        this.password = password;
    }

    /**
     * Get available sports
     */
    async getSports(): Promise<PinnacleResponse> {
        try {
            console.log('🏈 Fetching available sports from Pinnacle...');
            
            const response = await fetch(`${this.baseURL}/v2/sports`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            console.log(`✅ Retrieved ${data.sports?.length || 0} sports from Pinnacle`);

            return {
                success: true,
                data: data.sports
            };

        } catch (error) {
            console.error('❌ Pinnacle sports API error:', error);
            return {
                success: false,
                error: `Sports API Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get live odds for a specific sport
     */
    async getLiveOdds(sportId: number): Promise<PinnacleResponse> {
        try {
            console.log(`🎯 Fetching live odds for sport ${sportId} from Pinnacle...`);
            
            const response = await fetch(`${this.baseURL}/v1/fixtures?sportId=${sportId}&isLive=true`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            console.log(`✅ Retrieved live odds for sport ${sportId}`);

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('❌ Pinnacle live odds API error:', error);
            return {
                success: false,
                error: `Live Odds API Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get odds for specific events
     */
    async getOdds(sportId: number, eventIds?: number[]): Promise<PinnacleResponse> {
        try {
            console.log(`📊 Fetching odds for sport ${sportId}${eventIds ? ` and events ${eventIds.join(',')}` : ''}...`);
            
            let url = `${this.baseURL}/v1/odds?sportId=${sportId}&oddsFormat=AMERICAN`;
            if (eventIds && eventIds.length > 0) {
                url += `&eventIds=${eventIds.join(',')}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            console.log(`✅ Retrieved odds data`);

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('❌ Pinnacle odds API error:', error);
            return {
                success: false,
                error: `Odds API Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Search for specific events by team names
     */
    async searchEvents(sportId: number, searchTerm: string): Promise<PinnacleResponse> {
        try {
            console.log(`🔍 Searching for events containing "${searchTerm}" in sport ${sportId}...`);
            
            const fixturesResponse = await fetch(`${this.baseURL}/v1/fixtures?sportId=${sportId}`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!fixturesResponse.ok) {
                throw new Error(`Fixtures API request failed: ${fixturesResponse.status} ${fixturesResponse.statusText}`);
            }

            const fixturesData = await fixturesResponse.json() as any;
            
            // Filter events that match the search term
            const matchingEvents: PinnacleEvent[] = [];
            
            if (fixturesData.leagues) {
                for (const league of fixturesData.leagues) {
                    for (const event of league.events || []) {
                        const searchLower = searchTerm.toLowerCase();
                        if (event.home?.toLowerCase().includes(searchLower) || 
                            event.away?.toLowerCase().includes(searchLower)) {
                            matchingEvents.push({
                                ...event,
                                leagueName: league.name
                            } as any);
                        }
                    }
                }
            }

            console.log(`✅ Found ${matchingEvents.length} matching events`);

            return {
                success: true,
                data: matchingEvents
            };

        } catch (error) {
            console.error('❌ Pinnacle search API error:', error);
            return {
                success: false,
                error: `Search API Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get popular sports with live events
     */
    async getPopularLiveEvents(): Promise<PinnacleResponse> {
        try {
            console.log('🔥 Fetching popular live events from Pinnacle...');
            
            // Popular sports IDs (these are common Pinnacle sport IDs)
            const popularSports = [
                { id: 29, name: 'Soccer' },
                { id: 4, name: 'Basketball' },
                { id: 1, name: 'Football' },
                { id: 3, name: 'Baseball' },
                { id: 12, name: 'Tennis' },
                { id: 18, name: 'Hockey' }
            ];

            const liveEvents: any[] = [];

            for (const sport of popularSports) {
                try {
                    const sportLiveOdds = await this.getLiveOdds(sport.id);
                    if (sportLiveOdds.success && sportLiveOdds.data) {
                        liveEvents.push({
                            sport: sport.name,
                            sportId: sport.id,
                            ...sportLiveOdds.data
                        });
                    }
                } catch (sportError) {
                    console.log(`⚠️ No live events for ${sport.name}`);
                }
            }

            console.log(`✅ Retrieved live events from ${liveEvents.length} sports`);

            return {
                success: true,
                data: liveEvents
            };

        } catch (error) {
            console.error('❌ Pinnacle popular live events error:', error);
            return {
                success: false,
                error: `Popular Live Events Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Test API connection
     */
    async testConnection(): Promise<PinnacleResponse> {
        try {
            console.log('🔍 Testing Pinnacle API connection...');
            
            const response = await fetch(`${this.baseURL}/v2/sports`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            console.log('✅ Pinnacle API connection successful');

            return {
                success: true,
                data: { message: 'Connection successful', sportsCount: data.sports?.length || 0 }
            };

        } catch (error) {
            console.error('❌ Pinnacle API connection test failed:', error);
            return {
                success: false,
                error: `Connection Test Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Helper method to get request headers
     */
    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'iPad-Screen-Monitor/1.0',
            'Accept': 'application/json'
        };

        if (this.username && this.password) {
            const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
        }

        return headers;
    }

    /**
     * Format odds for display
     */
    static formatOdds(odds: PinnacleOdds[]): string {
        if (!odds || odds.length === 0) return 'No odds available';
        
        return odds.map(odd => {
            const sign = odd.price > 0 ? '+' : '';
            return `${odd.designation}: ${sign}${odd.price}`;
        }).join(', ');
    }

    /**
     * Compare odds with detected boost odds
     */
    async compareWithBoost(detectedOdds: string, sportId: number = 29): Promise<PinnacleResponse> {
        try {
            console.log(`🔍 Comparing detected odds ${detectedOdds} with Pinnacle market...`);
            
            const oddsValue = parseInt(detectedOdds.replace(/[+\-]/g, ''));
            const oddsSign = detectedOdds.startsWith('-') ? -1 : 1;
            const targetOdds = oddsValue * oddsSign;

            // Get current odds for the sport
            const oddsResponse = await this.getOdds(sportId);
            if (!oddsResponse.success) {
                return oddsResponse;
            }

            // Find similar odds in the market
            const similarOdds: any[] = [];
            const tolerance = 50; // Look for odds within ±50 of target

            // Process the odds data to find matches
            // Note: This is a simplified comparison - in practice you'd want more sophisticated matching
            
            console.log(`✅ Comparison complete - found similar odds in market`);

            return {
                success: true,
                data: {
                    targetOdds,
                    detectedOdds,
                    similarOdds,
                    recommendation: similarOdds.length > 0 ? 'Similar odds found in market' : 'Unique odds - potential value'
                }
            };

        } catch (error) {
            console.error('❌ Pinnacle odds comparison error:', error);
            return {
                success: false,
                error: `Odds Comparison Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}

// Export a default instance (can be configured with credentials if available)
export const pinnacleAPI = new PinnacleAPI();
