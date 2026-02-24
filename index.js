require('dotenv').config({ quiet: true });

const { Client, GatewayIntentBits, Events } = require('discord.js');
const log = require('./src/logger');
const config = require('./src/config');
const { cacheInvites, detectUsedInvite } = require('./src/invite');
const { ensureOnboardMessage } = require('./src/onboard');
const { notifyNewMember } = require('./src/notify');
const { handleButtonClick, handleModalSubmit } = require('./src/onboarding');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
  ],
});

client.once(Events.ClientReady, async () => {
  log.info('INIT', `bot ready | tag=${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(config.GUILD_ID);
    await cacheInvites(guild);
    await ensureOnboardMessage(guild, client.user.id);
    log.info('INIT', 'startup complete');
  } catch (error) {
    log.error('INIT', 'startup failed', error);
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== config.GUILD_ID) return;

  const tag = member.user.tag;
  const uid = member.user.id;
  log.info('JOIN', `member joined | user=${tag} uid=${uid}`);

  try {
    const usedInvite = await detectUsedInvite(member.guild);

    if (!usedInvite) {
      log.warn('JOIN', `invite undetected — possible race | user=${tag}`);
      return;
    }

    log.info(
      'JOIN',
      `invite detected | user=${tag} code=${usedInvite.code} uses=${usedInvite.uses}`,
    );

    if (usedInvite.code !== config.TARGET_INVITE_CODE) {
      log.info('JOIN', `non-target invite — skip | user=${tag} code=${usedInvite.code}`);
      return;
    }

    await member.roles.add(config.DAOCON_ROLE_ID);
    log.info('JOIN', `다오콘 role assigned | user=${tag}`);

    await notifyNewMember(member);
    log.info('JOIN', `notification sent | user=${tag}`);
  } catch (error) {
    log.error('JOIN', `member join failed | user=${tag}`, error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId === config.BUTTON_ID) {
    return handleButtonClick(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId === config.MODAL_ID) {
    return handleModalSubmit(interaction);
  }
});

client.login(config.DISCORD_TOKEN);
