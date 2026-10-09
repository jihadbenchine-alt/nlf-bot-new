// ================== Anti-Nuke Security ==================
// Works on EVERY server the bot is in (state is kept per-guild).
//  1) Someone deletes many channels in a short time  -> TIMEOUT.
//  2) An integration (bot/app) mass-renames channels -> integration removed,
//     and whoever added it is PERMANENTLY BANNED.
const { AuditLogEvent, EmbedBuilder } = require('discord.js');

const CFG = {
  CHANNEL_DELETE_LIMIT: 3,          // deletions allowed inside the window
  CHANNEL_RENAME_LIMIT: 3,          // renames allowed inside the window
  WINDOW_MS: 10 * 1000,             // 10 seconds
  TIMEOUT_MS: 24 * 60 * 60 * 1000,  // timeout length (max Discord allows: 28 days)
  // Never punished (besides the bot itself and each server's owner).
  // Add more with env SECURITY_WHITELIST="id1,id2"
  TRUSTED_IDS: [
    '1184988994765864960',
    ...(process.env.SECURITY_WHITELIST || '').split(',').map((s) => s.trim()).filter(Boolean)
  ],
  LOG_CHANNEL_ID: '1517981978346131597'
};

const hits = new Map(); // "guild:type:user" -> [timestamps]

function countHit(key) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < CFG.WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  return arr.length;
}

function isTrusted(client, guild, userId) {
  return userId === client.user.id || userId === guild.ownerId || CFG.TRUSTED_IDS.includes(userId);
}

async function log(guild, title, description) {
  const embed = new EmbedBuilder()
    .setColor('#ff3b3b')
    .setTitle(`🛡️ ${title}`)
    .setDescription(description)
    .setTimestamp();

  const ch = guild.channels.cache.get(CFG.LOG_CHANNEL_ID);
  if (ch?.isTextBased()) {
    return ch.send({ embeds: [embed] }).catch(() => {});
  }
  // Other servers: DM the owner
  const owner = await guild.fetchOwner().catch(() => null);
  if (owner) owner.send({ embeds: [embed.setFooter({ text: guild.name })] }).catch(() => {});
}

async function timeoutMember(guild, userId, reason) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return 'user not in server';
  try {
    await member.timeout(CFG.TIMEOUT_MS, reason);
    return 'timed out';
  } catch {}
  try {
    await member.kick(reason);
    return 'kicked (could not timeout)';
  } catch {}
  return 'FAILED (check bot role position / permissions)';
}

// Remove a bot/app integration and permanently ban whoever added it.
async function removeIntegration(client, guild, botUser, reason) {
  const result = [];

  // Who added it? (audit log BotAdd)
  let inviterId = null;
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 50 });
    inviterId = logs.entries.find((e) => e.targetId === botUser.id)?.executorId ?? null;
  } catch {}

  // Delete the integration
  try {
    const integrations = await guild.fetchIntegrations();
    for (const i of integrations.values()) {
      if (i.application?.id === botUser.id || i.account?.id === botUser.id) {
        await i.delete(reason).catch(() => {});
        result.push('integration deleted');
      }
    }
  } catch {}

  // Kick the bot itself
  try {
    await guild.members.kick(botUser.id, reason);
    result.push('bot kicked');
  } catch {
    result.push('bot kick FAILED');
  }

  // Permanent ban for the owner of the integration
  if (inviterId && !isTrusted(client, guild, inviterId)) {
    try {
      await guild.members.ban(inviterId, { reason, deleteMessageSeconds: 0 });
      result.push(`owner <@${inviterId}> PERMANENTLY BANNED`);
    } catch {
      result.push(`ban of <@${inviterId}> FAILED`);
    }
  } else if (!inviterId) {
    result.push('could not find who added the bot');
  }

  return result.join(' | ');
}

function setup(client) {
  client.on('guildAuditLogEntryCreate', async (entry, guild) => {
    try {
      const execId = entry.executorId;
      if (!execId || isTrusted(client, guild, execId)) return;

      const executor = entry.executor || (await client.users.fetch(execId).catch(() => null));
      const isBot = !!executor?.bot;

      // 1) Mass channel delete
      if (entry.action === AuditLogEvent.ChannelDelete) {
        const n = countHit(`${guild.id}:del:${execId}`);
        if (n < CFG.CHANNEL_DELETE_LIMIT) return;
        hits.delete(`${guild.id}:del:${execId}`);

        const reason = 'Anti-nuke: mass channel deletion';
        const action = isBot
          ? await removeIntegration(client, guild, executor, reason)
          : await timeoutMember(guild, execId, reason);

        return log(guild, 'Mass channel deletion blocked',
          `**User:** <@${execId}> (${execId})\n**Deleted:** ${n}+ channels in ${CFG.WINDOW_MS / 1000}s\n**Action:** ${action}`);
      }

      // 2) Mass channel rename
      if (
        entry.action === AuditLogEvent.ChannelUpdate &&
        entry.changes?.some((c) => c.key === 'name')
      ) {
        const n = countHit(`${guild.id}:ren:${execId}`);
        if (n < CFG.CHANNEL_RENAME_LIMIT) return;
        hits.delete(`${guild.id}:ren:${execId}`);

        if (isBot) {
          const reason = 'Anti-nuke: integration mass-renamed channels';
          const action = await removeIntegration(client, guild, executor, reason);
          return log(guild, 'Malicious integration removed',
            `**Integration:** <@${execId}> (${execId})\n**Renamed:** ${n}+ channels in ${CFG.WINDOW_MS / 1000}s\n**Action:** ${action}`);
        }

        const action = await timeoutMember(guild, execId, 'Anti-nuke: mass channel rename');
        return log(guild, 'Mass channel rename blocked',
          `**User:** <@${execId}> (${execId})\n**Renamed:** ${n}+ channels in ${CFG.WINDOW_MS / 1000}s\n**Action:** ${action}`);
      }
    } catch (err) {
      console.error('❌ security error:', err);
    }
  });

  console.log('🛡️ Anti-nuke security enabled');
}

module.exports = { setup };
