/**
 * PS5 Bot — Login Helper
 * ─────────────────────────────────────────────
 * Run this ONCE to log in to all platforms.
 * Your sessions are saved to ./sessions/
 * The main bot will load them automatically.
 *
 * Usage: node login-helper.js
 *
 * Options:
 *   node login-helper.js --site amazon
 *   node login-helper.js --site flipkart
 *   node login-helper.js --site bigbasket
 *   node login-helper.js --site blinkit
 *   node login-helper.js --all   (opens all one by one)
 */

const puppeteer = require("puppeteer-core");
const fs        = require("fs");
const path      = require("path");
const readline  = require("readline");

// ── Same Chrome path logic as main bot ──────
const CHROME_PATH =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "/usr/bin/google-chrome";

const SESSIONS_DIR = path.join(__dirname, "sessions");

// ── Sites config ────────────────────────────
const SITES = {
  amazon: {
    label:   "Amazon.in",
    url:     "https://www.amazon.in/ap/signin?openid.return_to=https%3A%2F%2Fwww.amazon.in%2F%3Fref_%3Dnav_signin&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=inflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0",
    checkFn: (cookies) => cookies.some((c) => c.name === "session-id" || c.name === "ubid-acbin"),
    hint:    "Sign in with your Amazon account. Also set your delivery address after logging in.",
  },
  flipkart: {
    label:   "Flipkart",
    url:     "https://www.flipkart.com/",
    checkFn: (cookies) => cookies.some((c) => c.name === "T" || c.name === "SN"),
    hint:    "Click Login at the top right. After logging in, ensure your saved address is set.",
  },
  bigbasket: {
    label:   "BigBasket",
    url:     "https://www.bigbasket.com/",
    checkFn: (cookies) => cookies.some((c) => c.name === "csrftoken" || c.name === "bb_user"),
    hint:    "Log in and make sure your delivery area/pincode is selected.",
  },
  blinkit: {
    label:   "Blinkit",
    url:     "https://blinkit.com/",
    checkFn: (cookies) => cookies.some((c) => c.name === "gr_1" || c.name === "_blinkit_session" || c.name === "token"),
    hint:    "Log in with your phone number. Allow location or set your address after login.",
  },
};

// ── Helpers ──────────────────────────────────
const ANSI = {
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
};

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(prompt, () => { rl.close(); resolve(); })
  );
}

function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function sessionFile(siteKey) {
  return path.join(SESSIONS_DIR, `${siteKey}.json`);
}

function saveSession(siteKey, cookies, localStorage) {
  ensureSessionsDir();
  fs.writeFileSync(
    sessionFile(siteKey),
    JSON.stringify({ cookies, localStorage, savedAt: new Date().toISOString() }, null, 2)
  );
}

function sessionExists(siteKey) {
  return fs.existsSync(sessionFile(siteKey));
}

function sessionAge(siteKey) {
  const f = sessionFile(siteKey);
  if (!fs.existsSync(f)) return null;
  const data = JSON.parse(fs.readFileSync(f, "utf8"));
  const saved = new Date(data.savedAt);
  const diffDays = Math.floor((Date.now() - saved.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays;
}

// ── Login flow for a single site ─────────────
async function loginSite(siteKey) {
  const site = SITES[siteKey];
  if (!site) {
    console.log(ANSI.red(`Unknown site: ${siteKey}. Choose from: ${Object.keys(SITES).join(", ")}`));
    return false;
  }

  const age = sessionAge(siteKey);
  if (age !== null) {
    console.log(
      ANSI.yellow(`⚠  Session for ${site.label} already exists (saved ${age} day(s) ago).`)
    );
    const ans = await waitForEnter(
      ANSI.yellow("   Press Enter to re-login and overwrite it, or Ctrl+C to skip: ")
    );
  }

  console.log(`\n${ANSI.bold(ANSI.cyan(`Opening ${site.label}...`))}`);
  console.log(ANSI.yellow(`   Hint: ${site.hint}`));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,          // ← VISIBLE browser so you can log in
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1280,800",
      "--disable-blink-features=AutomationControlled",
    ],
    defaultViewport: null,    // full window
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 60000 });

  console.log(ANSI.green("\n✔ Browser opened."));
  console.log(ANSI.bold("   → Log in to your account in the browser window."));
  console.log(ANSI.bold("   → Also set your delivery address / location if prompted."));
  console.log(ANSI.gray("   → Take your time — the script is waiting for you.\n"));

  await waitForEnter(ANSI.cyan("   Press Enter HERE (in terminal) once you are fully logged in and address is set: "));

  // ── Collect cookies from browser context (survives popup/tab changes) ──
  // Amazon opens a popup for address selection which closes the original page.
  // browser.defaultBrowserContext().cookies() grabs all cookies for the domain
  // regardless of which tab is currently open — safe even if page was closed.
  let cookies = [];
  let localStorageData = {};

  try {
    cookies = await browser.defaultBrowserContext().cookies();
  } catch (_) {
    // Fallback: find any still-open page
    try {
      const pages = await browser.pages();
      const alivePage = pages.find((p) => !p.isClosed()) || pages[0];
      if (alivePage) cookies = await alivePage.cookies();
    } catch (e) {
      console.log(ANSI.yellow("⚠  Could not read cookies — session may be incomplete."));
    }
  }

  // Grab localStorage from whichever page is still alive
  try {
    const pages = await browser.pages();
    const alivePage = pages.find((p) => !p.isClosed());
    if (alivePage) {
      localStorageData = await alivePage.evaluate(() => {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          data[key] = localStorage.getItem(key);
        }
        return data;
      }).catch(() => ({}));
    }
  } catch (_) {}

  saveSession(siteKey, cookies, localStorageData);

  const verified = site.checkFn(cookies);
  if (verified) {
    console.log(ANSI.green(`✔ Session saved successfully for ${site.label}!`));
  } else {
    console.log(ANSI.yellow(`⚠  Session saved, but login could not be fully verified for ${site.label}.`));
    console.log(ANSI.yellow("   It may still work — try running the main bot to check."));
  }

  await browser.close();
  return true;
}

// ── Status check ─────────────────────────────
function showStatus() {
  console.log(ANSI.bold("\n📋 Session Status:\n"));
  for (const [key, site] of Object.entries(SITES)) {
    const age = sessionAge(key);
    if (age === null) {
      console.log(`  ${ANSI.red("✖")} ${ANSI.bold(site.label.padEnd(18))} — No session saved`);
    } else {
      const freshness = age <= 7 ? ANSI.green(`${age}d old`) : ANSI.yellow(`${age}d old — consider re-logging in`);
      console.log(`  ${ANSI.green("✔")} ${ANSI.bold(site.label.padEnd(18))} — Session saved (${freshness})`);
    }
  }
  console.log();
}

// ── Main ─────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const siteArg = args.includes("--site") ? args[args.indexOf("--site") + 1] : null;
  const doAll   = args.includes("--all");
  const doStatus = args.includes("--status");

  console.log(ANSI.bold(ANSI.cyan("\n🎮 PS5 Bot — Login Helper\n")));
  showStatus();

  if (doStatus) return;

  if (doAll) {
    console.log(ANSI.bold("Opening all 5 platforms one by one. Complete each login, then press Enter to move to the next.\n"));
    for (const key of Object.keys(SITES)) {
      await loginSite(key);
      console.log(ANSI.gray("\n─────────────────────────────────────────\n"));
    }
    console.log(ANSI.green(ANSI.bold("✔ All sessions saved! You can now run the main bot.\n")));
    return;
  }

  if (siteArg) {
    await loginSite(siteArg);
    return;
  }

  // Interactive menu if no args
  console.log("Which site do you want to log in to?\n");
  const keys = Object.keys(SITES);
  keys.forEach((k, i) => console.log(`  ${i + 1}. ${SITES[k].label}`));
  console.log(`  ${keys.length + 1}. All sites (one by one)`);
  console.log(`  ${keys.length + 2}. Just show status and exit\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("Enter number: ", async (ans) => {
    rl.close();
    const n = parseInt(ans.trim());
    if (n >= 1 && n <= keys.length) {
      await loginSite(keys[n - 1]);
    } else if (n === keys.length + 1) {
      for (const key of keys) {
        await loginSite(key);
        console.log(ANSI.gray("\n─────────────────────────────────────────\n"));
      }
      console.log(ANSI.green(ANSI.bold("\n✔ All sessions saved! You can now run the main bot.\n")));
    } else {
      console.log("Exiting.");
    }
  });
}

main().catch(console.error);