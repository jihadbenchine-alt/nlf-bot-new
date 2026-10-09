// ================== Helping Panel System ==================
// Someone joins the waiting VC -> bot posts a panel (with "Move to Helping") in the panel channel.
// Staff clicks the button -> user is moved, and the click is counted for that staff member.
// /checkhelping shows how many times each staff member did it.
const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField
} = require('discord.js');

const WAITING_VC_ID = '1504114205429731429';
const PANEL_CHANNEL_ID = '1558080648231649340';
const HELPING_VC_ID = ''; // <-- put the ID of the "Helping" voice channel here (if empty, bot looks for a VC named "helping")
const STAFF_ROLE_ID = '1529665212381397052';

const DATA_FILE = path.join(__dirname, 'data', 'helping.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { counts: {} };
  }
}
function save(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const panels = new Map(); // waiting userId -> { channelId, messageId }

function isStaff(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(STAFF_ROLE_ID)
  );
}

function findHelpingVc(guild) {
  if (HELPING_VC_ID) return guild.channels.cache.get(HELPING_VC_ID);
  return guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildVoice && c.name.toLowerCase().includes('helping')
  );
}

const commands = [
  {
    name: 'checkhelping',
    description: 'See how many times staff moved members to Helping',
    options: [
      { name: 'user', description: 'Check one staff member', type: 6, required: false }
    ]
  }
];

function setup(client) {
  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      if (newState.member?.user.bot) return;
      const userId = newState.id;

      const joined = newState.channelId === WAITING_VC_ID && oldState.channelId !== WAITING_VC_ID;
      const left = oldState.channelId === WAITING_VC_ID && newState.channelId !== WAITING_VC_ID;

      if (joined) {
        if (panels.has(userId)) return;
        const channel = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
        if (!channel) return console.log('⚠️ Panel channel not found');

        const embed = new EmbedBuilder()
          .setColor('#f1c40f')
          .setTitle('🎧 Member waiting for help')
          .setDescription(`${newState.member} joined <#${WAITING_VC_ID}> and is waiting.`)
          .setThumbnail(newState.member.user.displayAvatarURL())
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`help:move:${userId}`)
            .setLabel('Move to Helping')
            .setStyle(ButtonStyle.Success)
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });
        panels.set(userId, { channelId: channel.id, messageId: msg.id });
      }

      if (left) {
        const p = panels.get(userId);
        if (!p) return;
        panels.delete(userId);
        const channel = await client.channels.fetch(p.channelId).catch(() => null);
        const msg = await channel?.messages.fetch(p.messageId).catch(() => null);
        if (!msg || !msg.components[0]) return;
        const row = ActionRowBuilder.from(msg.components[0]);
        row.components.forEach((c) => c.setDisabled(true));
        const embed = EmbedBuilder.from(msg.embeds[0])
          .setColor('#95a5a6')
          .setFooter({ text: 'Member left the waiting VC' });
        await msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
      }
    } catch (err) {
      console.error('❌ helping voice error:', err);
    }
  });
}

// Returns true if the interaction was handled here.
async function handleInteraction(interaction) {
  // Button: Move to Helping
  if (interaction.isButton() && interaction.customId.startsWith('help:move:')) {
    if (!isStaff(interaction.member)) {
      await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
      return true;
    }

    const targetId = interaction.customId.split(':')[2];
    const target = await interaction.guild.members.fetch(targetId).catch(() => null);

    const disable = async (footer, color) => {
      const row = ActionRowBuilder.from(interaction.message.components[0]);
      row.components.forEach((c) => c.setDisabled(true));
      const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(color).setFooter({ text: footer });
      await interaction.update({ embeds: [embed], components: [row] });
    };

    if (!target || target.voice.channelId !== WAITING_VC_ID) {
      panels.delete(targetId);
      await disable('Member is no longer in the waiting VC', '#95a5a6');
      return true;
    }

    const helpingVc = findHelpingVc(interaction.guild);
    if (!helpingVc) {
      await interaction.reply({ content: '❌ Helping voice channel not found. Set HELPING_VC_ID in helping.js.', ephemeral: true });
      return true;
    }

    try {
      await target.voice.setChannel(helpingVc, `Moved to Helping by ${interaction.user.tag}`);
    } catch (err) {
      console.error('❌ move error:', err.message);
      await interaction.reply({ content: '❌ Failed to move (check Move Members permission).', ephemeral: true });
      return true;
    }

    const data = load();
    data.counts[interaction.user.id] = (data.counts[interaction.user.id] || 0) + 1;
    save(data);
    panels.delete(targetId);

    await disable(`✅ Moved by ${interaction.user.tag} (total: ${data.counts[interaction.user.id]})`, '#3ddc84');
    return true;
  }

  // Slash: /checkhelping
  if (interaction.isChatInputCommand() && interaction.commandName === 'checkhelping') {
    if (!isStaff(interaction.member)) {
      await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
      return true;
    }

    const counts = load().counts;
    const user = interaction.options.getUser('user');

    if (user) {
      await interaction.reply({
        content: `📊 ${user} moved **${counts[user.id] || 0}** member(s) to Helping.`,
        ephemeral: true
      });
      return true;
    }

    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('📊 Helping leaderboard')
      .setDescription(
        top.length
          ? top.map(([id, n], i) => `**${i + 1}.** <@${id}> — **${n}**`).join('\n')
          : 'No data yet.'
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  return false;
}

module.exports = { setup, handleInteraction, commands };
