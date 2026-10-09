// ================== Embed channels + $givemulrole ==================
//  - BAN channel:    whoever writes there -> bot deletes the message and posts a "WILL BE BANNED" embed.
//  - RATING channel: whoever writes a rating there -> bot deletes the message and posts a rating embed.
//  - $givemulrole @roleA @roleB : everyone who has roleA gets roleB.
const path = require('path');
const { EmbedBuilder, AttachmentBuilder, PermissionsBitField } = require('discord.js');

const BAN_CHANNEL_ID = '1558083925585166347';
const RATING_CHANNEL_ID = '1558084520090275910';

const CHANNELS = {
  [BAN_CHANNEL_ID]: { color: '#e74c3c', title: '🔨 WILL BE BANNED', by: 'Reported by' },
  [RATING_CHANNEL_ID]: { color: '#f1c40f', title: '⭐ NEW RATING', by: 'Rated by' }
};

async function convertToEmbed(message, cfg) {
  const text = message.content.trim();
  const img = message.attachments.find((a) => a.contentType?.startsWith('image/'));
  if (!text && !img) return;

  const embed = new EmbedBuilder()
    .setColor(cfg.color)
    .setTitle(cfg.title)
    .setAuthor({
      name: message.member?.displayName || message.author.username,
      iconURL: message.author.displayAvatarURL()
    })
    .setFooter({ text: `${cfg.by} ${message.author.tag}` })
    .setTimestamp();

  if (text) embed.setDescription(text.slice(0, 4000));

  // Re-upload the image so it survives the original message being deleted
  const files = [];
  if (img) {
    try {
      const res = await fetch(img.url);
      const buf = Buffer.from(await res.arrayBuffer());
      const name = `image${path.extname(img.name || '') || '.png'}`;
      files.push(new AttachmentBuilder(buf, { name }));
      embed.setImage(`attachment://${name}`);
    } catch (err) {
      console.log('⚠️ Could not re-upload image:', err.message);
    }
  }

  await message.channel.send({ embeds: [embed], files });
  await message.delete().catch((err) => console.log('⚠️ Could not delete message:', err.message));
}

async function giveMulRole(message) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Admin only.');
  }

  // Parse from the text so the order is exactly what was typed
  const ids = [...message.content.matchAll(/<@&(\d+)>/g)].map((m) => m[1]);
  if (ids.length < 2) {
    return message.reply('Usage: `$givemulrole @roleWithMembers @roleToGive`');
  }

  const fromRole = message.guild.roles.cache.get(ids[0]);
  const toRole = message.guild.roles.cache.get(ids[1]);
  if (!fromRole || !toRole) return message.reply('❌ Role not found.');
  if (!toRole.editable) {
    return message.reply(`❌ I can't give ${toRole.name}. Move my bot role above it first.`);
  }

  const status = await message.reply(`⏳ Giving **${toRole.name}** to everyone with **${fromRole.name}**...`);

  await message.guild.members.fetch();
  const targets = fromRole.members.filter((m) => !m.roles.cache.has(toRole.id));
  const already = fromRole.members.size - targets.size;

  let ok = 0;
  let failed = 0;
  for (const member of targets.values()) {
    try {
      await member.roles.add(toRole, `$givemulrole by ${message.author.tag}`);
      ok++;
    } catch {
      failed++;
    }
  }

  return status.edit(
    `✅ Done!\nGiven: **${ok}** | Already had it: **${already}** | Failed: **${failed}**`
  );
}

function setup(client) {
  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot || !message.guild) return;

      const cfg = CHANNELS[message.channelId];
      if (cfg) return convertToEmbed(message, cfg);

      if (message.content.toLowerCase().startsWith('$givemulrole')) {
        return giveMulRole(message);
      }
    } catch (err) {
      console.error('❌ embeds error:', err);
    }
  });
}

module.exports = { setup };
