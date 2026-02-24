const log = require('./logger');

const inviteCache = new Map();

async function cacheInvites(guild) {
  const invites = await guild.invites.fetch();
  invites.forEach((invite) => inviteCache.set(invite.code, invite.uses));
  log.info('INIT', `invites cached | count=${inviteCache.size}`);
}

async function detectUsedInvite(guild) {
  const newInvites = await guild.invites.fetch();
  const used = newInvites.find((invite) => (inviteCache.get(invite.code) ?? 0) < invite.uses);

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

module.exports = { inviteCache, cacheInvites, detectUsedInvite };
