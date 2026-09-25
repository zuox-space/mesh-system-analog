// storage.js
export const DEFAULTS = {
  meshToken: null,
  meshTokenExpiresAt: null,
  meshTokenSource: null,
  user: null,
  teacherId: null,
  academicYear: null,
  period: null,
  schedule: [],
  homework: [],
  ktp: [],
  criteria: { token: { valid: false, minutesLeft: 0 } },
  settings: {
    autoLaunch: true,
    warnMinutes: 120,
    lateWindowMinutes: 60,
    catchUpMinutes: 60
  },
  lastCheck: null
};

export async function getState(keys = null) {
  const all = await chrome.storage.local.get(null);
  const merged = { ...DEFAULTS, ...all };
  if (!keys) return merged;
  const out = {};
  for (const k of keys) out[k] = merged[k];
  return out;
}

export async function setState(patch) {
  await chrome.storage.local.set(patch);
}

export async function updateCriteria(partial) {
  const { criteria } = await getState(["criteria"]);
  const base = criteria && typeof criteria === "object" ? criteria : {};
  await setState({ criteria: { ...base, ...partial } });
}

export async function clearAll() {
  await chrome.storage.local.clear();
  await chrome.storage.local.set(DEFAULTS);
}