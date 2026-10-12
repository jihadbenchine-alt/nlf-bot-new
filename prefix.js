// ================== Prefix commands ($) ==================
// $kick $ban $unban $lock $unlock $mute $unmute $vmute $vunmute $vkick
// $warn $rolegive $roleremove $changenick $jail $unjail $aji $embed
// $rules (admin only)
// $removechann $kickall (owner only)
// $givemulrole (@roleA @roleB, or @everyone @role) $removemullrole
// ($warnpanel lives in embeds.js)
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { OWNER_ID, JAIL_ROLE_ID } = require('./config');

async function giveMulRole(message) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('Admin only.');
  }

  // Parse from the text so the order is exactly what was typed.
  // Two ways to use it:
  //   $givemulrole @roleWithMembers @roleToGive   -> everyone with roleA gets roleB
  //   $givemulrole @everyone @roleToGive          -> every (non-bot) member gets the role
  const toEveryone = /^\$givemulrole\s+(@everyone|everyone|all)(\s|$)/i.test(message.content.trim());
  const ids = [...message.content.matchAll(/<@&(\d+)>/g)].map((m) => m[1]);

  if (ids.length < (toEveryone ? 1 : 2)) {
    return message.reply(
      'Usage: `$givemulrole @roleWithMembers @roleToGive` or `$givemulrole @everyone @roleToGive`'
    );
  }

  const fromRole = toEveryone ? null : message.guild.roles.cache.get(ids[0]);
  const toRole = message.guild.roles.cache.get(toEveryone ? ids[0] : ids[1]);
  if (!toRole || (!toEveryone && !fromRole)) return message.reply('Role not found.');
  if (!toRole.editable) {
    return message.reply(`I can't give ${toRole.name}. Move my bot role above it first.`);
  }

  const status = await message.reply(
    toEveryone
      ? `Giving **${toRole.name}** to everyone...`
      : `Giving **${toRole.name}** to everyone with **${fromRole.name}**...`
  );

  await message.guild.members.fetch();
  const pool = toEveryone
    ? message.guild.members.cache.filter((m) => !m.user.bot)
    : fromRole.members;
  const targets = pool.filter((m) => !m.roles.cache.has(toRole.id));
  const already = pool.size - targets.size;

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

// ---------- Rules message ----------
const RULES = [
  ['NO ROOFS', 'Stay off all roofs.'],
  ['NO OUT OF ZONE KILLS', "Don't kill people outside the zone."],
  ['NO OVER TRASHTALK', 'Keep toxicity to a minimum.'],
  ['NO TRASHTALKING GIRLS', 'Zero toxic behavior towards female players.'],
  ['NO GLITCH ABUSING', 'No abusing bugs, exploits, or glitches.'],
  ['NO FRIEND / TEAM KILLS', "Don't kill your friends or teammates."]
];

function rulesEmbed() {
  const description =
    '> *Simple rules. Follow them or get kicked/banned.*\n\n' +
    RULES
      .map(([title, text], i) => `\`RULE ${String(i + 1).padStart(2, '0')}\` - **${title}**\n\u2022 ${text}`)
      .join('\n\n');

  return new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle('OFFICIAL SERVER RULES')
    .setDescription(description)
    .setFooter({ text: 'Moderation Team \u2022 Enforced 24/7' });
}

function setup(client) {
  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot || !message.guild) return;
      if (!message.content.startsWith('$')) return;

      const args = message.content.slice(1).trim().split(/ +/);
      const cmd = args.shift().toLowerCase();

      if (
        ['ban', 'unban', 'kick', 'lock', 'unlock'].includes(cmd) &&
        !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        return message.reply('Admin only.');
      }

      // $kick
      if (cmd === 'kick') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Mention a user.');

        try {
          await user.kick();
          return message.channel.send(`${user.user.tag} kicked.`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to kick user.');
        }
      }

      // $ban
      if (cmd === 'ban') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Mention a user.');

        try {
          await user.ban();
          return message.channel.send(`${user.user.tag} banned.`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to ban user.');
        }
      }

      // $unban
      if (cmd === 'unban') {
        const id = args[0];
        if (!id) return message.reply('User ID?');

        try {
          await message.guild.bans.remove(id);
          return message.channel.send('User unbanned.');
        } catch (err) {
          console.error(err);
          return message.reply('Failed to unban.');
        }
      }

      // $lock
      if (cmd === 'lock') {
        await message.channel.permissionOverwrites.edit(
          message.guild.roles.everyone,
          { SendMessages: false }
        );
        return message.channel.send('Channel locked.');
      }

      // $unlock
      if (cmd === 'unlock') {
        await message.channel.permissionOverwrites.edit(
          message.guild.roles.everyone,
          { SendMessages: true }
        );
        return message.channel.send('Channel unlocked.');
      }

      // $removechann (owner only) - deletes every channel in the server
      if (cmd === 'removechann') {
        if (message.author.id !== OWNER_ID)
          return message.reply('You are not allowed to use this command.');

        const channels = await message.guild.channels.fetch();

        for (const [, channel] of channels) {
          try {
            await channel.delete('Server reset');
          } catch (err) {
            console.log(`Failed to delete ${channel.name}: ${err.message}`);
          }
        }
        return;
      }

      // $kickall (owner only) - kicks every non-bot member
      if (cmd === 'kickall') {
        if (message.author.id !== OWNER_ID)
          return message.reply('You are not allowed to use this command.');

        const members = await message.guild.members.fetch();

        let kicked = 0;

        for (const [, member] of members) {
          if (member.user.bot) continue;
          if (member.id === message.author.id) continue;

          try {
            await member.kick('Kick all command');
            kicked++;
          } catch (err) {
            console.log(`Could not kick ${member.user.tag}: ${err.message}`);
          }
        }

        return message.channel.send(`Kicked ${kicked} members.`);
      }

      // $mute (1 hour timeout)
      if (cmd === 'mute') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Mention a user.');

        if (!user.moderatable) {
          return message.reply("I can't mute this user.");
        }

        try {
          await user.timeout(60 * 60 * 1000);
          return message.channel.send(`${user.user.tag} muted.`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to mute.');
        }
      }

      // $unmute
      if (cmd === 'unmute') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Mention a user.');

        try {
          await user.timeout(null);
          return message.channel.send(`${user.user.tag} unmuted.`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to unmute user.');
        }
      }

      // $vmute
      if (cmd === 'vmute') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Mention a user.');
        if (!user.voice.channel) return message.reply('User is not in a voice channel.');

        try {
          await user.voice.setMute(true);
          return message.channel.send(`${user.user.tag} voice muted.`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to voice mute user.');
        }
      }

      // $vunmute
      if (cmd === 'vunmute') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Mention a user.');
        if (!user.voice.channel) return message.reply('User is not in a voice channel.');

        try {
          await user.voice.setMute(false);
          return message.channel.send(`${user.user.tag} voice unmuted.`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to voice unmute.');
        }
      }

      // $vkick
      if (cmd === 'vkick') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Mention a user.');
        if (!user.voice.channel) return message.reply('User is not in a voice channel.');

        try {
          await user.voice.disconnect();
          return message.channel.send(`${user.user.tag} kicked from voice.`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to disconnect user.');
        }
      }

      // $warn
      if (cmd === 'warn') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Mention a user.');

        return message.channel.send(`${user} has been warned.`);
      }

      // $rolegive
      if (cmd === 'rolegive') {
        const user = message.mentions.members.first();
        const role = message.mentions.roles.first();

        if (!user || !role) return message.reply('Usage: $rolegive @user @role');

        try {
          await user.roles.add(role);
          return message.channel.send(`${role} added to ${user}.`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to add role.');
        }
      }

      // $roleremove
      if (cmd === 'roleremove') {
        const user = message.mentions.members.first();
        const role = message.mentions.roles.first();

        if (!user || !role) return message.reply('Usage: $roleremove @user @role');

        try {
          await user.roles.remove(role);
          return message.channel.send(`${role} removed from ${user}.`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to remove role.');
        }
      }

      // $changenick
      if (cmd === 'changenick') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Mention a user.');

        const newNick = args.slice(1).join(' ');
        if (!newNick) return message.reply('Write a nickname.');

        try {
          await user.setNickname(newNick);
          return message.channel.send(`Nickname changed to **${newNick}**`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to change nickname.');
        }
      }

      // $jail
      if (cmd === 'jail') {
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a user.');

        const jailRole = message.guild.roles.cache.get(JAIL_ROLE_ID);
        if (!jailRole) return message.reply('Jail role not found.');

        try {
          await member.roles.add(jailRole);
          return message.channel.send(`${member.user.tag} jailed.`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to jail user.');
        }
      }

      // $unjail
      if (cmd === 'unjail') {
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a user.');

        const jailRole = message.guild.roles.cache.get(JAIL_ROLE_ID);
        if (!jailRole) return message.reply('Jail role not found.');

        try {
          await member.roles.remove(jailRole);
          return message.channel.send(`${member.user.tag} unjailed.`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to unjail user.');
        }
      }

      // $aji @user - move a member to your voice channel
      if (cmd === 'aji') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Mention a user.');

        if (!message.member.voice.channel)
          return message.reply('You are not in a voice channel.');

        if (!user.voice.channel)
          return message.reply('User is not in a voice channel.');

        try {
          await user.voice.setChannel(message.member.voice.channel);
          return message.channel.send(`${user} moved to your voice channel.`);
        } catch (err) {
          console.error(err);
          return message.reply('Failed to move user.');
        }
      }

      // $givemulrole @roleWithMembers @roleToGive | $givemulrole @everyone @roleToGive
      if (cmd === 'givemulrole') {
        return giveMulRole(message);
      }

      // $removemullrole @role (also accepts $removemulrole)
      if (cmd === 'removemullrole' || cmd === 'removemulrole') {
        return removeMulRole(message);
      }

      // $rules (admin only) - posts the rules embed here; "$rules everyone" also pings @everyone
      if (cmd === 'rules') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return message.reply('Admin only.');
        }

        await message.delete().catch(() => {});
        const ping = args[0]?.toLowerCase() === 'everyone';

        return message.channel.send({
          content: ping ? '@everyone' : undefined,
          embeds: [rulesEmbed()],
          allowedMentions: ping ? { parse: ['everyone'] } : { parse: [] }
        });
      }

      // $embed
      if (cmd === 'embed') {
        const text = args.join(' ');
        if (!text) return message.reply('Write a message.');

        const embed = new EmbedBuilder()
          .setColor('#ffffff')
          .setDescription(text)
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error('Prefix command error:', err);
    }
  });
}

module.exports = { setup };
