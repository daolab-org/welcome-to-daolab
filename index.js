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
} = require('discord.js');

const GUILD_ID = process.env.GUILD_ID;
const TARGET_INVITE_CODE = process.env.TARGET_INVITE_CODE;
const DAOCON_ROLE_ID = process.env.DAOCON_ROLE_ID;
const DAOFRIENDS_ROLE_ID = process.env.DAOFRIENDS_ROLE_ID;
const ARCHIVE_CHANNEL_ID = process.env.ARCHIVE_CHANNEL_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
  ],
});

// T-01: invite cache for tracking which invite code was used
const inviteCache = new Map();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error(`Guild ${GUILD_ID} not found`);
    return;
  }

  // T-01: cache all invite uses on startup
  const invites = await guild.invites.fetch();
  invites.forEach((invite) => {
    inviteCache.set(invite.code, invite.uses);
  });
  console.log(`Cached ${inviteCache.size} invites`);

  // T-07 / I-03: ensure exactly one welcome button message exists
  const welcomeChannel = guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!welcomeChannel) {
    console.error(`Welcome channel ${WELCOME_CHANNEL_ID} not found`);
    return;
  }

  const messages = await welcomeChannel.messages.fetch({ limit: 50 });
  const existingButton = messages.find(
    (msg) => msg.author.id === client.user.id && msg.components.length > 0,
  );

  if (!existingButton) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_onboarding')
        .setLabel('🎉 온보딩 시작하기')
        .setStyle(ButtonStyle.Primary),
    );

    await welcomeChannel.send({
      content:
        '**다오랩 프렌즈에 오신 것을 환영합니다!**\n\n아래 버튼을 클릭하여 자기소개를 작성해주세요.',
      components: [row],
    });
    console.log('Welcome button message created');
  } else {
    console.log('Welcome button message already exists');
  }
});

// T-02, T-03: detect invite code and assign 다오콘 role
client.on('guildMemberAdd', async (member) => {
  if (member.guild.id !== GUILD_ID) return;

  try {
    const newInvites = await member.guild.invites.fetch();
    const usedInvite = newInvites.find(
      (invite) => (inviteCache.get(invite.code) ?? 0) < invite.uses,
    );

    // update cache
    newInvites.forEach((invite) => {
      inviteCache.set(invite.code, invite.uses);
    });

    if (usedInvite && usedInvite.code === TARGET_INVITE_CODE) {
      await member.roles.add(DAOCON_ROLE_ID);
      console.log(`Assigned 다오콘 role to ${member.user.tag} (invite: ${usedInvite.code})`);
    }
  } catch (error) {
    console.error(`Failed to process member join for ${member.user.tag}:`, error);
  }
});

client.on('interactionCreate', async (interaction) => {
  // T-04: button click → show modal (no defer, A-02)
  if (interaction.isButton() && interaction.customId === 'start_onboarding') {
    const member = interaction.member;
    if (!member.roles.cache.has(DAOCON_ROLE_ID)) {
      await interaction.reply({
        content: '온보딩 대상이 아닙니다. 다오콘 역할이 필요합니다.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = new ModalBuilder().setCustomId('onboarding_modal').setTitle('다오랩 프렌즈 소개');

    const q1 = new TextInputBuilder()
      .setCustomId('q1_name')
      .setLabel('이름 / 닉네임')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const q2 = new TextInputBuilder()
      .setCustomId('q2_intro')
      .setLabel('자기소개 (최소 50자)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(50)
      .setMaxLength(1000);

    const q3 = new TextInputBuilder()
      .setCustomId('q3_experience')
      .setLabel('관련 경험')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const q4 = new TextInputBuilder()
      .setCustomId('q4_expectation')
      .setLabel('기대사항')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(q1),
      new ActionRowBuilder().addComponents(q2),
      new ActionRowBuilder().addComponents(q3),
      new ActionRowBuilder().addComponents(q4),
    );

    await interaction.showModal(modal);
    return;
  }

  // T-05, T-06: modal submit → archive + role swap
  if (interaction.isModalSubmit() && interaction.customId === 'onboarding_modal') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.fields.getTextInputValue('q1_name');
    const intro = interaction.fields.getTextInputValue('q2_intro');
    const experience = interaction.fields.getTextInputValue('q3_experience');
    const expectation = interaction.fields.getTextInputValue('q4_expectation');

    try {
      // T-05: archive embed
      const archiveChannel = interaction.guild.channels.cache.get(ARCHIVE_CHANNEL_ID);
      if (!archiveChannel) {
        await interaction.editReply('아카이브 채널을 찾을 수 없습니다. 관리자에게 문의해주세요.');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${name}님의 자기소개`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '이름/닉네임', value: name },
          { name: '자기소개', value: intro },
          { name: '관련 경험', value: experience },
          { name: '기대사항', value: expectation },
        )
        .setFooter({ text: `ID: ${interaction.user.id}` })
        .setTimestamp();

      await archiveChannel.send({ embeds: [embed] });

      // T-06 / I-01: remove 다오콘, then add 다오랩-프렌즈
      const member = interaction.member;
      await member.roles.remove(DAOCON_ROLE_ID);
      await member.roles.add(DAOFRIENDS_ROLE_ID);

      await interaction.editReply(
        '✅ 온보딩이 완료되었습니다! 다오랩-프렌즈 역할이 부여되었습니다.',
      );
      console.log(`Onboarding completed for ${interaction.user.tag}`);
    } catch (error) {
      console.error(`Onboarding failed for ${interaction.user.tag}:`, error);
      await interaction.editReply('온보딩 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
