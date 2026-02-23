/**
 * SPEC.md Verification Scenarios:
 * - 정상 온보딩: 초대코드 감지 → 역할 부여 → 아카이빙 → 역할 교체
 * - 비대상 초대코드: 다오콘 역할 부여되지 않음
 * - 역할 없이 버튼 클릭: ephemeral 거부 메시지
 * - I-01: 다오콘 제거 + 다오랩-프렌즈 부여 (동시 보유 불가)
 * - I-03: 환영 메시지 중복 생성 안 함
 */

// --- discord.js mock (must be before require) ---
const mockLogin = jest.fn().mockResolvedValue('token');
const mockGuildFetch = jest.fn();
const mockOn = jest.fn();
const mockOnce = jest.fn();

jest.mock('discord.js', () => {
  const actual = jest.requireActual('discord.js');
  return {
    ...actual,
    Client: jest.fn().mockImplementation(() => ({
      login: mockLogin,
      guilds: { cache: new Map(), fetch: mockGuildFetch },
      user: { id: 'bot-id', tag: 'TestBot#0000' },
      on: mockOn,
      once: mockOnce,
    })),
  };
});

// --- env setup (must be before require('./index')) ---
process.env.DISCORD_TOKEN = 'test-token';
process.env.GUILD_ID = 'guild-123';
process.env.TARGET_INVITE_CODE = 'target-code';
process.env.DAOCON_ROLE_ID = 'daocon-role';
process.env.DAOFRIENDS_ROLE_ID = 'friends-role';
process.env.ARCHIVE_CHANNEL_ID = 'archive-ch';
process.env.WELCOME_CHANNEL_ID = 'welcome-ch';

const {
  detectUsedInvite,
  completeOnboarding,
  inviteCache,
  BUTTON_ID,
  MODAL_ID,
} = require('./index');

// --- helpers ---

/** @param {Array<{code: string, uses: number}>} invites */
function mockGuild(invites) {
  const inviteCollection = new Map();
  invites.forEach((inv) => inviteCollection.set(inv.code, inv));

  return {
    invites: {
      fetch: jest.fn().mockResolvedValue({
        find: (fn) => [...inviteCollection.values()].find(fn),
        forEach: (fn) => inviteCollection.forEach(fn),
      }),
    },
  };
}

/** @param {{ tag: string }} user */
function mockMember(user) {
  const roles = new Set();
  return {
    user,
    roles: {
      add: jest.fn().mockImplementation((id) => {
        roles.add(id);
        return Promise.resolve();
      }),
      remove: jest.fn().mockImplementation((id) => {
        roles.delete(id);
        return Promise.resolve();
      }),
    },
    setNickname: jest.fn().mockResolvedValue(undefined),
    _roles: roles,
  };
}

// --- tests ---

beforeEach(() => {
  inviteCache.clear();
});

describe('detectUsedInvite', () => {
  test('identifies invite with increased uses', async () => {
    inviteCache.set('target-code', 5);
    inviteCache.set('other-code', 3);
    const guild = mockGuild([
      { code: 'target-code', uses: 6 },
      { code: 'other-code', uses: 3 },
    ]);

    const result = await detectUsedInvite(guild);

    expect(result.code).toBe('target-code');
  });

  test('returns undefined when no invite uses changed', async () => {
    inviteCache.set('target-code', 5);
    const guild = mockGuild([{ code: 'target-code', uses: 5 }]);

    const result = await detectUsedInvite(guild);

    expect(result).toBeUndefined();
  });

  test('updates cache after detection', async () => {
    inviteCache.set('target-code', 5);
    const guild = mockGuild([{ code: 'target-code', uses: 7 }]);

    await detectUsedInvite(guild);

    expect(inviteCache.get('target-code')).toBe(7);
  });

  test('handles new invite not in cache', async () => {
    const guild = mockGuild([{ code: 'new-code', uses: 1 }]);

    const result = await detectUsedInvite(guild);

    expect(result.code).toBe('new-code');
    expect(inviteCache.get('new-code')).toBe(1);
  });
});

describe('completeOnboarding (I-01: 다오콘/다오랩-프렌즈 동시 보유 불가)', () => {
  test('removes 다오콘 before adding 다오랩-프렌즈', async () => {
    const member = mockMember({ tag: 'user#1234' });
    const callOrder = [];
    member.roles.remove.mockImplementation((id) => {
      callOrder.push(`remove:${id}`);
      return Promise.resolve();
    });
    member.roles.add.mockImplementation((id) => {
      callOrder.push(`add:${id}`);
      return Promise.resolve();
    });

    await completeOnboarding(member, '테스트닉');

    expect(callOrder).toEqual(['remove:daocon-role', 'add:friends-role']);
  });

  test('sets nickname from submitted value', async () => {
    const member = mockMember({ tag: 'user#1234' });

    await completeOnboarding(member, '다오러버');

    expect(member.setNickname).toHaveBeenCalledWith('다오러버');
  });

  test('continues onboarding even if nickname change fails', async () => {
    const member = mockMember({ tag: 'user#1234' });
    member.setNickname.mockRejectedValue(new Error('Missing Permissions'));

    await completeOnboarding(member, '오너닉');

    expect(member.roles.remove).toHaveBeenCalledWith('daocon-role');
    expect(member.roles.add).toHaveBeenCalledWith('friends-role');
  });
});

describe('constants', () => {
  test('BUTTON_ID and MODAL_ID are defined', () => {
    expect(BUTTON_ID).toBe('start_onboarding');
    expect(MODAL_ID).toBe('onboarding_modal');
  });
});

describe('environment validation', () => {
  test('bot logs in with token', () => {
    expect(mockLogin).toHaveBeenCalledWith('test-token');
  });
});
