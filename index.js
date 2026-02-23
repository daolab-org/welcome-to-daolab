require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  MessageFlags,
  Events,
} = require('discord.js');

// --- 로거 ---
const log = {
  info: (phase, msg) => console.log(`[${phase}] ${msg}`),
  warn: (phase, msg) => console.warn(`[${phase}] WARN ${msg}`),
  error: (phase, msg, err) => console.error(`[${phase}] ERROR ${msg}`, err?.message ?? err ?? ''),
};

// --- 환경변수 검증 ---
const REQUIRED_ENV = [
  'DISCORD_TOKEN',
  'GUILD_ID',
  'TARGET_INVITE_CODE',
  'DAOCON_ROLE_ID',
  'DAOFRIENDS_ROLE_ID',
  'ARCHIVE_CHANNEL_ID',
  'WELCOME_CHANNEL_ID',
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  log.error('INIT', `missing env vars | keys=${missing.join(', ')}`);
  process.exit(1);
}

const {
  DISCORD_TOKEN,
  GUILD_ID,
  TARGET_INVITE_CODE,
  DAOCON_ROLE_ID,
  DAOFRIENDS_ROLE_ID,
  ARCHIVE_CHANNEL_ID,
  WELCOME_CHANNEL_ID,
} = process.env;

// --- 상수 ---
const BUTTON_ID = 'start_onboarding';
const MODAL_ID = 'onboarding_modal';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
  ],
});

const inviteCache = new Map();
let welcomeMessageUrl = null;

// --- 초기화 ---
client.once(Events.ClientReady, async () => {
  log.info('INIT', `bot ready | tag=${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await cacheInvites(guild);
    await ensureWelcomeMessage(guild);
    log.info('INIT', 'startup complete');
  } catch (error) {
    log.error('INIT', 'startup failed', error);
  }
});

async function cacheInvites(guild) {
  const invites = await guild.invites.fetch();
  invites.forEach((invite) => inviteCache.set(invite.code, invite.uses));
  log.info('INIT', `invites cached | count=${inviteCache.size}`);
}

async function ensureWelcomeMessage(guild) {
  const channel = await guild.channels.fetch(WELCOME_CHANNEL_ID);

  const messages = await channel.messages.fetch({ limit: 50 });
  const existing = messages.find(
    (msg) => msg.author.id === client.user.id && msg.components.length > 0,
  );

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

// --- 멤버 입장 처리 ---
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== GUILD_ID) return;

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

    if (usedInvite.code !== TARGET_INVITE_CODE) {
      log.info('JOIN', `non-target invite — skip | user=${tag} code=${usedInvite.code}`);
      return;
    }

    await member.roles.add(DAOCON_ROLE_ID);
    log.info('JOIN', `다오콘 role assigned | user=${tag}`);

    await notifyNewMember(member);
    log.info('JOIN', `notification sent | user=${tag}`);
  } catch (error) {
    log.error('JOIN', `member join failed | user=${tag}`, error);
  }
});

async function detectUsedInvite(guild) {
  const newInvites = await guild.invites.fetch();
  const used = newInvites.find((invite) => (inviteCache.get(invite.code) ?? 0) < invite.uses);

  // A-05 모니터링: 캐시 diff 로깅
  const changes = [];
  newInvites.forEach((invite) => {
    const prev = inviteCache.get(invite.code) ?? 0;
    if (prev !== invite.uses) {
      changes.push(`${invite.code}:${prev}->${invite.uses}`);
    }
    inviteCache.set(invite.code, invite.uses);
  });

  if (changes.length > 1) {
    log.warn('INVITE', `multiple invite changes — race possible | diff=[${changes.join(', ')}]`);
  } else if (changes.length === 1) {
    log.info('INVITE', `cache updated | diff=[${changes[0]}]`);
  }

  return used;
}

async function notifyNewMember(member) {
  const tag = member.user.tag;

  const dmMessage =
    `${member}님, **다오랩 프렌즈**에 오신 것을 환영합니다! 🎉\n\n` +
    `온보딩을 완료하려면 아래 링크를 클릭해서 **온보딩 시작하기** 버튼을 눌러주세요.\n` +
    welcomeMessageUrl;
  const channelMessage =
    `${member}님, **다오랩 프렌즈**에 오신 것을 환영합니다! 🎉\n\n` +
    `온보딩을 완료하려면 <#${WELCOME_CHANNEL_ID}> 채널에서 **온보딩 시작하기** 버튼을 클릭해주세요.`;

  const dmSent = await member.send(dmMessage).catch(() => null);
  if (!dmSent) log.warn('NOTIFY', `DM blocked | user=${tag}`);

  const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
  if (channel) {
    await channel.send(channelMessage).catch((err) => {
      log.error('NOTIFY', `channel msg failed | user=${tag}`, err);
    });
  }
}

// --- 인터랙션 처리 ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId === BUTTON_ID) {
    return handleButtonClick(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
    return handleModalSubmit(interaction);
  }
});

async function handleButtonClick(interaction) {
  const { member } = interaction;
  const tag = interaction.user.tag;

  if (member.roles.cache.has(DAOFRIENDS_ROLE_ID)) {
    log.info('BUTTON', `already onboarded — reject | user=${tag}`);
    return interaction.reply({
      content: '이미 온보딩을 완료하셨습니다.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!member.roles.cache.has(DAOCON_ROLE_ID)) {
    log.warn('BUTTON', `no 다오콘 role — reject | user=${tag}`);
    return interaction.reply({
      content: '온보딩 대상이 아닙니다. 다오콘 역할이 필요합니다.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle('다오랩 프렌즈 합류를 환영합니다');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('q1_realname')
        .setLabel('실명 이름을 말씀해 주세요.')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('q1_nickname')
        .setLabel('닉네임을 말씀해 주세요.')
        .setPlaceholder('서버에서 사용할 닉네임')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(32),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('q2_intro')
        .setLabel('자기 소개를 해 주세요. (최소 3-4줄)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(50)
        .setMaxLength(1000),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('q3_experience')
        .setLabel('커뮤니티나 DAO, 조직 운영 경험에 대해 얘기해 주세요.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('q4_expectation')
        .setLabel('다오랩에서 기대하는 바를 알려주세요.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000),
    ),
  );

  log.info('BUTTON', `modal shown | user=${tag}`);
  return interaction.showModal(modal);
}

async function handleModalSubmit(interaction) {
  const tag = interaction.user.tag;
  const uid = interaction.user.id;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  log.info('MODAL', `submit received | user=${tag} uid=${uid}`);

  const fields = {
    realname: interaction.fields.getTextInputValue('q1_realname'),
    nickname: interaction.fields.getTextInputValue('q1_nickname'),
    intro: interaction.fields.getTextInputValue('q2_intro'),
    experience: interaction.fields.getTextInputValue('q3_experience'),
    expectation: interaction.fields.getTextInputValue('q4_expectation'),
  };

  try {
    await archiveIntroduction(interaction, fields);
    log.info('MODAL', `archived | user=${tag} nickname=${fields.nickname}`);

    await completeOnboarding(interaction.member, fields.nickname);
    log.info('MODAL', `onboarding complete | user=${tag} nickname=${fields.nickname}`);

    await interaction.editReply('✅ 온보딩이 완료되었습니다! 다오랩-프렌즈 역할이 부여되었습니다.');
  } catch (error) {
    log.error('MODAL', `onboarding failed | user=${tag}`, error);
    await interaction.editReply('온보딩 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.');
  }
}

async function archiveIntroduction(interaction, fields) {
  const channel = await interaction.guild.channels.fetch(ARCHIVE_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${fields.nickname}님의 자기소개`)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: '실명', value: fields.realname },
      { name: '닉네임', value: fields.nickname },
      { name: '자기소개', value: fields.intro },
      { name: '커뮤니티/DAO/조직 운영 경험', value: fields.experience },
      { name: '다오랩에서 기대하는 바', value: fields.expectation },
    )
    .setFooter({ text: `ID: ${interaction.user.id}` })
    .setTimestamp();

  await channel.send({ content: `${interaction.user}`, embeds: [embed] });
}

async function completeOnboarding(member, nickname) {
  const tag = member.user.tag;

  await member.setNickname(nickname).catch((err) => {
    log.warn('ROLE', `nickname set failed — continue | user=${tag}`, err);
  });
  await member.roles.remove(DAOCON_ROLE_ID);
  log.info('ROLE', `다오콘 removed | user=${tag}`);
  await member.roles.add(DAOFRIENDS_ROLE_ID);
  log.info('ROLE', `다오랩-프렌즈 added | user=${tag}`);
}

client.login(DISCORD_TOKEN);

module.exports = {
  detectUsedInvite,
  completeOnboarding,
  inviteCache,
  BUTTON_ID,
  MODAL_ID,
};
