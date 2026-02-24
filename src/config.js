const log = require('./logger');

const REQUIRED_ENV = [
  'DISCORD_TOKEN',
  'GUILD_ID',
  'TARGET_INVITE_CODE',
  'DAOCON_ROLE_ID',
  'DAOFRIENDS_ROLE_ID',
  'ARCHIVE_CHANNEL_ID',
  'WELCOME_CHANNEL_ID',
  'FRIENDS_ONBOARD_CHANNEL_ID',
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  log.error('INIT', `missing env vars | keys=${missing.join(', ')}`);
  process.exit(1);
}

module.exports = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
  TARGET_INVITE_CODE: process.env.TARGET_INVITE_CODE,
  DAOCON_ROLE_ID: process.env.DAOCON_ROLE_ID,
  DAOFRIENDS_ROLE_ID: process.env.DAOFRIENDS_ROLE_ID,
  ARCHIVE_CHANNEL_ID: process.env.ARCHIVE_CHANNEL_ID,
  WELCOME_CHANNEL_ID: process.env.WELCOME_CHANNEL_ID,
  FRIENDS_ONBOARD_CHANNEL_ID: process.env.FRIENDS_ONBOARD_CHANNEL_ID,
  BUTTON_ID: 'start_onboarding',
  MODAL_ID: 'onboarding_modal',
};
