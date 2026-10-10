// ================== Applications (website API + review buttons) ==================
// The website's apply forms POST here. The bot itself sends the embed +
// Accept/Refuse buttons to Discord, so the buttons actually work (a plain
// webhook message isn't tied to an application and can't receive button clicks).
const express = require('express');
const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const {
  API_SECRET,
  PORT,
  STAFF_ROLE_ID,
  WHITELIST_ACCEPT_ROLE_ID,
  STAFF_ACCEPT_ROLE_ID,
  WHITELIST_CHANNEL_ID,
  STAFF_CHANNEL_ID
} = require('./config');

function isValidDiscordId(id) {
  return typeof id === 'string' && /^\d{15,25}$/.test(id);
}

// ---------- Accept / Refuse buttons ----------
async function handleReviewButton(client, interaction) {
  if (!interaction.isButton()) return;

  const parts = interaction.customId.split(':');
  if (!(parts.length === 3 && (parts[0] === 'wl' || parts[0] === 'st'))) return;

  const [appType, action, applicantId] = parts;

  const canReview =
    interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    interaction.member.roles.cache.has(STAFF_ROLE_ID);

  if (!canReview) {
    return interaction.reply({
      content: "You don't have permission to review this application.",
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
    console.log(`Could not fetch member ${applicantId}: ${err.message}`);
  }

  if (isAccept && member) {
    try {
      await member.roles.add(roleId);
    } catch (err) {
      console.error(`Failed to add role to ${applicantId}:`, err.message);
    }
  }

  let targetUser = member ? member.user : null;
  if (!targetUser) {
    try {
      targetUser = await client.users.fetch(applicantId);
    } catch (err) {
      console.log(`Could not fetch user ${applicantId}: ${err.message}`);
    }
  }

  if (targetUser) {
    const dmEmbed = new EmbedBuilder()
      .setColor(isAccept ? '#3ddc84' : '#ff5c6c')
      .setTitle(isAccept ? `${label} Application Accepted` : `${label} Application Refused`)
      .setDescription(
        isAccept
          ? `Congratulations! Your **${label}** application was accepted on Pulsar Role Play.`
          : `Sorry, your **${label}** application was refused this time. You can apply again later.`
      )
      .setTimestamp();

    try {
      await targetUser.send({ embeds: [dmEmbed] });
    } catch (err) {
      console.log(`Could not DM ${applicantId}: ${err.message}`);
    }
  }

  try {
    const originalEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(isAccept ? '#3ddc84' : '#ff5c6c')
      .setFooter({ text: `${isAccept ? 'Accepted' : 'Refused'} by ${interaction.user.tag}` });

    const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
    disabledRow.components.forEach((c) => c.setDisabled(true));

    await interaction.update({
      embeds: [updatedEmbed],
      components: [disabledRow]
    });
  } catch (err) {
    console.error('Failed to update application message:', err.message);
  }
}

// ---------- HTTP API ----------
function startApi(client) {
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
        .setTitle('Whitelist Application')
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
      console.error('Whitelist apply error:', err);
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
        .setTitle('Staff Application')
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
      console.error('Staff apply error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  app.listen(PORT, () => {
    console.log(`Application API listening on port ${PORT}`);
  });
}

function setup(client) {
  client.on('interactionCreate', (interaction) => {
    handleReviewButton(client, interaction).catch((err) =>
      console.error('Application button error:', err)
    );
  });

  startApi(client);
}

module.exports = { setup };
