// One-off script: posts the rules message through a Discord webhook.
// Run it ONCE from your PC (Node 18+):
//   Windows (PowerShell):  $env:WEBHOOK_URL="PASTE_URL_HERE"; node send-rules.js
//   Linux / Mac:           WEBHOOK_URL="PASTE_URL_HERE" node send-rules.js
// The URL is read from the environment, so it never sits inside the code.

const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.error('Missing WEBHOOK_URL environment variable.');
  process.exit(1);
}

const rules = [
  ['NO ROOFS', 'Stay off all roofs.'],
  ['NO OUT OF ZONE KILLS', "Don't kill people outside the zone."],
  ['NO OVER TRASHTALK', 'Keep toxicity to a minimum.'],
  ['NO TRASHTALKING GIRLS', 'Zero toxic behavior towards female players.'],
  ['NO GLITCH ABUSING', 'No abusing bugs, exploits, or glitches.'],
  ['NO FRIEND / TEAM KILLS', "Don't kill your friends or teammates."]
];

const description =
  '> *Simple rules. Follow them or get kicked/banned.*\n\n' +
  rules
    .map(([title, text], i) => `\`RULE ${String(i + 1).padStart(2, '0')}\` - **${title}**\n• ${text}`)
    .join('\n\n');

const payload = {
  content: '@everyone', // delete this line if you don't want to ping everyone
  allowed_mentions: { parse: ['everyone'] },
  embeds: [
    {
      title: 'OFFICIAL SERVER RULES',
      description,
      color: 0x2b2d31,
      footer: { text: 'Moderation Team • Enforced 24/7' }
    }
  ]
};

(async () => {
  const res = await fetch(`${WEBHOOK_URL}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    console.log('Sent.');
  } else {
    console.error(`Failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
})();
