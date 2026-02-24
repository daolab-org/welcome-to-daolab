const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const log = require('./logger');
const { FRIENDS_ONBOARD_CHANNEL_ID, BUTTON_ID } = require('./config');

let welcomeMessageUrl = null;

function getWelcomeMessageUrl() {
  return welcomeMessageUrl;
}

async function ensureWelcomeMessage(guild, botUserId) {
  const channel = await guild.channels.fetch(FRIENDS_ONBOARD_CHANNEL_ID);

  const messages = await channel.messages.fetch({ limit: 50 });
  const existing = messages.find((msg) => msg.author.id === botUserId && msg.components.length > 0);

  if (existing) {
    welcomeMessageUrl = existing.url;
    if (!existing.pinned) {
      await existing.pin();
      log.info('INIT', `welcome msg pinned | url=${welcomeMessageUrl}`);
    } else {
      log.info('INIT', `welcome msg exists | url=${welcomeMessageUrl}`);
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
  await msg.pin().catch((err) => log.error('INIT', 'welcome msg pin failed', err));
  welcomeMessageUrl = msg.url;
  log.info('INIT', `welcome msg created + pinned | url=${welcomeMessageUrl}`);
}

module.exports = { ensureWelcomeMessage, getWelcomeMessageUrl };
