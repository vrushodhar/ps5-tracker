/**
 * Session loader utility — used internally by ps5-bot.js
 * Loads cookies + localStorage saved by login-helper.js
 */

const fs   = require("fs");
const path = require("path");

const SESSIONS_DIR = path.join(__dirname, "sessions");

function sessionFile(siteKey) {
  return path.join(SESSIONS_DIR, `${siteKey}.json`);
}

function sessionExists(siteKey) {
  return fs.existsSync(sessionFile(siteKey));
}

async function loadSession(page, siteKey) {
  const file = sessionFile(siteKey);
  if (!fs.existsSync(file)) return false;

  try {
    const { cookies, localStorage: localStorageData } = JSON.parse(fs.readFileSync(file, "utf8"));

    // Set cookies
    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
    }

    // Inject localStorage after navigating to the domain
    // (must be done after goto — see usage in bot)
    page._pendingLocalStorage = localStorageData || {};

    return true;
  } catch (err) {
    console.error(`Session load error for ${siteKey}:`, err.message);
    return false;
  }
}

async function injectLocalStorage(page) {
  const data = page._pendingLocalStorage;
  if (!data || Object.keys(data).length === 0) return;
  await page.evaluate((d) => {
    for (const [k, v] of Object.entries(d)) {
      try { localStorage.setItem(k, v); } catch (_) {}
    }
  }, data).catch(() => {});
  delete page._pendingLocalStorage;
}

module.exports = { sessionExists, loadSession, injectLocalStorage };
