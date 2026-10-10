// ================== Shared config ==================
// All IDs and environment variables live here, every other file imports from this one.
const path = require('path');

const OWNER_ID = '1184988994765864960';

module.exports = {
  // Environment variables
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  API_SECRET: process.env.API_SECRET, // shared key the website sends to prove it may submit applications
  PORT: process.env.PORT || 3000,

  TEMPLATES_DIR: path.join(__dirname, 'templates'),

  // General
  OWNER_ID,
  STAFF_ROLE_ID: '1529665212381397052',
  TICKET_CATEGORY_ID: '1519306414416334909',
  LOG_CHANNEL_ID: '1517981978346131597',
  WELCOME_CHANNEL: '1542699174133506048',
  JAIL_ROLE_ID: '1558476226019196978', // set this to your real jail role ID

  // Never punished by security / trap channel (besides the bot itself and each server's owner).
  // Add more with env SECURITY_WHITELIST="id1,id2"
  TRUSTED_IDS: [
    OWNER_ID,
    ...(process.env.SECURITY_WHITELIST || '').split(',').map((s) => s.trim()).filter(Boolean)
  ],

  // Application system
  WHITELIST_ACCEPT_ROLE_ID: '1542699020449878046',
  STAFF_ACCEPT_ROLE_ID: '1542699019669602446',
  WHITELIST_CHANNEL_ID: '1542699450177294477',
  STAFF_CHANNEL_ID: '1542699453293658132',

  // Helping panel
  WAITING_VC_ID: '1504114205429731429',
  PANEL_CHANNEL_ID: '1558080648231649340',

  // Embed channels
  NO_CHAT_CHANNEL_ID: '1558083925585166347',
  RATING_CHANNEL_ID: '1558084520090275910'
};
