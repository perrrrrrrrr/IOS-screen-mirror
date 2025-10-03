import { Client, GatewayIntentBits, AttachmentBuilder, TextChannel, ActivityType } from 'discord.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class DiscordBot {
    private client: Client;
    private originalChannelId = process.env.DISCORD_ORIGINAL_CHANNEL_ID || '1401729386524442664'; // Original channel for startup/shutdown messages
    private allBoostsChannelId = process.env.DISCORD_ALL_BOOSTS_CHANNEL_ID || '1402289756196573296'; // Channel for all boosts (PROD)
    private testBoostsChannelId = process.env.DISCORD_TEST_BOOSTS_CHANNEL_ID || '1403195870475845734'; // Channel for testing boost features (TEST)
    private highBoostsChannelId = process.env.DISCORD_HIGH_BOOSTS_CHANNEL_ID || '1402289981594144851'; // Channel for boosts over 28.5%
    private superHighBoostsChannelId = process.env.DISCORD_SUPER_HIGH_BOOSTS_CHANNEL_ID || '1402029678524502017'; // Channel for boosts over 50%
    private testingChannelId = process.env.DISCORD_TESTING_CHANNEL_ID || '1402843599237808149'; // Testing channel for odds scraping
    
    // Role IDs for pinging
    private readonly discrepancyAlertRoleId = process.env.DISCORD_DISCREPANCY_ALERT_ROLE_ID || '1402278097474158737'; // Role to ping for significant discrepancies
    private readonly highBoostRoleId = process.env.DISCORD_HIGH_BOOST_ROLE_ID || '1402278097474158737'; // Role for 50%+ boosts  
    private readonly shortOddsRoleId = process.env.DISCORD_SHORT_ODDS_ROLE_ID || '1402650782515462196'; // Role for short odds alerts

    constructor(token: string = process.env.DISCORD_BOT_TOKEN || '') {
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
        });

        this.client.login(token);
        this.client.once('ready', () => {
            console.log('Bot is ready!');
            this.setOnlineStatus();
        });
        
        // Listen for status check messages
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            // Respond to status check commands
            if (message.content.toLowerCase().includes('status') && message.mentions.has(this.client.user!)) {
                const uptime = this.formatUptime(Date.now() - (this.client.readyTimestamp || Date.now()));
                const statusMessage = `🟢 **I'm Online!** 🟢\n` +
                                    `**Status:** Active & Monitoring\n` +
                                    `**Uptime:** ${uptime}\n` +
                                    `**Last Response:** ${new Date().toLocaleTimeString()}`;
                
                await message.reply(statusMessage);
            }
        });
    }
    
    private formatUptime(ms: number): string {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    }

    // Set bot status to online with activity
    private async setOnlineStatus() {
        try {
            await this.client.user?.setPresence({
                activities: [{
                    name: 'Faster than the 🦥',
                    type: ActivityType.Custom
                }],
                status: 'online'
            });
            console.log('✅ Bot status set to online');
        } catch (error) {
            console.log('⚠️ Could not set bot status');
        }
    }

    // Get the appropriate boost channel (test or prod)
    private getBoostChannelId(useTestChannel: boolean = false): string {
        return useTestChannel ? this.testBoostsChannelId : this.allBoostsChannelId;
    }

    // Send simple system alert without boost formatting
    async sendSystemAlert(message: string, useTestChannel: boolean = false) {
        try {
            const channelId = this.getBoostChannelId(useTestChannel);
            const channel = await this.client.channels.fetch(channelId) as TextChannel;
            if (channel && channel.isTextBased()) {
                await channel.send(message);
                console.log(`📢 System alert sent to ${useTestChannel ? 'TEST' : 'PROD'} channel`);
            }
        } catch (error) {
            console.log(`⚠️ Failed to send system alert to channel:`, error);
        }
    }

    async sendMessage(message: string, channelId?: string) {
        try {
            const targetChannelId = channelId || this.originalChannelId;
            const channel = await this.client.channels.fetch(targetChannelId) as TextChannel;
            if (channel && channel.isTextBased()) {
                await channel.send(message);
            }
        } catch (error) {
            console.log('⚠️ Discord message failed (check channel ID)');
        }
    }

    // Send status update to show bot is online/offline
    async sendStatusUpdate(data: {
        uptime: string;
        lastBoostTime?: string;
        lastBoostPercentage?: number;
        totalBoostsDetected: number;
    }) {
        try {
            const statusEmoji = '🟢'; // Green circle for online
            const message = `${statusEmoji} **Bot Status Update** ${statusEmoji}\n` +
                          `**Status:** Online & Monitoring\n` +
                          `**Uptime:** ${data.uptime}\n` +
                          `**Total Boosts Detected:** ${data.totalBoostsDetected}\n` +
                          `${data.lastBoostTime ? `**Last Boost:** ${data.lastBoostPercentage}% at ${data.lastBoostTime}` : '**Last Boost:** None detected yet'}\n` +
                          `**Monitoring:** Active on all screens`;
            
            await this.sendMessage(message);
            console.log('📊 Status update sent');
        } catch (error) {
            console.log('⚠️ Status update failed');
        }
    }

    async sendBoostAlert(data: {
        percentage: number;
        timestamp: string;
        screenshotPath: string;
        oddsScreenshotPath?: string;
        boostDetailsScreenshotPath?: string;
        boostDetailsAnalysis?: { hasSeeAll: boolean; detectedText: string };
        preBoostOdds?: string | null;
        postBoostOdds?: string | null;
        betAmount?: string | null;
        boostCalculation?: any; // BoostCalculation type
        marketAnalysis?: {
            boostValue: number;
            marketComparison: string;
            recommendation: string;
        } | null;
        crazyNinjaAnalysis?: {
            evPercent?: number;
            recommendation?: string;
            kellyUnits?: number;
        } | null;
    }, useTestChannel: boolean = false) {
        try {
            // Send to appropriate channel (test or prod) with role tags
            const channelId = this.getBoostChannelId(useTestChannel);
            await this.sendBoostToChannel(data, channelId, useTestChannel);
            
            // Send timestamp as a separate message after the first message
            await this.sendTimestampFollowUp(data, channelId, useTestChannel);
            
            // Send boost image as a separate message if available
            if (data.screenshotPath) {
                await this.sendBoostImageFollowUp(data, channelId, useTestChannel);
            }
            
            // Send odds as a separate notification if available
            if (data.oddsScreenshotPath) {
                await this.sendOddsFollowUp(data, channelId, useTestChannel);
            }
            
            // Send boost details as a separate notification if available
            if (data.boostDetailsScreenshotPath) {
                await this.sendBoostDetailsFollowUp(data, channelId, useTestChannel);
            }
            
            // Send separator line at the very end
            await this.sendSeparatorFollowUp(channelId, useTestChannel);
            
        } catch (error) {
            console.log('⚠️ Discord boost alert failed (check channel IDs and bot permissions)');
        }
    }

    private async sendBoostToChannel(data: {
        percentage: number;
        timestamp: string;
        screenshotPath: string;
        oddsScreenshotPath?: string;
        preBoostOdds?: string | null;
        postBoostOdds?: string | null;
        betAmount?: string | null;
        boostCalculation?: any; // BoostCalculation type
    }, channelId: string, useTestChannel: boolean = false) {
        try {
            const channel = await this.client.channels.fetch(channelId) as TextChannel;
            if (channel && channel.isTextBased()) {
                // Don't attach boost image to first message - send it separately
                const attachments: AttachmentBuilder[] = [];
                
                // Add emojis based on boost percentage
                let boostText = `**${data.percentage}% Boost**`;
                if (data.percentage >= 300) {
                    boostText = `**☢☢☢${data.percentage}% Boost ☢☢☢**`;
                } else if (data.percentage >= 200) {
                    boostText = `**🌶🌶${data.percentage}% Boost 🌶🌶**`;
                } else if (data.percentage >= 100) {
                    boostText = `**🚀${data.percentage}% Boost 🚀**`;
                }
                
                let content = boostText;
                
                // Add test indicator if using test channel
                if (useTestChannel) {
                    if (data.percentage >= 300) {
                        content = `🧪 **TEST - ☢☢☢${data.percentage}% Boost ☢☢☢** 🧪`;
                    } else if (data.percentage >= 200) {
                        content = `🧪 **TEST - 🌶🌶${data.percentage}% Boost 🌶🌶** 🧪`;
                    } else if (data.percentage >= 100) {
                        content = `🧪 **TEST - 🚀${data.percentage}% Boost 🚀** 🧪`;
                    } else {
                        content = `🧪 **TEST - ${data.percentage}% Boost** 🧪`;
                    }
                }
                
                // Add odds information if available (simplified format with pipe separator and center alignment)
                if (data.preBoostOdds) {
                    const oddsText = data.postBoostOdds 
                        ? `${data.preBoostOdds} → ${data.postBoostOdds}`
                        : data.preBoostOdds;
                    
                    // Create center-aligned text using Discord formatting
                    content = `**${content.replace(/\*\*/g, '')} | ${oddsText}**`;
                }
                
                // Add boost verification if available and significant discrepancy detected
                if (data.boostCalculation && data.boostCalculation.discrepancy >= 10) {
                    const calc = data.boostCalculation;
                    const verificationEmoji = calc.discrepancy < 2 ? '✅' : calc.discrepancy < 5 ? '⚠️' : '🚨';
                    content += `\n\n📊 **Boost Verification:**`;
                    content += `\n🎯 **Detected:** ${calc.detectedBoostPercentage}%`;
                    content += `\n🧮 **Calculated:** ${calc.actualBoostPercentage}%`;
                    content += `\n${verificationEmoji} **Accuracy:** ${calc.discrepancy.toFixed(2)}% difference`;
                    
                    // Add alert for significant discrepancies
                    if (!useTestChannel) {
                        content += `\n\n🚨 **SIGNIFICANT DISCREPANCY** <@&${this.discrepancyAlertRoleId}>`;
                    }
                }
                
                // Tag roles based on boost percentage thresholds (only in prod, not test)
                if (!useTestChannel) {
                    if (data.percentage >= 50) {
                        // 50%+ boosts tag only high boost role
                        content += `\n<@&${this.highBoostRoleId}>`;
                    } else if (data.percentage >= 24 && data.percentage <= 49.5 && data.preBoostOdds) {
                        // 24-49.5% boosts with odds less than +500 get tagged
                        // Don't notify >=24% role and under 500 odds if over 49.5% (50% role will handle it)
                        const oddsNumber = parseInt(data.preBoostOdds.replace('+', ''));
                        if (oddsNumber < 500) {
                            content += `\n<@&${this.shortOddsRoleId}> 🎯 **Short Odds Alert**`;
                        }
                    }
                }
                
                const messageOptions: any = {
                    content: content
                };
                
                // Only add attachments if we have a valid screenshot path
                if (attachments.length > 0) {
                    messageOptions.files = attachments;
                }
                
                // Send the main boost message immediately
                await channel.send(messageOptions);
                
                // Log which channel was used
                const channelType = useTestChannel ? 'TEST' : 'PROD';
                console.log(`📢 Boost sent to ${channelType} channel: ${data.percentage}%`);
            }
        } catch (error) {
            console.log(`⚠️ Failed to send boost to channel ${channelId}:`, error);
            console.log(`🔍 Channel ID from env: ${this.allBoostsChannelId}`);
            console.log(`🔍 useTestChannel: ${useTestChannel}`);
        }
    }

    private async sendOddsFollowUp(data: {
        percentage: number;
        timestamp: string;
        screenshotPath: string;
        oddsScreenshotPath?: string;
        preBoostOdds?: string | null;
        postBoostOdds?: string | null;
        betAmount?: string | null;
        boostCalculation?: any; // BoostCalculation type
    }, channelId: string, useTestChannel: boolean = false) {
        try {
            if (!data.oddsScreenshotPath) return;
            
            const channel = await this.client.channels.fetch(channelId) as TextChannel;
            if (channel && channel.isTextBased()) {
                const attachment = new AttachmentBuilder(data.oddsScreenshotPath, { name: 'odds.png' });
                
                // Send only the image without any text
                const messageOptions = {
                    files: [attachment]
                };
                
                // Small delay before sending the follow-up (after timestamp)
                setTimeout(async () => {
                    await channel.send(messageOptions);
                    console.log(`📊 Odds image sent for ${data.percentage}% boost (no text)`);
                }, 1200); // 1.2 second delay (after timestamp)
            }
        } catch (error) {
            console.log(`⚠️ Failed to send odds follow-up to channel ${channelId}`);
        }
    }

    private async sendBoostDetailsFollowUp(data: {
        percentage: number;
        boostDetailsScreenshotPath?: string;
        boostDetailsAnalysis?: { hasSeeAll: boolean; detectedText: string };
    }, channelId: string, useTestChannel: boolean = false) {
        try {
            if (!data.boostDetailsScreenshotPath) return;
            
            const channel = await this.client.channels.fetch(channelId) as TextChannel;
            if (channel && channel.isTextBased()) {
                const attachment = new AttachmentBuilder(data.boostDetailsScreenshotPath, { name: 'boost_details.png' });
                
                // Send the image without any tagging or thread creation
                const messageOptions = {
                    files: [attachment]
                };
                
                // Small delay before sending the follow-up (after odds)
                setTimeout(async () => {
                    await channel.send(messageOptions);
                    console.log(`📊 Boost details image sent for ${data.percentage}% boost`);
                }, 1500); // 1.5 second delay (after odds message)
            }
        } catch (error) {
            console.log(`⚠️ Failed to send boost details follow-up to channel ${channelId}`);
        }
    }

    private async sendTimestampFollowUp(data: {
        timestamp: string;
        percentage: number;
    }, channelId: string, useTestChannel: boolean = false) {
        try {
            const channel = await this.client.channels.fetch(channelId) as TextChannel;
            if (channel && channel.isTextBased()) {
                // Handle different timestamp formats
                let formattedTime: string;
                
                // Check if timestamp is already a formatted time string (contains colons)
                if (data.timestamp.includes(':')) {
                    formattedTime = data.timestamp;
                } else {
                    // Try to parse as number or ISO string
                    const parsedDate = isNaN(Number(data.timestamp)) 
                        ? new Date(data.timestamp) 
                        : new Date(Number(data.timestamp));
                    
                    formattedTime = parsedDate.toLocaleTimeString();
                }
                
                // Send timestamp immediately after boost message
                await channel.send(`🕐 ${formattedTime}`);
                console.log(`🕐 Timestamp sent for ${data.percentage}% boost: ${formattedTime}`);
            }
        } catch (error) {
            console.log(`⚠️ Failed to send timestamp follow-up to channel ${channelId}`);
        }
    }

    private async sendBoostImageFollowUp(data: {
        screenshotPath: string;
        percentage: number;
    }, channelId: string, useTestChannel: boolean = false) {
        try {
            if (!data.screenshotPath) return;
            
            const channel = await this.client.channels.fetch(channelId) as TextChannel;
            if (channel && channel.isTextBased()) {
                const attachment = new AttachmentBuilder(data.screenshotPath, { name: 'boost.png' });
                
                // Send boost image with delay
                setTimeout(async () => {
                    await channel.send({ files: [attachment] });
                    console.log(`📸 Boost image sent for ${data.percentage}% boost`);
                }, 800); // 0.8 second delay (after timestamp, before odds)
            }
        } catch (error) {
            console.log(`⚠️ Failed to send boost image follow-up to channel ${channelId}`);
        }
    }

    private async sendSeparatorFollowUp(channelId: string, useTestChannel: boolean = false) {
        try {
            const channel = await this.client.channels.fetch(channelId) as TextChannel;
            if (channel && channel.isTextBased()) {
                // Send separator line at the end
                setTimeout(async () => {
                    await channel.send(`------------------------------------------`);
                    console.log(`📏 Separator line sent`);
                }, 3000); // 3 second delay (after all other messages)
            }
        } catch (error) {
            console.log(`⚠️ Failed to send separator follow-up to channel ${channelId}`);
        }
    }

    async sendPageChangeScreenshot(screenshotPath: string, contextMessage: string) {
        try {
            // For the original channel, just send a simple text message instead of screenshots
            await this.sendSimpleBoostUpdate(contextMessage);
        } catch (error) {
            console.log('⚠️ Discord page change notification failed');
        }
    }

    async sendSimpleBoostUpdate(contextMessage: string) {
        try {
            const channel = await this.client.channels.fetch(this.originalChannelId) as TextChannel;
            if (channel && channel.isTextBased()) {
                // Extract just the boost percentage and timestamp from the context message
                const boostMatch = contextMessage.match(/\*\*Current Boost:\*\* (\d+)%/);
                const timestampMatch = contextMessage.match(/at (.+)/);
                
                if (boostMatch && timestampMatch) {
                    const simpleMessage = `${boostMatch[1]}% boost at ${timestampMatch[1]}`;
                    await channel.send(simpleMessage);
                } else {
                    // Fallback to just sending the context message
                    await channel.send(contextMessage);
                }
            }
        } catch (error) {
            console.log('⚠️ Discord simple boost update failed (check channel ID and bot permissions)');
        }
    }

    async sendCurrentBoostToOriginalChannel(percentage: number, timestamp: string) {
        try {
            const channel = await this.client.channels.fetch(this.originalChannelId) as TextChannel;
            if (channel && channel.isTextBased()) {
                const simpleMessage = `${percentage}% boost at ${timestamp}`;
                await channel.send(simpleMessage);
                console.log(`📢 Simple boost update sent to original channel: ${simpleMessage}`);
            }
        } catch (error) {
            console.log('⚠️ Failed to send simple boost update to original channel');
        }
    }

    async sendStartupMessage() {
        const funnyMessages = [
            "🤖 **Beep Boop!** Your boost detection overlord has awakened! 👁️\nI'm now watching your screen like a caffeinated security guard... ☕👀",
            "🚀 **Houston, we have liftoff!** 🌙\nBoost Detection Bot is now online and ready to catch those sweet, sweet percentages! 🎯",
            "🔍 **SHERLOCK HOLMES MODE: ACTIVATED** 🕵️‍♂️\nThe game is afoot! I shall deduce every boost percentage with the precision of a Victorian detective! 🔎",
            "🎮 **ACHIEVEMENT UNLOCKED:** Bot Started Successfully! 🏆\nNow scanning for boosts with the intensity of a gamer looking for legendary loot... 💎",
            "🦅 **EAGLE EYE ENGAGED!** 🎯\nI see everything... EVERYTHING! Your boost percentages cannot hide from my digital gaze! 👁️‍🗨️",
            "🎪 **Ladies and gentlemen, the show has begun!** 🎭\nStep right up to witness the most amazing boost-detecting bot in the digital circus! 🤹‍♂️",
            "🧙‍♂️ **A wild Bot appeared!** ✨\nBot used 'Screen Monitor'... It's super effective! 📈",
            "🚨 **ALERT:** Professional Boost Stalker has entered the building! 🕵️\nNo percentage shall escape my watchful algorithms! 💻"
        ];

        const randomMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
        
        try {
            await this.sendMessage(randomMessage);
            console.log('📢 Funny startup message sent to Discord!');
        } catch (error) {
            console.log('📢 Startup message failed (but bot is still running!)');
        }
    }

    async sendShutdownMessage() {
        const shutdownMessages = [
            "🛑 **Bot shutting down...** 💤\nYour digital watchdog is taking a nap. Don't worry, I'll be back! 🐕‍🦺",
            "🌙 **Going offline...** ✨\nEven robots need their beauty sleep! Sweet dreams of boost percentages... 😴",
            "🚪 **Logging off...** 👋\nThe boost detection overlord must retire to the digital realm. Until next time! 🤖",
            "⏰ **Mission complete for now!** 🎯\nYour faithful screen monitor is powering down. See you on the flip side! 🔄",
            "🛌 **Time for a reboot break!** 💻\nEven the best algorithms need downtime. Stay boosted, my friend! 📈",
            "🌅 **End of shift!** 🏁\nThis digital detective is clocking out. The case files will be here when I return! 🕵️‍♂️"
        ];

        const randomMessage = shutdownMessages[Math.floor(Math.random() * shutdownMessages.length)];
        
        try {
            await this.sendMessage(randomMessage);
            console.log('📢 Shutdown message sent to Discord!');
            // Give a moment for the message to send before shutting down
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.log('📢 Shutdown message failed (but shutting down anyway)');
        }
    }
    
    // Send boost discrepancy alert to special monitoring channel
    async sendBoostDiscrepancyAlert(data: {
        calculation: any; // BoostCalculation type
        screenshotPath: string;
        timestamp: string;
    }) {
        try {
            const discrepancyChannelId = '1402315341140332630'; // Special channel for discrepancies
            const discrepancyChannel = this.client.channels.cache.get(discrepancyChannelId) as TextChannel;
            
            if (!discrepancyChannel) {
                console.error(`❌ Discrepancy channel not found: ${discrepancyChannelId}`);
                return;
            }
            
            const emoji = data.calculation.discrepancy >= 20 ? '🚨' : data.calculation.discrepancy >= 15 ? '⚠️' : '📊';
            
            const discrepancyMessage = `${emoji} **Boost Percentage Discrepancy Detected**\n\n` +
                   `📈 **Odds Change:** ${data.calculation.wasOdds} → ${data.calculation.nowOdds}\n` +
                   `🎯 **Detected Boost:** ${data.calculation.detectedBoostPercentage}%\n` +
                   `🧮 **Calculated Boost:** ${data.calculation.actualBoostPercentage}%\n` +
                   `📊 **Discrepancy:** ${data.calculation.discrepancy.toFixed(2)}% difference\n\n` +
                   `${data.calculation.discrepancy >= 20 ? '🚨 **MAJOR DISCREPANCY**' : 
                     data.calculation.discrepancy >= 15 ? '⚠️ **Significant difference**' : 
                     '📊 **Notable difference**'}\n\n` +
                   `⏰ ${data.timestamp}`;
            
            const attachment = new AttachmentBuilder(data.screenshotPath, { 
                name: `boost_discrepancy_${Date.now()}.png` 
            });
            
            await discrepancyChannel.send({
                content: discrepancyMessage,
                files: [attachment]
            });
            
            console.log(`✅ Boost discrepancy alert sent to channel ${discrepancyChannelId}`);
            
        } catch (error) {
            console.error('❌ Error sending boost discrepancy alert:', error);
        }
    }

    // Send odds testing data to testing channel
    async sendOddsTest(data: {
        originalOdds?: string;
        boostedOdds?: string;
        screenshotPath: string;
        timestamp: string;
        detectedText?: string;
    }) {
        try {
            const testingChannel = await this.client.channels.fetch(this.testingChannelId) as TextChannel;
            if (!testingChannel) {
                console.error(`❌ Testing channel not found: ${this.testingChannelId}`);
                return;
            }

            const attachment = new AttachmentBuilder(data.screenshotPath, { 
                name: `odds_test_${Date.now()}.png` 
            });

            let content = `🧪 **ODDS DETECTION TEST** 🧪\n⏰ ${data.timestamp}`;
            
            if (data.originalOdds && data.boostedOdds) {
                content += `\n📊 **Detected Odds:** Was ${data.originalOdds} → Now ${data.boostedOdds}`;
            } else if (data.originalOdds || data.boostedOdds) {
                content += `\n📊 **Partial Detection:** Original: ${data.originalOdds || 'Not found'}, Boosted: ${data.boostedOdds || 'Not found'}`;
            } else {
                content += `\n❌ **No odds detected**`;
            }

            if (data.detectedText) {
                content += `\n📝 **Raw OCR Text:** \`${data.detectedText}\``;
            }

            await testingChannel.send({
                content: content,
                files: [attachment]
            });

            console.log(`✅ Odds test data sent to testing channel`);
            
        } catch (error) {
            console.error('❌ Error sending odds test data:', error);
        }
    }
}

export async function testBot() {
    console.log('⚠️ Bot test skipped (update channel ID first)');
}