// ================== Welcome System + Auto Role ==================
// Every new member gets AUTO_ROLE_ID, then a welcome embed is posted.
const { EmbedBuilder } = require('discord.js');
const { WELCOME_CHANNEL, AUTO_ROLE_ID } = require('./config');

function setup(client) {
  client.on('guildMemberAdd', async (member) => {
    // Auto role (humans only)
    if (!member.user.bot) {
      try {
        await member.roles.add(AUTO_ROLE_ID, 'Auto role on join');
      } catch (err) {
        console.error(`Could not give auto role to ${member.user.tag}: ${err.message}`);
      }
    }

    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor('#ffffff')
      .setTitle('Welcome to Pulsar Role Play')
      .setDescription(
`Welcome ${member}!

> Read the server rules.
> Choose your roles.
> Meet the community.
> Enjoy your stay!`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${member.guild.memberCount}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  });
}

module.exports = { setup };
