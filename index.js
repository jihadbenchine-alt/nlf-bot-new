// ================== Nlf-bot entry point ==================
// This file only creates the client, loads the modules and starts the bot.
// Each feature lives in its own file:
//   config.js        shared env vars + IDs
//   security.js      anti-nuke
//   helping.js       helping panel + /checkhelping
//   embeds.js        no-chat trap, rating channel, $givemulrole, $removemullrole
//   welcome.js       welcome embed
//   slash.js         slash commands (/ping /say /joinvc /clear /clone /senddm /botdown)
//   prefix.js        $ prefix commands (moderation, roles, voice, ...)
//   applications.js  website API + Accept/Refuse buttons
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { TOKEN, CLIENT_ID, GUILD_ID } = require('./config');

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Missing TOKEN, CLIENT_ID or GUILD_ID environment variable.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration
  ]
});

const security = require('./security');
const helping = require('./helping');
const embeds = require('./embeds');
const welcome = require('./welcome');
const slash = require('./slash');
const prefix = require('./prefix');
const applications = require('./applications');

security.setup(client);
helping.setup(client);
embeds.setup(client);
welcome.setup(client);
slash.setup(client);
prefix.setup(client);
applications.setup(client);

// Register slash commands
const commands = [...slash.commands, ...helping.commands];
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Slash commands loaded');
  } catch (err) {
    console.error(err);
  }
})();

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
