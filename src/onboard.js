const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const log = require('./logger');
const { FRIENDS_ONBOARD_CHANNEL_ID, BUTTON_ID } = require('./config');

let onboardMessageUrl = null;

function getOnboardMessageUrl() {
  return onboardMessageUrl;
}

async function ensureOnboardMessage(guild, botUserId) {
  const channel = await guild.channels.fetch(FRIENDS_ONBOARD_CHANNEL_ID);

  const existing = await findExistingMessage(channel, botUserId);
  const msg = existing ?? (await createOnboardMessage(channel));

  await ensurePinned(msg);
  onboardMessageUrl = msg.url;
}

async function findExistingMessage(channel, botUserId) {
  const messages = await channel.messages.fetch({ limit: 50 });
  return messages.find((msg) => msg.author.id === botUserId && msg.components.length > 0) ?? null;
}

async function createOnboardMessage(channel) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_ID)
      .setLabel('🎉 온보딩 시작하기')
      .setStyle(ButtonStyle.Primary),
  );

  const msg = await channel.send({
    content:
      '**다오랩 프렌즈에 오신 것을 환영합니다!**\n\n아래 버튼을 클릭하여 자기소개를 작성해주세요.',
    components: [row],
  });
  log.info('INIT', `onboard msg created | url=${msg.url}`);
  return msg;
}

async function ensurePinned(msg) {
  if (msg.pinned) return;
  await msg.pin().catch((err) => log.error('INIT', 'onboard msg pin failed', err));
  log.info('INIT', `onboard msg pinned | url=${msg.url}`);
}

module.exports = { ensureOnboardMessage, getOnboardMessageUrl };
