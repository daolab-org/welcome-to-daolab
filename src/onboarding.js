const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const log = require('./logger');
const {
  DAOCON_ROLE_ID,
  DAOFRIENDS_ROLE_ID,
  ARCHIVE_CHANNEL_ID,
  MODAL_ID,
  FIELD_IDS,
} = require('./config');

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
        .setCustomId(FIELD_IDS.REALNAME)
        .setLabel('실명 이름을 말씀해 주세요.')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(FIELD_IDS.NICKNAME)
        .setLabel('닉네임을 말씀해 주세요.')
        .setPlaceholder('서버에서 사용할 닉네임')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(32),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(FIELD_IDS.INTRO)
        .setLabel('자기 소개를 해 주세요. (최소 3-4줄)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(50)
        .setMaxLength(1000),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(FIELD_IDS.EXPERIENCE)
        .setLabel('커뮤니티나 DAO, 조직 운영 경험에 대해 얘기해 주세요.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(FIELD_IDS.EXPECTATION)
        .setLabel('다오랩에서 기대하는 바를 알려주세요.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000),
    ),
  );

  await interaction.showModal(modal);
  log.info('BUTTON', `modal shown | user=${tag}`);
}

async function handleModalSubmit(interaction) {
  const tag = interaction.user.tag;
  const uid = interaction.user.id;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  log.info('MODAL', `submit received | user=${tag} uid=${uid}`);

  const fields = {
    realname: interaction.fields.getTextInputValue(FIELD_IDS.REALNAME),
    nickname: interaction.fields.getTextInputValue(FIELD_IDS.NICKNAME),
    intro: interaction.fields.getTextInputValue(FIELD_IDS.INTRO),
    experience: interaction.fields.getTextInputValue(FIELD_IDS.EXPERIENCE),
    expectation: interaction.fields.getTextInputValue(FIELD_IDS.EXPECTATION),
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

module.exports = {
  handleButtonClick,
  handleModalSubmit,
  completeOnboarding,
};
