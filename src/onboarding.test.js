process.env.DISCORD_TOKEN = 'test-token';
process.env.GUILD_ID = 'guild-123';
process.env.TARGET_INVITE_CODE = 'target-code';
process.env.DAOCON_ROLE_ID = 'daocon-role';
process.env.DAOFRIENDS_ROLE_ID = 'friends-role';
process.env.ARCHIVE_CHANNEL_ID = 'archive-ch';
process.env.WELCOME_CHANNEL_ID = 'welcome-ch';
process.env.FRIENDS_ONBOARD_CHANNEL_ID = 'onboard-ch';

const { handleButtonClick, handleModalSubmit } = require('./onboarding');

function createInteraction({ memberHasDaocon = false, memberHasFriends = false } = {}) {
  return {
    user: { id: 'user-1', tag: 'user#0001' },
    member: {
      roles: {
        cache: {
          has: jest.fn((roleId) => {
            if (roleId === 'daocon-role') return memberHasDaocon;
            if (roleId === 'friends-role') return memberHasFriends;
            return false;
          }),
        },
      },
    },
    guild: {
      members: {
        fetch: jest.fn().mockResolvedValue({
          roles: {
            cache: {
              has: jest.fn(() => false),
            },
          },
        }),
      },
    },
    deferred: false,
    replied: false,
    showModal: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    fields: { getTextInputValue: jest.fn() },
  };
}

describe('handleButtonClick', () => {
  test('shows modal when member has 다오콘 role', async () => {
    const interaction = createInteraction({ memberHasDaocon: true });

    await handleButtonClick(interaction);

    expect(interaction.showModal).toHaveBeenCalledTimes(1);
  });

  test('rejects when member has no 다오콘 role', async () => {
    const interaction = createInteraction();

    await handleButtonClick(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('다오콘 역할이 필요합니다') }),
    );
    expect(interaction.showModal).not.toHaveBeenCalled();
  });

  test('does not throw when reply hits acknowledged interaction error', async () => {
    const interaction = createInteraction();
    interaction.reply.mockRejectedValue({
      code: 40060,
      message: 'Interaction has already been acknowledged.',
    });

    await expect(handleButtonClick(interaction)).resolves.toBeNull();
    expect(interaction.showModal).not.toHaveBeenCalled();
  });
});

describe('handleModalSubmit', () => {
  test('returns early when deferReply already acknowledged elsewhere', async () => {
    const interaction = createInteraction();
    interaction.deferReply.mockRejectedValue({
      code: 40060,
      message: 'Interaction has already been acknowledged.',
    });

    await expect(handleModalSubmit(interaction)).resolves.toBeUndefined();
    expect(interaction.guild.members.fetch).not.toHaveBeenCalled();
  });
});
