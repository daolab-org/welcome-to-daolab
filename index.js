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

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
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
  const welcomeChannel = await guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
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

    const buttonMsg = await welcomeChannel.send({
      content:
        '**다오랩 프렌즈에 오신 것을 환영합니다!**\n\n아래 버튼을 클릭하여 자기소개를 작성해주세요.',
      components: [row],
    });
    await buttonMsg.pin().catch((err) => {
      console.error('Failed to pin welcome message:', err);
    });
    console.log('Welcome button message created and pinned');
  } else {
    // 기존 메시지가 핀되어 있지 않으면 핀
    if (!existingButton.pinned) {
      await existingButton.pin().catch((err) => {
        console.error('Failed to pin existing welcome message:', err);
      });
      console.log('Existing welcome button message pinned');
    } else {
      console.log('Welcome button message already exists and pinned');
    }
  }
});

// T-02, T-03: detect invite code and assign 다오콘 role
client.on(Events.GuildMemberAdd, async (member) => {
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

      // DM + 환영 채널 둘 다 온보딩 안내
      const onboardingMessage =
        `${member}님, **다오랩 프렌즈**에 오신 것을 환영합니다! 🎉\n\n` +
        `온보딩을 완료하려면 <#${WELCOME_CHANNEL_ID}> 채널에서 **온보딩 시작하기** 버튼을 클릭해주세요.`;

      await member.send(onboardingMessage).catch((err) => {
        console.error(`Failed to send DM to ${member.user.tag}:`, err);
      });

      const welcomeChannel = await member.guild.channels
        .fetch(WELCOME_CHANNEL_ID)
        .catch(() => null);
      if (welcomeChannel) {
        await welcomeChannel.send(onboardingMessage).catch((err) => {
          console.error(`Failed to send welcome message for ${member.user.tag}:`, err);
        });
      }
    }
  } catch (error) {
    console.error(`Failed to process member join for ${member.user.tag}:`, error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
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

    const modal = new ModalBuilder()
      .setCustomId('onboarding_modal')
      .setTitle('다오랩 프렌즈 합류를 환영합니다');

    const q1Name = new TextInputBuilder()
      .setCustomId('q1_realname')
      .setLabel('실명 이름을 말씀해 주세요.')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const q1Nickname = new TextInputBuilder()
      .setCustomId('q1_nickname')
      .setLabel('닉네임을 말씀해 주세요.')
      .setPlaceholder('서버에서 사용할 닉네임')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(32);

    const q2 = new TextInputBuilder()
      .setCustomId('q2_intro')
      .setLabel('자기 소개를 해 주세요. (최소 3-4줄)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(50)
      .setMaxLength(1000);

    const q3 = new TextInputBuilder()
      .setCustomId('q3_experience')
      .setLabel('커뮤니티나 DAO, 조직 운영 경험에 대해 얘기해 주세요.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const q4 = new TextInputBuilder()
      .setCustomId('q4_expectation')
      .setLabel('다오랩에서 기대하는 바를 알려주세요.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(q1Name),
      new ActionRowBuilder().addComponents(q1Nickname),
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

    const realname = interaction.fields.getTextInputValue('q1_realname');
    const nickname = interaction.fields.getTextInputValue('q1_nickname');
    const intro = interaction.fields.getTextInputValue('q2_intro');
    const experience = interaction.fields.getTextInputValue('q3_experience');
    const expectation = interaction.fields.getTextInputValue('q4_expectation');

    try {
      // T-05: archive embed
      const archiveChannel = await interaction.guild.channels
        .fetch(ARCHIVE_CHANNEL_ID)
        .catch(() => null);
      if (!archiveChannel) {
        await interaction.editReply('아카이브 채널을 찾을 수 없습니다. 관리자에게 문의해주세요.');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${nickname}님의 자기소개`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '실명', value: realname },
          { name: '닉네임', value: nickname },
          { name: '자기소개', value: intro },
          { name: '커뮤니티/DAO/조직 운영 경험', value: experience },
          { name: '다오랩에서 기대하는 바', value: expectation },
        )
        .setFooter({ text: `ID: ${interaction.user.id}` })
        .setTimestamp();

      await archiveChannel.send({ content: `${interaction.user}`, embeds: [embed] });

      // T-06 / I-01: remove 다오콘, then add 다오랩-프렌즈 + set nickname
      const member = interaction.member;
      await member.setNickname(nickname).catch((err) => {
        console.error(`Failed to set nickname for ${interaction.user.tag}:`, err);
      });
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
