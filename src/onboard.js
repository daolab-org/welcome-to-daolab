const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const log = require('./logger');
const { FRIENDS_ONBOARD_CHANNEL_ID, BUTTON_ID } = require('./config');

let onboardMessageUrl = null;

function getOnboardMessageUrl() {
  return onboardMessageUrl;
}

async function ensureOnboardMessage(guild, botUserId) {
  const channel = await guild.channels.fetch(FRIENDS_ONBOARD_CHANNEL_ID);

  const messages = await channel.messages.fetch({ limit: 50 });
  const existing = messages.find((msg) => msg.author.id === botUserId && msg.components.length > 0);

  if (existing) {
    onboardMessageUrl = existing.url;
    if (!existing.pinned) {
      await existing.pin();
      log.info('INIT', `onboard msg pinned | url=${onboardMessageUrl}`);
    } else {
      log.info('INIT', `onboard msg exists | url=${onboardMessageUrl}`);
    }
    return;
  }

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
  await msg.pin().catch((err) => log.error('INIT', 'onboard msg pin failed', err));
  onboardMessageUrl = msg.url;
  log.info('INIT', `onboard msg created + pinned | url=${onboardMessageUrl}`);
}

module.exports = { ensureOnboardMessage, getOnboardMessageUrl };
