const log = require('./logger');
const { WELCOME_CHANNEL_ID, FRIENDS_ONBOARD_CHANNEL_ID } = require('./config');
const { getOnboardMessageUrl } = require('./onboard');

async function notifyNewMember(member) {
  const tag = member.user.tag;
  const onboardMessageUrl = getOnboardMessageUrl();
  const greeting = `${member}님, **다오랩 프렌즈**에 오신 것을 환영합니다! 🎉\n\n`;

  const dmMessage =
    greeting +
    `온보딩을 완료하려면 아래 링크를 클릭해서 **온보딩 시작하기** 버튼을 눌러주세요.\n` +
    onboardMessageUrl;

  const dmSent = await member.send(dmMessage).catch(() => null);
  if (dmSent) return;

  log.warn('NOTIFY', `DM blocked | user=${tag}`);

  const fallbackMessage =
    greeting +
    `온보딩을 완료하려면 <#${FRIENDS_ONBOARD_CHANNEL_ID}> 채널에서 **온보딩 시작하기** 버튼을 클릭해주세요.`;

  const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
  if (channel) {
    await channel.send(fallbackMessage).catch((err) => {
      log.error('NOTIFY', `channel msg failed | user=${tag}`, err);
    });
  }
}

module.exports = { notifyNewMember };
