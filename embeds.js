// ================== Embed channels + $givemulrole ==================
//  - NO-CHATTING channel: bot posts a warning embed; whoever writes there gets BANNED.
//  - RATING channel: whoever writes a rating there -> bot deletes the message and posts a rating embed.
//  - $givemulrole @roleA @roleB : everyone who has roleA gets roleB.
//  - $removemullrole @role : removes the role from everyone who has it.
const path = require('path');
const { EmbedBuilder, AttachmentBuilder, PermissionsBitField } = require('discord.js');
const {
  STAFF_ROLE_ID,
  TRUSTED_IDS,
  LOG_CHANNEL_ID,
  NO_CHAT_CHANNEL_ID,
  RATING_CHANNEL_ID
} = require('./config');

const CHANNELS = {
  [RATING_CHANNEL_ID]: { color: '#f1c40f', title: 'NEW RATING', by: 'Rated by', noSelf: true }
};

async function convertToEmbed(message, cfg) {
  // Nobody can rate themselves
  if (cfg.noSelf && message.mentions.users.has(message.author.id)) {
    await message.delete().catch(() => {});
    const warn = await message.channel.send(`${message.author}, you can't rate yourself.`);
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    return;
  }

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
      console.log('Could not re-upload image:', err.message);
    }
  }

  await message.channel.send({ embeds: [embed], files });
  await message.delete().catch((err) => console.log('Could not delete message:', err.message));
}

function warningEmbed() {
  return new EmbedBuilder()
    .setColor('#e74c3c')
    .setTitle('WARNING - NO CHATTING HERE')
    .setDescription(
      '**Anyone who writes in this channel will be BANNED.**\n\n' +
      'This channel is not for chatting. Do not send any message here.'
    )
    .setFooter({ text: 'Automatic protection' });
}

async function sendWarning(channel, client) {
  const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  const exists = recent?.some(
    (m) => m.author.id === client.user.id && m.embeds[0]?.title?.startsWith('WARNING')
  );
  if (!exists) await channel.send({ embeds: [warningEmbed()] });
}

// Anyone (except staff/admins/owner) who writes in the trap channel gets banned
async function banWriter(message) {
  const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (member) {
    const exempt =
      member.id === message.guild.ownerId ||
      TRUSTED_IDS.includes(member.id) ||
      member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      member.roles.cache.has(STAFF_ROLE_ID);
    if (exempt) return;
  }

  const reason = 'Wrote in the no-chatting channel';
  try {
    await message.guild.members.ban(message.author.id, { reason, deleteMessageSeconds: 3600 });
  } catch (err) {
    console.log(`Could not ban ${message.author.tag}: ${err.message}`);
    return;
  }
  await message.delete().catch(() => {});

  const log = message.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (log?.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('Banned (no-chatting channel)')
      .setDescription(`**User:** ${message.author.tag} (${message.author.id})\n**Message:** ${message.content.slice(0, 500) || '(no text)'}`)
      .setTimestamp();
    log.send({ embeds: [embed] }).catch(() => {});
  }
}

async function giveMulRole(message) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('Admin only.');
  }

  // Parse from the text so the order is exactly what was typed
  const ids = [...message.content.matchAll(/<@&(\d+)>/g)].map((m) => m[1]);
  if (ids.length < 2) {
    return message.reply('Usage: `$givemulrole @roleWithMembers @roleToGive`');
  }

  const fromRole = message.guild.roles.cache.get(ids[0]);
  const toRole = message.guild.roles.cache.get(ids[1]);
  if (!fromRole || !toRole) return message.reply('Role not found.');
  if (!toRole.editable) {
    return message.reply(`I can't give ${toRole.name}. Move my bot role above it first.`);
  }

  const status = await message.reply(`Giving **${toRole.name}** to everyone with **${fromRole.name}**...`);

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
    `Done!\nGiven: **${ok}** | Already had it: **${already}** | Failed: **${failed}**`
  );
}

async function removeMulRole(message) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('Admin only.');
  }

  const id = message.content.match(/<@&(\d+)>/)?.[1];
  if (!id) return message.reply('Usage: `$removemullrole @role`');

  const role = message.guild.roles.cache.get(id);
  if (!role) return message.reply('Role not found.');
  if (!role.editable) {
    return message.reply(`I can't remove ${role.name}. Move my bot role above it first.`);
  }

  const status = await message.reply(`Removing **${role.name}** from everyone who has it...`);

  await message.guild.members.fetch();
  const targets = role.members;

  let ok = 0;
  let failed = 0;
  for (const member of targets.values()) {
    try {
      await member.roles.remove(role, `$removemullrole by ${message.author.tag}`);
      ok++;
    } catch {
      failed++;
    }
  }

  return status.edit(`Done!\nRemoved from: **${ok}** | Failed: **${failed}**`);
}

function setup(client) {
  // Post the warning embed in the no-chatting channel (once)
  client.once('clientReady', async () => {
    const ch = await client.channels.fetch(NO_CHAT_CHANNEL_ID).catch(() => null);
    if (ch?.isTextBased()) sendWarning(ch, client).catch((e) => console.log('Warning embed:', e.message));
  });

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot || !message.guild) return;

      if (message.channelId === NO_CHAT_CHANNEL_ID) {
        if (message.content.toLowerCase().startsWith('$warnpanel') &&
            message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
          await message.delete().catch(() => {});
          return message.channel.send({ embeds: [warningEmbed()] });
        }
        return banWriter(message);
      }

      const cfg = CHANNELS[message.channelId];
      if (cfg) return convertToEmbed(message, cfg);

      const lower = message.content.toLowerCase();
      if (lower.startsWith('$removemullrole') || lower.startsWith('$removemulrole')) {
        return removeMulRole(message);
      }

      if (lower.startsWith('$givemulrole')) {
        return giveMulRole(message);
      }
    } catch (err) {
      console.error('Embeds error:', err);
    }
  });
}

module.exports = { setup };
