
// ================== Welcome System + Auto Role ==================
// Every new member gets the two auto roles, then a welcome embed is posted.
const { EmbedBuilder } = require('discord.js');
const { WELCOME_CHANNEL } = require('./config');
 
const AUTO_ROLES = [
  '1558959284283252796',
  '1558959285067849818',
];
 
function setup(client) {
  client.on('guildMemberAdd', async (member) => {
    // Auto roles (humans only)
    if (!member.user.bot) {
      for (const roleId of AUTO_ROLES) {
        try {
          await member.roles.add(roleId, 'Auto role on join');
        } catch (err) {
          console.error(`Could not give role ${roleId} to ${member.user.tag}: ${err.message}`);
        }
      }
    }
 
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL);
    if (!channel) {
      console.error(`Welcome channel ${WELCOME_CHANNEL} not found`);
      return;
    }
 
    const embed = new EmbedBuilder()
      .setColor('#00B3FF')
      .setTitle('Welcome to LIGHT PvP')
      .setDescription(
`Welcome ${member}!
 
> Read the server rules.
> Join and play in the server.
> Meet the community.
> Enjoy your stay!`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${member.guild.memberCount}` })
      .setTimestamp();
 
    try {
      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(`Could not send welcome message: ${err.message}`);
    }
  });
}
 
module.exports = { setup };
 
