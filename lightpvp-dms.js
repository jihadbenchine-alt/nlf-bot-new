// ================== Light PVP website: application DMs ==================
// When an admin accepts or refuses a staff application on the Light PVP website,
// the website marks that application in Firebase (dmPending: true).
// This module listens for those marks, sends the applicant a DM from this bot,
// then writes the result back so the admin panel shows "DM sent" or the error.
//
// Credentials (use ONE of these):
//   - env FIREBASE_SERVICE_ACCOUNT = the full service account JSON on one line (best for hosting panels)
//   - or a file ./serviceAccountKey.json next to this file (never share or commit it)
// Get it from: Firebase console > Project settings > Service accounts > Generate new private key
//
// If no credentials are found the module just logs a message and the rest of the bot keeps working.
const { EmbedBuilder } = require('discord.js');

let admin = null;
try {
  admin = require('firebase-admin');
} catch {
  admin = null;
}

function loadCredentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (err) {
      console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON:', err.message);
      return null;
    }
  }
  try {
    return require('./serviceAccountKey.json');
  } catch {
    return null;
  }
}

function buildEmbed(data) {
  const accepted = data.status === 'accepted';
  const name = data.name || 'there';

  const embed = new EmbedBuilder()
    .setColor(accepted ? '#3ddc84' : '#ff5c6c')
    .setTitle(accepted ? 'Light PVP Staff Application Accepted' : 'Light PVP Staff Application Refused')
    .setDescription(
      accepted
        ? `Hello ${name},\n\nYour staff application for **Light PVP** was **accepted**. Welcome to the team. A staff member will contact you with the next steps.`
        : `Hello ${name},\n\nThank you for applying for staff on **Light PVP**. After review, your application was **refused** this time. You are welcome to apply again later.`
    )
    .setTimestamp();

  if (data.adminNote) {
    embed.addFields({ name: 'Message from the staff team', value: String(data.adminNote).slice(0, 1000) });
  }
  return embed;
}

function startListener(client, db) {
  const inFlight = new Set();

  db.collection('applications')
    .where('dmPending', '==', true)
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'removed') return;

          const ref = change.doc.ref;
          const data = change.doc.data();
          if (inFlight.has(ref.id)) return;
          if (data.status !== 'accepted' && data.status !== 'refused') return;

          inFlight.add(ref.id);
          try {
            const user = await client.users.fetch(data.discordId);
            await user.send({ embeds: [buildEmbed(data)] });
            await ref.update({ dmPending: false, dmSent: true, dmError: '' });
            console.log(`Light PVP: DM sent to ${data.discordId} (${data.status})`);
          } catch (err) {
            // 50007 = the user has DMs closed (or shares no server with the bot)
            const reason =
              err && err.code === 50007
                ? 'The user has DMs closed or shares no server with the bot'
                : String((err && err.message) || err).slice(0, 200);
            console.error(`Light PVP: DM failed for ${data.discordId}: ${reason}`);
            await ref
              .update({ dmPending: false, dmSent: false, dmError: reason })
              .catch((e) => console.error('Light PVP: could not save DM result:', e.message));
          } finally {
            inFlight.delete(ref.id);
          }
        });
      },
      (err) => console.error('Light PVP application listener error:', err.message)
    );

  console.log('Light PVP application DMs enabled');
}

function setup(client) {
  if (!admin) {
    console.log('Light PVP DMs disabled: run "npm install" to install firebase-admin.');
    return;
  }

  const credentials = loadCredentials();
  if (!credentials) {
    console.log('Light PVP DMs disabled: no Firebase credentials (set FIREBASE_SERVICE_ACCOUNT or add serviceAccountKey.json).');
    return;
  }

  let db;
  try {
    const app = admin.initializeApp({ credential: admin.credential.cert(credentials) }, 'lightpvp');
    db = app.firestore();
  } catch (err) {
    console.error('Light PVP DMs disabled: Firebase init failed:', err.message);
    return;
  }

  client.once('clientReady', () => startListener(client, db));
}

module.exports = { setup };
