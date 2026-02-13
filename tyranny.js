if (!String.prototype.toWellFormed) {
  String.prototype.toWellFormed = function () {
    return this.toString();
  };
}

global.File = class File {};

const { Client } = require('discord.js-selfbot-v13');
const fs = require('fs');

const client = new Client({ checkUpdate: false });
const PREFIX = '>';
const startTime = new Date();

client.state = {
    reactEmoji: null,
    reactTarget: null,
    activeAR: new Map(),
    activeAR1: new Map(),
    activeOutlast: new Map(),
    outlastDelay: 1000,
    hushSelf: false,
    hushTargets: new Set(),
};

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.id === client.user.id && client.state.reactEmoji && !client.state.reactTarget) {
        message.react(client.state.reactEmoji).catch(() => {});
    }

    if (message.author.id === client.user.id && client.state.hushSelf && !message.content.startsWith(PREFIX)) {
        message.delete().catch(() => {});
        return;
    }

    if (client.state.hushTargets.has(message.author.id) && message.author.id !== client.user.id) {
        message.delete().catch(() => {});
    }

    if (message.author.id !== client.user.id || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();
    const state = client.state;

    await message.delete().catch(() => {});

    switch (command) {
        case 'help':
            const helpMessage = `
       -----------------
       |tyranny selfbot|
       -----------------
- reactions
           >r 
            >rs - stops reacting
- autoreply
           >ar 
            >sar - stops ar 
           >ar1 
            >sar1 - stops ar1
- chatpacking
        >outlast 
         >soutlast - stops outlast 
          >odelay - outlast delay/s
- misc
    >av
    >purge
    >ping
    >hush
    >stream
     >ss - stops stream`;
            await message.channel.send('```\n' + helpMessage + '\n```');
            break;

        case 'ping': {
            const uptime = new Date() - startTime;
            const days = Math.floor(uptime / 86400000);
            const hours = Math.floor((uptime % 86400000) / 3600000);
            const minutes = Math.floor((uptime % 3600000) / 60000);
            const seconds = Math.floor((uptime % 60000) / 1000);
            const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
            await message.channel.send(`\`\`\`Ping: ${client.ws.ping.toFixed(2)}ms\nUptime: ${uptimeString}\`\`\``);
            break;
        }

        case 'stream': {
            const statusName = args.join(' ');
            if (!statusName) {
                await message.channel.send('```provide a stream message```');
                break;
            }
            client.user.setActivity(statusName, { type: 'STREAMING', url: 'https://twitch.tv/x' });
            await message.channel.send(`\`\`\`Status: streaming status set to "${statusName}"\`\`\``);
            break;
        }

        case 'ss': {
            client.user.setActivity(null);
            await message.channel.send('```activity cleared```');
            break;
        }

        case 'r': {
            if (args.length < 1) {
                await message.channel.send('```provide an emoji or user and emoji```');
                break;
            }

            let targetUser = null;
            let emoji = null;

            const mention = message.mentions.users.first();
            if (mention) {
                targetUser = mention;
                emoji = args.slice(1).join(' ');
            } else {
                const potentialUser = args[0];
                if (potentialUser && potentialUser.match(/^\d{17,19}$/)) {
                    try {
                        const user = await client.users.fetch(potentialUser);
                        targetUser = user;
                        emoji = args.slice(1).join(' ');
                        if (!emoji) {
                            await message.channel.send('```Error: provide an emoji```');
                            break;
                        }
                        state.reactEmoji = emoji;
                        state.reactTarget = targetUser.id;
                        await message.channel.send(`\`\`\`reacting to ${targetUser.tag} ${emoji}\`\`\``);
                    } catch {
                        emoji = args.join(' ');
                        state.reactEmoji = emoji;
                        state.reactTarget = null;
                        await message.channel.send(`\`\`\`selfreact --> ${emoji}\`\`\``);
                    }
                    break;
                } else {
                    emoji = args.join(' ');
                }
            }

            if (!emoji) {
                await message.channel.send('```provide an emoji```');
                break;
            }

            state.reactEmoji = emoji;
            state.reactTarget = targetUser ? targetUser.id : null;
            const targetText = targetUser ? ` to ${targetUser.tag}` : '';
            await message.channel.send(`\`\`\`React: reacting${targetText} with ${emoji}\`\`\``);
            break;
        }

        case 'rs': {
            state.reactEmoji = null;
            state.reactTarget = null;
            await message.channel.send('```react --> off```');
            break;
        }

        case 'ar': {
            if (args.length < 2) {
                await message.channel.send('```Usage: >ar <user> <message>```');
                break;
            }
            const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!targetUser) {
                await message.channel.send('```User not found```');
                break;
            }
            const replyMessage = args.slice(1).join(' ');

            if (state.activeAR.has(targetUser.id)) {
                client.removeListener('messageCreate', state.activeAR.get(targetUser.id).listener);
                state.activeAR.delete(targetUser.id);
            }

            const listener = (m) => {
                if (m.author.id === targetUser.id && m.author.id !== client.user.id) {
                    m.reply(replyMessage).catch(() => {});
                }
            };
            client.on('messageCreate', listener);
            state.activeAR.set(targetUser.id, { listener, replyMessage });
            await message.channel.send(`\`\`\`ar --> ${targetUser.tag}\`\`\``);
            break;
        }

        case 'ar1': {
            if (args.length < 2) {
                await message.channel.send('```Usage: >ar1 <user> <message>```');
                break;
            }
            const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!targetUser) {
                await message.channel.send('```User not found```');
                break;
            }
            const replyMessage = 'A\n' + '\n'.repeat(150) + args.slice(1).join(' ');

            if (state.activeAR1.has(targetUser.id)) {
                client.removeListener('messageCreate', state.activeAR1.get(targetUser.id).listener);
                state.activeAR1.delete(targetUser.id);
            }

            const listener = (m) => {
                if (m.author.id === targetUser.id && m.author.id !== client.user.id) {
                    m.reply(replyMessage).catch(() => {});
                }
            };
            client.on('messageCreate', listener);
            state.activeAR1.set(targetUser.id, { listener, replyMessage });
            await message.channel.send(`\`\`\`ar1 (flood) --> ${targetUser.tag}\`\`\``);
            break;
        }

        case 'sar': {
            if (args.length < 1) {
                await message.channel.send('```Usage: >sar <user>```');
                break;
            }
            const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!targetUser) {
                await message.channel.send('```User not found```');
                break;
            }
            const arData = state.activeAR.get(targetUser.id);
            if (arData) {
                client.removeListener('messageCreate', arData.listener);
                state.activeAR.delete(targetUser.id);
                await message.channel.send(`\`\`\`ar --> ${targetUser.tag} off\`\`\``);
            } else {
                await message.channel.send(`\`\`\`no active ar for ${targetUser.tag}\`\`\``);
            }
            break;
        }

        case 'sar1': {
            if (args.length < 1) {
                await message.channel.send('```Usage: >sar1 <user>```');
                break;
            }
            const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!targetUser) {
                await message.channel.send('```User not found```');
                break;
            }
            const ar1Data = state.activeAR1.get(targetUser.id);
            if (ar1Data) {
                client.removeListener('messageCreate', ar1Data.listener);
                state.activeAR1.delete(targetUser.id);
                await message.channel.send(`\`\`\`ar1 --> ${targetUser.tag} off\`\`\``);
            } else {
                await message.channel.send(`\`\`\`no active ar1 for ${targetUser.tag}\`\`\``);
            }
            break;
        }

        case 'outlast': {
            if (args.length < 1) {
                await message.channel.send('```Usage: >outlast <message>```');
                break;
            }
            const userMessage = args.join(' ');

            if (state.activeOutlast.has(message.channel.id)) {
                clearInterval(state.activeOutlast.get(message.channel.id));
            }

            let counter = 1;
            const interval = setInterval(() => {
                message.channel.send(`${userMessage}\n\`\`\`${counter}\`\`\``).catch(() => {});
                counter++;
            }, state.outlastDelay);

            state.activeOutlast.set(message.channel.id, interval);
            await message.channel.send('```outlast --> started```');
            break;
        }

        case 'odelay': {
            if (args.length < 1) {
                await message.channel.send('```Usage: >odelay <seconds>```');
                break;
            }
            const seconds = parseFloat(args[0]);
            if (isNaN(seconds) || seconds < 0) {
                await message.channel.send('```Error: Provide a valid number >= 0```');
                break;
            }
            state.outlastDelay = seconds * 1000;
            await message.channel.send(`\`\`\`Outlast delay set to ${seconds}s\`\`\``);
            break;
        }

        case 'soutlast': {
            const interval = state.activeOutlast.get(message.channel.id);
            if (interval) {
                clearInterval(interval);
                state.activeOutlast.delete(message.channel.id);
                await message.channel.send('```outlast --> off```');
            } else {
                await message.channel.send('```Outlast: No active outlast messages to stop in this channel.```');
            }
            break;
        }

        case 'av': {
            try {
                let user = message.mentions.users.first();
                if (!user && args[0]) {
                    user = await client.users.fetch(args[0]).catch(() => null);
                }
                if (!user) {
                    user = message.author;
                }
                if (!user) {
                    await message.channel.send('```could not find user```');
                    break;
                }
                await message.channel.send(user.displayAvatarURL({ dynamic: true, size: 1024 }));
            } catch (err) {
                await message.channel.send('```failed to fetch avatar```');
            }
            break;
        }

        case 'purge': {
            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount <= 0) {
                const errorMsg = await message.channel.send('```Error: Provide a valid number of messages to delete.```');
                if (errorMsg) setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
                break;
            }

            const fetchedMessages = await message.channel.messages.fetch({ limit: 100 }).catch(() => null);
            if (!fetchedMessages) {
                const errorMsg = await message.channel.send('```Error: Could not fetch messages.```');
                if (errorMsg) setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
                break;
            }

            const yourMessages = fetchedMessages.filter(m => m.author.id === client.user.id);
            const messagesToDelete = Array.from(yourMessages.values()).slice(0, amount);

            if (messagesToDelete.length === 0) {
                const errorMsg = await message.channel.send('```No recent messages of yours found to delete.```');
                if (errorMsg) setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
                break;
            }

            let deletedCount = 0;
            for (const msg of messagesToDelete) {
                try {
                    await msg.delete();
                    deletedCount++;
                } catch (err) {
                    console.error(`Failed to delete message ${msg.id}:`, err.message);
                }
            }

            if (deletedCount > 0) {
                const successMsg = await message.channel.send(`\`\`\`deleted ${deletedCount} of your messages.\`\`\``);
                if (successMsg) setTimeout(() => successMsg.delete().catch(() => {}), 5000);
            }
            break;
        }

        case 'hush': {
            if (args.length === 0) {
                state.hushSelf = true;
                await message.channel.send('```hush (self) --> on```');
                break;
            }

            if (args[0].toLowerCase() === 'off') {
                state.hushSelf = false;
                state.hushTargets.clear();
                await message.channel.send('```hush --> off```');
                break;
            }

            const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!targetUser) {
                await message.channel.send('```Error: user not found```');
                break;
            }

            if (state.hushTargets.has(targetUser.id)) {
                state.hushTargets.delete(targetUser.id);
                await message.channel.send(`\`\`\`hush --> ${targetUser.tag} off\`\`\``);
            } else {
                state.hushTargets.add(targetUser.id);
                await message.channel.send(`\`\`\`hush --> ${targetUser.tag}\`\`\``);
            }
            break;
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.id === client.user.id) return;
    if (client.state.reactEmoji && client.state.reactTarget && message.author.id === client.state.reactTarget) {
        message.react(client.state.reactEmoji).catch(() => {});
    }

    const nitroRegex = /(?:discord\.(?:gift|com\/gifts)|discordapp\.com\/gifts)\/([a-zA-Z0-9]{16,24})/gi;
    const matches = message.content.match(nitroRegex);
    
    if (matches) {
        for (const match of matches) {
            const code = match.split('/').pop();
            if (code && code.length >= 16 && code.length <= 24) {
                const channelName = message.channel.name || (message.channel.type === 1 ? 'DM' : 'Unknown');
                console.log(`[nitro sniper] Found code: ${code} in ${channelName} from ${message.author.tag}`);
                
                try {
                    const token = clientToken || client.token;
                    if (!token) {
                        console.log(`[nitro sniper] No token available`);
                        continue;
                    }

                    const https = require('https');
                    const url = require('url');
                    
                    const options = {
                        hostname: 'discord.com',
                        path: `/api/v9/entitlements/gift-codes/${code}/redeem`,
                        method: 'POST',
                        headers: {
                            'Authorization': token,
                            'Content-Type': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    };

                    await new Promise((resolve, reject) => {
                        const req = https.request(options, (res) => {
                            let data = '';
                            res.on('data', (chunk) => { data += chunk; });
                            res.on('end', () => {
                                if (res.statusCode === 200 || res.statusCode === 201) {
                                    console.log(`[Nitro Sniper] Successfully redeemed code: ${code}`);
                                    resolve();
                                } else {
                                    try {
                                        const errorData = JSON.parse(data);
                                        const errorMsg = errorData.message || `HTTP ${res.statusCode}`;
                                        reject(new Error(errorMsg));
                                    } catch {
                                        reject(new Error(`HTTP ${res.statusCode}`));
                                    }
                                }
                            });
                        });
                        
                        req.on('error', reject);
                        req.write('{}');
                        req.end();
                    });
                } catch (error) {
                    const errorMsg = error.message || 'Unknown error';
                    if (errorMsg.includes('already') || errorMsg.includes('redeemed') || errorMsg.includes('This gift has been redeemed')) {
                        console.log(`[Nitro Sniper] Code ${code} already redeemed`);
                    } else if (errorMsg.includes('invalid') || errorMsg.includes('expired') || errorMsg.includes('Unknown Gift Code')) {
                        console.log(`[Nitro Sniper]  Code ${code} is invalid or expired`);
                    } else {
                        console.log(`[Nitro Sniper] Failed to redeem ${code}: ${errorMsg}`);
                    }
                }
            }
        }
    }
});

client.on('error', (error) => console.error('Client error:', error));
client.on('warn', (warning) => console.warn('Client warning:', warning));

let clientToken = null;

try {
    clientToken = fs.readFileSync('token.txt', 'utf8').trim();
    client.login(clientToken);
} catch (error) {
    console.error("Couldn't read token.txt");
    process.exit(1);
}
