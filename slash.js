// ================== Slash commands ==================
// /ping /say /joinvc /clear /clone /senddm /botdown
// (/checkhelping lives in helping.js)
const fs = require('fs');
const path = require('path');
const { joinVoiceChannel } = require('@discordjs/voice');
const { PermissionsBitField, ChannelType } = require('discord.js');
const { TEMPLATES_DIR } = require('./config');

// Slash command definitions (index.js registers them)
const commands = [
  {
    name: 'ping',
    description: 'Bot ping'
  },
  {
    name: 'say',
    description: 'Send message',
    options: [
      { name: 'text', description: 'Message', type: 3, required: true }
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
      { name: 'amount', description: 'Amount', type: 4, required: true }
    ]
  },
  {
    name: 'senddm',
    description: 'Send DM to all members',
    options: [
      { name: 'message', description: 'Message to send', type: 3, required: true }
    ]
  },
  {
    name: 'botdown',
    description: 'Move all bot roles to the bottom of the role hierarchy'
  }
];

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

async function handleClone(interaction) {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: 'Admin only.', ephemeral: true });
  }

  const templateName = interaction.options.getString('template');
  const filePath = path.join(TEMPLATES_DIR, `${templateName}.json`);

  if (!fs.existsSync(filePath)) {
    return interaction.reply({
      content: `Template "${templateName}" not found.`,
      ephemeral: true
    });
  }

  let template;
  try {
    template = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return interaction.reply({
      content: 'Failed to read template file (invalid JSON).',
      ephemeral: true
    });
  }

  await interaction.reply({
    content: `Applying template **${templateName}**... this may take a moment.`,
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
        console.error(`Failed to create role ${r.name}:`, err.message);
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
        console.error(`Failed to create category ${cat.name}:`, err.message);
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
        console.error(`Failed to create channel ${ch.name}:`, err.message);
      }
    }
  }

  return interaction.followUp({
    content: `Template **${templateName}** applied.\nCreated: ${created} | Skipped (already existed): ${skipped}`,
    ephemeral: true
  });
}

async function handleBotDown(interaction) {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: 'Admin only.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const botRoles = interaction.guild.roles.cache
      .filter((r) => r.tags?.botId && r.id !== interaction.guild.id)
      .sort((a, b) => a.position - b.position);

    if (botRoles.size === 0) {
      return interaction.editReply('No bot roles found.');
    }

    let position = 1; // just above @everyone (0)
    for (const role of botRoles.values()) {
      await role.setPosition(position);
      position++;
    }

    return interaction.editReply(`Moved ${botRoles.size} bot roles to the bottom.`);
  } catch (err) {
    console.error('botdown error:', err);
    return interaction.editReply(
      'Failed. The Pulsar App role must be above the bot roles you want to move.'
    );
  }
}

async function handleSendDm(interaction) {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: 'Admin only.', ephemeral: true });
  }

  const text = interaction.options.getString('message');

  await interaction.reply({ content: 'Sending DMs...', ephemeral: true });

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

  return interaction.followUp({
    content: `Done!\nSent: ${success}\nFailed: ${failed}`,
    ephemeral: true
  });
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  switch (interaction.commandName) {
    case 'ping':
      return interaction.reply('Pong!');

    case 'say': {
      const text = interaction.options.getString('text');
      await interaction.reply({ content: 'Sent.', ephemeral: true });
      return interaction.channel.send(text);
    }

    case 'joinvc': {
      const vc = interaction.member.voice.channel;
      if (!vc) {
        return interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
      }
      joinVoiceChannel({
        channelId: vc.id,
        guildId: vc.guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator
      });
      return interaction.reply('Joined voice channel.');
    }

    case 'clear': {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
      }
      const amount = interaction.options.getInteger('amount');
      await interaction.channel.bulkDelete(amount, true);
      return interaction.reply({ content: `Deleted ${amount} messages.`, ephemeral: true });
    }

    case 'clone':
      return handleClone(interaction);

    case 'senddm':
      return handleSendDm(interaction);

    case 'botdown':
      return handleBotDown(interaction);
  }
}

function setup(client) {
  client.on('interactionCreate', (interaction) => {
    handleInteraction(interaction).catch((err) => console.error('Slash command error:', err));
  });
}

module.exports = { setup, commands };
