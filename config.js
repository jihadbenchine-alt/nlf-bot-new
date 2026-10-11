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
   AUTO_ROLE_ID: '1558959285067849818', // given automatically to every new member who joins
  PORT: process.env.PORT || 3000,

  TEMPLATES_DIR: path.join(__dirname, 'templates'),

  // General
  OWNER_ID,
  STAFF_ROLE_ID: '1558959258555654175',
  TICKET_CATEGORY_ID: '1558922189619728435',
  LOG_CHANNEL_ID: '1517981978346131597',
  WELCOME_CHANNEL: '1558959486406762606',
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
  WAITING_VC_ID: '1558959690648395877',
  PANEL_CHANNEL_ID: '1558966494811914362',

  // Embed channels
  NO_CHAT_CHANNEL_ID: '1558959407449251920',
  RATING_CHANNEL_ID: '1558959745258356806'
};
