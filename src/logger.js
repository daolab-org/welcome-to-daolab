const log = {
  info: (phase, msg) => console.log(`[${phase}] ${msg}`),
  warn: (phase, msg) => console.warn(`[${phase}] WARN ${msg}`),
  error: (phase, msg, err) => console.error(`[${phase}] ERROR ${msg}`, err?.message ?? err ?? ''),
};

module.exports = log;
