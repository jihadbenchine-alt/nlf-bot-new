// ================== Welcome System ==================
const { EmbedBuilder } = require('discord.js');
const { WELCOME_CHANNEL } = require('./config');

function setup(client) {
  client.on('guildMemberAdd', async (member) => {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('Welcome to LIGHT PvP')
      .setDescription(
`Welcome ${member}!

> Read the server rules.
> Join community .
> play in the server.
> Enjoy your stay!`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${member.guild.memberCount}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  });
}

module.exports = { setup };
