


const { joinVoiceChannel } = require('@discordjs/voice');
const express = require('express');
const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, 'templates');

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const API_SECRET = process.env.API_SECRET; // shared key the website sends to prove it's allowed to submit applications
const PORT = process.env.PORT || 3000;

const STAFF_ROLE_ID = '1529665212381397052';
const TICKET_CATEGORY_ID = '1519306414416334909';
const LOG_CHANNEL_ID = '1517981978346131597';
const WELCOME_CHANNEL = '1542699174133506048';

// Application system
const WHITELIST_ACCEPT_ROLE_ID = '1542699020449878046';
const STAFF_ACCEPT_ROLE_ID = '1542699019669602446';
const WHITELIST_CHANNEL_ID = '1542699450177294477';
const STAFF_CHANNEL_ID = '1542699453293658132';

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

// Security + Helping modules
const security = require('./security');
const helping = require('./helping');
security.setup(client);
helping.setup(client);
require('./embeds').setup(client);

const commands = [
  {
    name: 'ping',
    description: 'Bot ping'
  },

  {
    name: 'say',
    description: 'Send message',
    options: [
      {
        name: 'text',
        description: 'Message',
        type: 3,
        required: true
      }
    ]
  },

  {
    name: 'joinvc',
    description: 'Join your voice channel'
  },

  {
    name: 'clone',
    description: 'Apply a saved template (roles + categories + channels) to this server',
    options: [
      {
        name: 'template',
        description: 'Which saved template to apply',
        type: 3,
        required: true,
        choices: fs.existsSync(TEMPLATES_DIR)
          ? fs
              .readdirSync(TEMPLATES_DIR)
              .filter((f) => f.endsWith('.json'))
              .slice(0, 25)
              .map((f) => {
                const name = f.replace(/\.json$/, '');
                return { name, value: name };
              })
          : []
      }
    ]
  },
{
  name: 'clear',
  description: 'Delete messages',
  options: [
    {
      name: 'amount',
      description: 'Amount',
      type: 4,
      required: true
    }
  ]
},
{
  name: 'senddm',
  description: 'Send DM to all members',
  options: [
    {
      name: 'message',
      description: 'Message to send',
      type: 3,
      required: true
    }
  ]
},
{
  name: 'botdown',
  description: 'Hbat rolat dyal botat l t7t f hierarchy'
}
];

commands.push(...helping.commands);

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      {
        body: commands
      }
    );

    console.log('✅ Slash commands loaded');
  } catch (err) {
    console.error(err);
  }
})();

client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
// Welcome System
client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL);

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor('#ffffff')
    .setTitle('🎉 Welcome to  Pulsar Role play')
    .setDescription(
`Welcome ${member}!

> 📜 Read the server rules.
> 🎮 Choose your roles.
> 💬 Meet the community.
> ❤️ Enjoy your stay!`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({
      text: `Member #${member.guild.memberCount}`
    })
    .setTimestamp();

  await channel.send({
    embeds: [embed]
  });
});

// Slash Commands
client.on('interactionCreate', async (interaction) => {

  if (await helping.handleInteraction(interaction)) return;

  // Whitelist / Staff application Accept-Refuse buttons
  if (interaction.isButton()) {

    const parts = interaction.customId.split(':');

    if (parts.length === 3 && (parts[0] === 'wl' || parts[0] === 'st')) {

      const [appType, action, applicantId] = parts;

      const canReview =
        interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        interaction.member.roles.cache.has(STAFF_ROLE_ID);

      if (!canReview) {
        return interaction.reply({
          content: '❌ Ma3ndekch permission bach t-review had l\'application.',
          ephemeral: true
        });
      }

      const isAccept = action === 'acc';
      const roleId = appType === 'wl' ? WHITELIST_ACCEPT_ROLE_ID : STAFF_ACCEPT_ROLE_ID;
      const label = appType === 'wl' ? 'Whitelist' : 'Staff';

      let member = null;
      try {
        member = await interaction.guild.members.fetch(applicantId);
      } catch (err) {
        console.log(`⚠️ Could not fetch member ${applicantId}: ${err.message}`);
      }

      if (isAccept && member) {
        try {
          await member.roles.add(roleId);
        } catch (err) {
          console.error(`❌ Failed to add role to ${applicantId}:`, err.message);
        }
      }

      let targetUser = member ? member.user : null;
      if (!targetUser) {
        try {
          targetUser = await client.users.fetch(applicantId);
        } catch (err) {
          console.log(`⚠️ Could not fetch user ${applicantId}: ${err.message}`);
        }
      }

      if (targetUser) {
        const dmEmbed = new EmbedBuilder()
          .setColor(isAccept ? '#3ddc84' : '#ff5c6c')
          .setTitle(isAccept ? `✅ ${label} Application Accepted` : `❌ ${label} Application Refused`)
          .setDescription(
            isAccept
              ? `Mabrouk! L'application dyalek dyal **${label}** tqbelate f Pulsar Role Play.`
              : `Sme7 lina, l'application dyalek dyal **${label}** tarfdate had l marra. Tqder t3awd t apply mnba3d.`
          )
          .setTimestamp();

        try {
          await targetUser.send({ embeds: [dmEmbed] });
        } catch (err) {
          console.log(`⚠️ Could not DM ${applicantId}: ${err.message}`);
        }
      }

      try {
        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
          .setColor(isAccept ? '#3ddc84' : '#ff5c6c')
          .setFooter({ text: `${isAccept ? '✅ Accepted' : '❌ Refused'} by ${interaction.user.tag}` });

        const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
        disabledRow.components.forEach((c) => c.setDisabled(true));

        await interaction.update({
          embeds: [updatedEmbed],
          components: [disabledRow]
        });
      } catch (err) {
        console.error('❌ Failed to update application message:', err.message);
      }

      return;
    }
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    return interaction.reply('🏓 Pong!');
  }
  if (interaction.commandName === 'botdown') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const botRoles = interaction.guild.roles.cache
        .filter((r) => r.tags?.botId && r.id !== interaction.guild.id)
        .sort((a, b) => a.position - b.position);

      if (botRoles.size === 0) {
        return interaction.editReply('❌ Ma lqitch rolat dyal botat.');
      }

      let position = 1; // fou9 @everyone (0) ghir
      for (const role of botRoles.values()) {
        await role.setPosition(position);
        position++;
      }

      return interaction.editReply(`✅ Hbatt ${botRoles.size} rolat dyal botat l t7t.`);
    } catch (err) {
      console.error('❌ botdown error:', err);
      return interaction.editReply(
        "❌ Failed. Ro9 rola dyal Pulsar App khass tkon fou9 mn rolat dyal l'botat li bghiti thabbet."
      );
    }
  }
  if (interaction.commandName === 'senddm') {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      content: '❌ Admin only.',
      ephemeral: true
    });
  }

  const text = interaction.options.getString('message');

  await interaction.reply({
    content: '📨 Sending DMs...',
    ephemeral: true
  });

  let success = 0;
  let failed = 0;

  const members = await interaction.guild.members.fetch();

  for (const [, member] of members) {
    if (member.user.bot) continue;

    try {
      await member.send(text);
      success++;
    } catch {
      failed++;
    }
  }

  await interaction.followUp({
    content: `✅ Done!\nSent: ${success}\nFailed: ${failed}`,
    ephemeral: true
  });

  return;
                  }
  if (interaction.commandName === 'say') {

    const text = interaction.options.getString('text');

    await interaction.reply({
      content: '✅ Sent.',
      ephemeral: true
    });

    return interaction.channel.send(text);
  }

  if (interaction.commandName === 'joinvc') {

    const vc = interaction.member.voice.channel;

    if (!vc) {
      return interaction.reply({
        content: '❌ Join a voice channel first.',
        ephemeral: true
      });
    }

    joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator
    });

    return interaction.reply('✅ Joined voice channel.');
  }

  if (interaction.commandName === 'clear') {

    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageMessages
      )
    ) {
      return interaction.reply({
        content: '❌ You do not have permission.',
        ephemeral: true
      });
    }

    const amount = interaction.options.getInteger('amount');

    await interaction.channel.bulkDelete(amount, true);

    return interaction.reply({
      content: `🧹 Deleted ${amount} messages.`,
      ephemeral: true
    });
  }

  if (interaction.commandName === 'clone') {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: '❌ Admin only.',
        ephemeral: true
      });
    }

    const templateName = interaction.options.getString('template');
    const filePath = path.join(TEMPLATES_DIR, `${templateName}.json`);

    if (!fs.existsSync(filePath)) {
      return interaction.reply({
        content: `❌ Template "${templateName}" not found.`,
        ephemeral: true
      });
    }

    let template;
    try {
      template = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      return interaction.reply({
        content: '❌ Failed to read template file (invalid JSON).',
        ephemeral: true
      });
    }

    await interaction.reply({
      content: `⏳ Applying template **${templateName}**... this may take a moment.`,
      ephemeral: true
    });

    const guild = interaction.guild;
    const roleMap = new Map(); // template role name -> created/existing Role object

    // 1. Roles
    for (const r of template.roles || []) {
      let role = guild.roles.cache.find((x) => x.name === r.name);
      if (!role) {
        try {
          role = await guild.roles.create({
            name: r.name,
            color: r.color || null,
            hoist: !!r.hoist,
            mentionable: !!r.mentionable,
            permissions: r.permissions
              ? PermissionsBitField.resolve(r.permissions)
              : undefined
          });
        } catch (err) {
          console.error(`❌ Failed to create role ${r.name}:`, err.message);
          continue;
        }
      }
      roleMap.set(r.name, role);
    }

    // 2. Categories + channels
    let created = 0;
    let skipped = 0;

    for (const cat of template.categories || []) {
      let categoryChannel = guild.channels.cache.find(
        (c) => c.name === cat.name && c.type === ChannelType.GuildCategory
      );

      if (!categoryChannel) {
        try {
          categoryChannel = await guild.channels.create({
            name: cat.name,
            type: ChannelType.GuildCategory,
            permissionOverwrites: buildOverwrites(cat.permissionOverwrites, roleMap, guild)
          });
          created++;
        } catch (err) {
          console.error(`❌ Failed to create category ${cat.name}:`, err.message);
          continue;
        }
      } else {
        skipped++;
      }

      for (const ch of cat.channels || []) {
        const exists = guild.channels.cache.find(
          (c) => c.name === ch.name && c.parentId === categoryChannel.id
        );
        if (exists) {
          skipped++;
          continue;
        }

        try {
          await guild.channels.create({
            name: ch.name,
            type: ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
            parent: categoryChannel.id,
            topic: ch.topic || undefined,
            permissionOverwrites: buildOverwrites(ch.permissionOverwrites, roleMap, guild)
          });
          created++;
        } catch (err) {
          console.error(`❌ Failed to create channel ${ch.name}:`, err.message);
        }
      }
    }

    return interaction.followUp({
      content: `✅ Template **${templateName}** applied.\nCreated: ${created} | Skipped (already existed): ${skipped}`,
      ephemeral: true
    });
  }

});

// Resolve a template's permissionOverwrites (referencing role names, or "@everyone")
// into the array format guild.channels.create expects.
function buildOverwrites(overwrites, roleMap, guild) {
  if (!overwrites || !Array.isArray(overwrites)) return undefined;

  const result = [];
  for (const ow of overwrites) {
    let id;
    if (ow.role === '@everyone') {
      id = guild.roles.everyone.id;
    } else {
      const role = roleMap.get(ow.role);
      if (!role) continue;
      id = role.id;
    }
    result.push({
      id,
      allow: ow.allow || [],
      deny: ow.deny || []
    });
  }
  return result;
}
client.on('messageCreate', async (message) => {

    if (message.author.bot) return;
    if (!message.content.startsWith('$')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    // خلي هنا الأوامر القديمة (+kick, +mute...) حتى ننقلوهم وحدة بوحدة.

  if (
    ['ban', 'unban', 'kick', 'lock', 'unlock'].includes(cmd) &&
    !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
  ) {
    return message.reply('❌ Admin only.');
  }

  // +kick
  if (cmd === 'kick') {

    const user = message.mentions.members.first();

    if (!user)
      return message.reply('❌ Mention a user.');

    try {

      await user.kick();

      return message.channel.send(
        `✅ ${user.user.tag} kicked.`
      );

    } catch (err) {

      console.error(err);

      return message.reply('❌ Failed to kick user.');

    }
  }

  // +ban
  if (cmd === 'ban') {

    const user = message.mentions.members.first();

    if (!user)
      return message.reply('❌ Mention a user.');

    try {

      await user.ban();

      return message.channel.send(
        `🔨 ${user.user.tag} banned.`
      );

    } catch (err) {

      console.error(err);

      return message.reply('❌ Failed to ban user.');

    }
  }

  // +unban
  if (cmd === 'unban') {

    const id = args[0];

    if (!id)
      return message.reply('❌ User ID?');

    try {

      await message.guild.bans.remove(id);

      return message.channel.send(
        '✅ User unbanned.'
      );

    } catch (err) {

      console.error(err);

      return message.reply('❌ Failed to unban.');

    }
  }

  // +lock
  if (cmd === 'lock') {

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      {
        SendMessages: false
      }
    );

    return message.channel.send('🔒 Channel locked.');
  }
if (cmd === 'removechann') {

  const allowedUserId = '1184988994765864960';

  if (message.author.id !== allowedUserId)
    return message.reply('❌ You are not allowed to use this command.');

  const channels = await message.guild.channels.fetch();

  for (const [, channel] of channels) {
    try {
      await channel.delete('Server reset');
    } catch (err) {
      console.log(`❌ Failed to delete ${channel.name}: ${err.message}`);
    }
  }

}
  if (cmd === 'kickall') {

  const allowedUserId = '1184988994765864960';

  if (message.author.id !== allowedUserId)
    return message.reply('❌ You are not allowed to use this command.');

  const members = await message.guild.members.fetch();

  let kicked = 0;

  for (const [, member] of members) {
    if (member.user.bot) continue;
    if (member.id === message.author.id) continue;

    try {
      await member.kick('Kick all command');
      kicked++;
    } catch (err) {
      console.log(`❌ Could not kick ${member.user.tag}: ${err.message}`);
    }
  }

  return message.channel.send(
    `✅ Kicked ${kicked} members.`
  );
  }
  // +unlock
  if (cmd === 'unlock') {

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      {
        SendMessages: true
      }
    );

    return message.channel.send('🔓 Channel unlocked.');
  }
  // +mute
      if (cmd === 'mute') {
  const user = message.mentions.members.first();

  if (!user) return message.reply('Mention user.');

  if (!user.moderatable) {
    return message.reply("❌ I can't mute this user.");
  }

  try {
    await user.timeout(60 * 60 * 1000);
    return message.channel.send(`🔇 ${user.user.tag} muted.`);
  } catch (err) {
    console.error(err);
    return message.reply('❌ Failed to mute.');
  }
      }
  // +unmute
  if (cmd === 'unmute') {

    const user = message.mentions.members.first();

    if (!user)
      return message.reply('❌ Mention a user.');

    try {

      await user.timeout(null);

      return message.channel.send(
        `🔊 ${user.user.tag} unmuted.`
      );
      } catch (err) {

  console.error(err);

  return message.reply('❌ Failed to unmute user.');

}
  }
    // +vmute
  if (cmd === 'vmute') {

    const user = message.mentions.members.first();

    if (!user)
      return message.reply('❌ Mention a user.');

    if (!user.voice.channel)
      return message.reply('❌ User is not in a voice channel.');

    try {

      await user.voice.setMute(true);

      return message.channel.send(
        `🎙️🔇 ${user.user.tag} voice muted.`
      );

    } catch (err) {

      console.error(err);

      return message.reply('❌ Failed to voice mute user.');

    }
  }

  // +vunmute
  if (cmd === 'vunmute') {

    const user = message.mentions.members.first();

    if (!user)
      return message.reply('❌ Mention a user.');

    if (!user.voice.channel)
      return message.reply('❌ User is not in a voice channel.');

    try {

      await user.voice.setMute(false);

      return message.channel.send(
        `🎙️🔊 ${user.user.tag} voice unmuted.`
      );

    } catch (err) {

      console.error(err);

      return message.reply('❌ Failed to voice unmute.');

    }
  }

  // +vkick
  if (cmd === 'vkick') {

    const user = message.mentions.members.first();

    if (!user)
      return message.reply('❌ Mention a user.');

    if (!user.voice.channel)
      return message.reply('❌ User is not in a voice channel.');

    try {

      await user.voice.disconnect();

      return message.channel.send(
        `🎙️❌ ${user.user.tag} kicked from voice.`
      );

    } catch (err) {

      console.error(err);

      return message.reply('❌ Failed to disconnect user.');

    }
        }
  // +warn
  if (cmd === 'warn') {

    const user = message.mentions.members.first();

    if (!user)
      return message.reply('❌ Mention a user.');

    return message.channel.send(
      `⚠️ ${user} has been warned.`
    );
  }

  // +rolegive
  if (cmd === 'rolegive') {

    const user = message.mentions.members.first();
    const role = message.mentions.roles.first();

    if (!user || !role)
      return message.reply(
        'Usage: +rolegive @user @role'
      );

    try {

      await user.roles.add(role);

      return message.channel.send(
        `✅ ${role} added to ${user}.`
      );

    } catch (err) {

      console.error(err);

      return message.reply('❌ Failed to add role.');

    }
  }

  // +roleremove
  if (cmd === 'roleremove') {

    const user = message.mentions.members.first();
    const role = message.mentions.roles.first();

    if (!user || !role)
      return message.reply(
        'Usage: +roleremove @user @role'
      );

    try {

      await user.roles.remove(role);

      return message.channel.send(
        `✅ ${role} removed from ${user}.`
      );

    } catch (err) {

      console.error(err);

      return message.reply('❌ Failed to remove role.');

    }
  }

  // +changenick
  if (cmd === 'changenick') {

    const user = message.mentions.members.first();

    if (!user)
      return message.reply('❌ Mention a user.');

    const newNick = args.slice(1).join(' ');

    if (!newNick)
      return message.reply('❌ Write a nickname.');

    try {

      await user.setNickname(newNick);

      return message.channel.send(
        `✏️ Nickname changed to **${newNick}**`
      );

    } catch (err) {

      console.error(err);

      return message.reply('❌ Failed to change nickname.');

    }
  }

  // +jail
  if (cmd === 'jail') {

    const member = message.mentions.members.first();

    if (!member)
      return message.reply('❌ Mention a user.');

    const jailRole =
      message.guild.roles.cache.get('PUT_JAIL_ROLE_ID_HERE');

    if (!jailRole)
      return message.reply('❌ Jail role not found.');

    try {

      await member.roles.add(jailRole);

      return message.channel.send(
        `🔒 ${member.user.tag} jailed.`
      );

    } catch (err) {

      console.error(err);

      return message.reply('❌ Failed to jail user.');

    }
  }

  // +unjail
  if (cmd === 'unjail') {

    const member = message.mentions.members.first();

    if (!member)
      return message.reply('❌ Mention a user.');

    const jailRole =
      message.guild.roles.cache.get('PUT_JAIL_ROLE_ID_HERE');

    if (!jailRole)
      return message.reply('❌ Jail role not found.');

    try {

      await member.roles.remove(jailRole);

      return message.channel.send(
        `🔓 ${member.user.tag} unjailed.`
      );

    } catch (err) {

      console.error(err);

      return message.reply('❌ Failed to unjail user.');

    }
  }
  // +aji @user
  if (cmd === 'aji') {

    const user = message.mentions.members.first();

    if (!user)
      return message.reply('❌ Mention a user.');

    if (!message.member.voice.channel)
      return message.reply('❌ You are not in a voice channel.');

    if (!user.voice.channel)
      return message.reply('❌ User is not in a voice channel.');

    try {

      await user.voice.setChannel(
        message.member.voice.channel
      );

      return message.channel.send(
        `✅ ${user} moved to your voice channel.`
      );

    } catch (err) {

      console.error(err);

      return message.reply('❌ Failed to move user.');

    }
  }

  // +embed
  if (cmd === 'embed') {

    const text = args.join(' ');

    if (!text)
      return message.reply('❌ Write a message.');

    const embed = new EmbedBuilder()
      .setColor('#ffffff')
      .setDescription(text)
      .setTimestamp();

    return message.channel.send({
      embeds: [embed]
    });
  }
      }
          )
// ================== Application HTTP API ==================
// The website's apply forms POST here. The bot itself sends the embed +
// Accept/Refuse buttons to Discord, so the buttons actually work (a plain
// webhook message isn't tied to an application and can't receive button
// clicks).

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

function checkApiKey(req, res) {
  if (API_SECRET && req.header('X-Api-Key') !== API_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function isValidDiscordId(id) {
  return typeof id === 'string' && /^\d{15,25}$/.test(id);
}

app.post('/apply/whitelist', async (req, res) => {
  if (!checkApiKey(req, res)) return;

  const { nameIrl, userDisc, idDisc, ageIrl, expRp, nameRp, ageRp, story } = req.body || {};

  if (!nameIrl || !userDisc || !idDisc || !ageIrl || !expRp || !nameRp || !ageRp || !story) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (!isValidDiscordId(idDisc)) {
    return res.status(400).json({ error: 'Invalid Discord ID' });
  }

  try {
    const channel = await client.channels.fetch(WHITELIST_CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Whitelist Application')
      .setColor('#ff3f7f')
      .addFields(
        { name: 'Name IRL', value: String(nameIrl).slice(0, 1024), inline: true },
        { name: 'Age IRL', value: String(ageIrl).slice(0, 1024), inline: true },
        { name: 'Discord User', value: String(userDisc).slice(0, 1024), inline: true },
        { name: 'Discord ID', value: String(idDisc).slice(0, 1024), inline: true },
        { name: 'Exp RP', value: String(expRp).slice(0, 1024), inline: true },
        { name: 'Name RP', value: String(nameRp).slice(0, 1024), inline: true },
        { name: 'Age RP', value: String(ageRp).slice(0, 1024), inline: true },
        { name: 'Story', value: String(story).slice(0, 1000) }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wl:acc:${idDisc}`).setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`wl:ref:${idDisc}`).setLabel('Refuse').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return res.json({ ok: true });
  } catch (err) {
    console.error('❌ Whitelist apply error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/apply/staff', async (req, res) => {
  if (!checkApiKey(req, res)) return;

  const { nameIrl, ageIrl, userDisc, idDisc, expStaff, qualities, hours } = req.body || {};

  if (!nameIrl || !ageIrl || !userDisc || !idDisc || !expStaff || !qualities || !hours) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (!isValidDiscordId(idDisc)) {
    return res.status(400).json({ error: 'Invalid Discord ID' });
  }

  try {
    const channel = await client.channels.fetch(STAFF_CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle('🎖️ Staff Application')
      .setColor('#7b3fff')
      .addFields(
        { name: 'Name IRL', value: String(nameIrl).slice(0, 1024), inline: true },
        { name: 'Age IRL', value: String(ageIrl).slice(0, 1024), inline: true },
        { name: 'Discord User', value: String(userDisc).slice(0, 1024), inline: true },
        { name: 'Discord ID', value: String(idDisc).slice(0, 1024), inline: true },
        { name: 'Hours Available', value: String(hours).slice(0, 1024), inline: true },
        { name: 'Exp Staff', value: String(expStaff).slice(0, 1000) },
        { name: 'Qualities', value: String(qualities).slice(0, 1000) }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`st:acc:${idDisc}`).setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`st:ref:${idDisc}`).setLabel('Refuse').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return res.json({ ok: true });
  } catch (err) {
    console.error('❌ Staff apply error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Application API listening on port ${PORT}`);
});

client.login(TOKEN);
    
