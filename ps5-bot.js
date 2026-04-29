/**
 * PS5 Availability Bot
 * ─────────────────────────────────────────────
 * Platforms: Amazon, Flipkart, BigBasket, Blinkit
 *
 * FIRST TIME SETUP:
 *   node login-helper.js        ← log in to all accounts once
 *
 * THEN RUN BOT:
 *   node ps5-bot.js             ← one-time check
 *   node ps5-bot.js --watch     ← auto-check every 5 minutes
 */

const puppeteer  = require("puppeteer-core");
const notifier   = require("node-notifier");
const { sessionExists, loadSession, injectLocalStorage } = require("./session-loader");

// Inline ANSI colors
const chalk = {
  cyan:        (s) => `\x1b[36m${s}\x1b[0m`,
  white:       (s) => `\x1b[37m${s}\x1b[0m`,
  green:       (s) => `\x1b[32m${s}\x1b[0m`,
  greenBright: (s) => `\x1b[92m${s}\x1b[0m`,
  yellow:      (s) => `\x1b[33m${s}\x1b[0m`,
  red:         (s) => `\x1b[31m${s}\x1b[0m`,
  gray:        (s) => `\x1b[90m${s}\x1b[0m`,
  bold:        (s) => `\x1b[1m${s}\x1b[0m`,
  bgBlue:      { white: { bold: (s) => `\x1b[44m\x1b[37m\x1b[1m${s}\x1b[0m` } },
  bgGreen:     { black: { bold: (s) => `\x1b[42m\x1b[30m\x1b[1m${s}\x1b[0m` } },
};

// ─────────────────────────────────────────────
//  CONFIGURE THESE SETTINGS
// ─────────────────────────────────────────────
const CONFIG = {
  PINCODE: "560070",
  CHECK_INTERVAL_MINS: 5,
  NOTIFY_ON_AVAILABLE: true,
  HEADLESS: true,

  CHROME_PATH:
    process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome",

  PRODUCTS: [
    {
      name:      "PS5 Disc Edition",
      amazon:    "https://www.amazon.in/dp/B0CY5HVDS2",
      flipkart:  "https://www.flipkart.com/sony-playstation5-console-slim-cfi-2008a01x-1024-gb/p/itm89489e2adcd2c",
      blinkit:   "https://blinkit.com/prn/playstation-ps5-disc-slim-gaming-console-with-ds-controllers-(white)/prid/611449",
    },
    {
      name:       "PS5 Digital Edition",
      amazon:     "https://www.amazon.in/dp/B0CY5QW186",
      flipkart:   "https://www.flipkart.com/sony-playstation5-digital-edition-slim-cfi-2008b01x-1-tb/p/itm801c70f02f720",
      bigbasket:  "https://www.bigbasket.com/pd/40329964/sony-ps5-slim-digital-edition-console-1-n/",
      blinkit:    "https://blinkit.com/prn/sony-ps5-console-slim/prid/547392",
    },
  ],
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
const log = {
  info:    (msg) => console.log(chalk.cyan("ℹ"), chalk.white(msg)),
  success: (msg) => console.log(chalk.green("✔"), chalk.greenBright(msg)),
  warn:    (msg) => console.log(chalk.yellow("⚠"), chalk.yellow(msg)),
  error:   (msg) => console.log(chalk.red("✖"), chalk.red(msg)),
  section: (msg) => console.log("\n" + chalk.bgBlue.white.bold(` ${msg} `) + "\n"),
};

function timestamp() {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: CONFIG.CHROME_PATH,
    headless: CONFIG.HEADLESS,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1280,800",
    ],
    defaultViewport: { width: 1280, height: 800 },
  });
}

async function humanDelay(min = 1500, max = 4000) {
  const ms = Math.floor(Math.random() * (max - min)) + min;
  return new Promise((r) => setTimeout(r, ms));
}

function notify(title, message) {
  if (!CONFIG.NOTIFY_ON_AVAILABLE) return;
  notifier.notify({ title, message, sound: true, wait: false });
}

// ─────────────────────────────────────────────
//  SESSION SETUP HELPER
//  Call at the start of each checker to inject
//  saved cookies/localStorage for that site.
// ─────────────────────────────────────────────
async function setupSession(page, siteKey, landingUrl) {
  const hasSession = sessionExists(siteKey);
  if (hasSession) {
    await loadSession(page, siteKey);
    log.info(`${siteKey}: Loaded saved session`);
  } else {
    log.warn(`${siteKey}: No saved session — run "node login-helper.js" for better results`);
  }

  await page.goto(landingUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await humanDelay(2000, 3500);

  // Inject localStorage after navigation (required for SPAs)
  await injectLocalStorage(page);

  return hasSession;
}

// ─────────────────────────────────────────────
//  AMAZON CHECKER
// ─────────────────────────────────────────────
async function checkAmazon(page, product) {
  if (!product.amazon) return [];
  const results = [];
  try {
    log.info(`Amazon: Checking "${product.name}"...`);

    // Load session then go directly to product page
    await loadSession(page, "amazon");
    await page.goto(product.amazon, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay(2500, 4500);
    await injectLocalStorage(page);
    await page.waitForSelector("#productTitle, #title", { timeout: 20000 });

    // Set pincode if needed
    try {
      const locationBtn = await page.$("#nav-global-location-popover-link, #glow-ingress-block");
      if (locationBtn) {
        await locationBtn.click();
        await humanDelay(1200, 2000);
        const pin = await page.waitForSelector("#GLUXZipUpdateInput", { timeout: 7000 });
        if (pin) {
          await pin.click({ clickCount: 3 });
          await pin.type(CONFIG.PINCODE, { delay: 100 });
          await humanDelay(600, 1000);
          try { await page.click("input.a-button-input[aria-labelledby='GLUXZipUpdate-announce']"); }
          catch (_) { await page.keyboard.press("Enter"); }
          await humanDelay(2500, 3500);
          log.info(`Amazon: Pincode set to ${CONFIG.PINCODE}`);
          await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
          await humanDelay(2500, 4000);
        }
      }
    } catch (_) { log.warn("Amazon: Could not set pincode"); }

    const title = await page.$eval("#productTitle, #title span", (el) => el.textContent.trim()).catch(() => product.name);
    const price = await page.evaluate(() => {
      for (const sel of [".priceToPay .a-offscreen",".apexPriceToPay .a-offscreen","#priceblock_ourprice",".a-price .a-offscreen"]) {
        const el = document.querySelector(sel);
        if (el?.textContent.trim()) return el.textContent.trim();
      }
      return "Price not listed";
    });

    const pageText = await page.$eval("body", (el) => el.innerText.toLowerCase()).catch(() => "");
    const isOutOfStock = ["currently unavailable","out of stock","item is unavailable"].some((s) => pageText.includes(s));
    const addToCartBtn = await page.$("#add-to-cart-button, #buy-now-button");
    const available = !!addToCartBtn && !isOutOfStock;

    let deliverable = null;
    try {
      const db = await page.$("#deliveryBlockMessage, #mir-layout-DELIVERY_BLOCK, #ddmDeliveryMessage");
      if (db) {
        const dt = await page.evaluate((el) => el.innerText.toLowerCase(), db);
        deliverable = !dt.includes("not available") && !dt.includes("cannot deliver") && !dt.includes("not serviceable");
        log.info(`Amazon: Delivery — "${dt.slice(0, 80).trim()}"`);
      }
    } catch (_) {}

    results.push({ platform: "Amazon", name: title.substring(0, 70), price, available, deliverable, url: product.amazon });
    log.info(`Amazon: ${available ? "IN STOCK" : "Out of stock"} | ${price}`);
  } catch (err) { log.error(`Amazon failed: ${err.message}`); }
  return results;
}

// ─────────────────────────────────────────────
//  FLIPKART CHECKER
// ─────────────────────────────────────────────
async function checkFlipkart(page, product) {
  if (!product.flipkart) return [];
  const results = [];
  try {
    log.info(`Flipkart: Checking "${product.name}"...`);
    await loadSession(page, "flipkart");
    await page.goto(product.flipkart, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay(2500, 4500);
    await injectLocalStorage(page);

    // Dismiss popup
    try {
      const btns = await page.$$("button._2KpZ6l._2doB4z, button[class*='close'], ._2AkmmA button");
      for (const btn of btns) {
        const t = await page.evaluate((el) => el.textContent, btn);
        if (["✕","×"].includes(t.trim()) || t.includes("later")) { await btn.click(); break; }
      }
    } catch (_) {}

    await humanDelay(1000, 2000);

    const title = await page.evaluate(() => {
      for (const sel of [".B_NuCI","h1.yhB1nd","h1[class*='yhB']","h1.VU-ZEz","h1"]) {
        const el = document.querySelector(sel);
        if (el?.textContent.trim().length > 5) return el.textContent.trim();
      }
      return "";
    }).catch(() => product.name) || product.name;

    const price = await page.evaluate(() => {
      for (const sel of ["._30jeq3._16Jk6d","div.Nx9bqj.CxhGGd","div[class*='Nx9bqj']","._30jeq3"]) {
        const el = document.querySelector(sel);
        if (el?.textContent.trim()) return el.textContent.trim();
      }
      return "N/A";
    }).catch(() => "N/A");

    const pageText = await page.$eval("body", (el) => el.innerText.toLowerCase()).catch(() => "");
    const isOutOfStock = ["out of stock","sold out","currently out of stock"].some((s) => pageText.includes(s));
    const buyBtn = await page.evaluate(() => {
      for (const sel of ["button._2KpZ6l._2doB4z","button.CFgCMz","button[class*='_2KpZ6l']","button.QqFHMw"]) {
        for (const el of document.querySelectorAll(sel)) {
          const t = el.textContent.trim().toLowerCase();
          if (t.includes("add to cart") || t.includes("buy now")) return t;
        }
      }
      return null;
    }).catch(() => null);

    const available = !!buyBtn && !isOutOfStock;

    // Delivery check using saved address
    let deliverable = null;
    try {
      const pinInput = await page.$("input[placeholder*='incode'], input[placeholder*='PIN'], input[placeholder*='Delivery']");
      if (pinInput) {
        await pinInput.click({ clickCount: 3 });
        await pinInput.type(CONFIG.PINCODE, { delay: 100 });
        await humanDelay(400, 800);
        await page.keyboard.press("Enter");
        await humanDelay(2000, 3000);
        const delivEl = await page.$("._3XINqE, .rl32mD, div[class*='delivery'], .vFw0gD");
        if (delivEl) {
          const dt = await page.evaluate((el) => el.innerText.toLowerCase(), delivEl);
          deliverable = !dt.includes("not") && !dt.includes("unavailable") && !dt.includes("invalid");
          log.info(`Flipkart: Delivery — "${dt.slice(0, 80).trim()}"`);
        }
      }
    } catch (_) {}

    results.push({ platform: "Flipkart", name: title.substring(0, 70), price, available, deliverable, url: product.flipkart });
    log.info(`Flipkart: ${available ? "IN STOCK" : "Out of stock"} | ${price}`);
  } catch (err) { log.error(`Flipkart failed: ${err.message}`); }
  return results;
}

// ─────────────────────────────────────────────
//  BIGBASKET CHECKER
// ─────────────────────────────────────────────
async function checkBigBasket(page, product) {
  if (!product.bigbasket) return [];
  const results = [];
  try {
    log.info(`BigBasket: Checking "${product.name}"...`);

    // Load session + navigate to homepage first (so area/location loads)
    await loadSession(page, "bigbasket");
    await page.goto("https://www.bigbasket.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay(2000, 3500);
    await injectLocalStorage(page);

    // Now go to product page
    await page.goto(product.bigbasket, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay(3000, 5000);

    // Dismiss popups
    try {
      const btns = await page.$$("button, a");
      for (const btn of btns) {
        const t = await page.evaluate((el) => el.textContent.trim().toLowerCase(), btn);
        if (["later","skip","no thanks","close","×","✕"].includes(t)) {
          await btn.click(); await humanDelay(500, 1000); break;
        }
      }
    } catch (_) {}

    await page.waitForSelector("h1, .prod-name, [class*='product']", { timeout: 15000 }).catch(() => {});

    const title = await page.evaluate(() => {
      for (const sel of ["h1.block","h1",".prod-name","[class*='product-name']","[class*='prod-name']"]) {
        const el = document.querySelector(sel);
        if (el?.textContent.trim().length > 5) return el.textContent.trim();
      }
      return "";
    }).catch(() => product.name) || product.name;

    const price = await page.evaluate(() => {
      for (const sel of [".discnt-price",".selling-price","[class*='discnt']","[class*='selling']","[class*='price']"]) {
        const el = document.querySelector(sel);
        const t = el?.textContent.trim();
        if (t && /[\d₹]/.test(t)) return t;
      }
      return "N/A";
    }).catch(() => "N/A");

    const pageText = await page.$eval("body", (el) => el.innerText.toLowerCase()).catch(() => "");
    const isOutOfStock = ["out of stock","sold out","not available","notify me"].some((s) => pageText.includes(s));
    const buyBtn = await page.evaluate(() => {
      for (const b of document.querySelectorAll("button, [class*='add-to-cart']")) {
        const t = b.textContent.trim().toLowerCase();
        if (t.includes("add") || t.includes("buy")) return t;
      }
      return null;
    }).catch(() => null);

    const available = !!buyBtn && !isOutOfStock;

    // BigBasket shows area in header — check if logged-in area matches
    const areaText = await page.evaluate(() => {
      const el = document.querySelector("[class*='location'], [class*='area'], [class*='locality'], [id*='area']");
      return el?.textContent.trim() || null;
    }).catch(() => null);

    const deliveryNote = areaText
      ? `Delivery area: ${areaText} (from your saved account)`
      : "Delivery based on your BigBasket saved area";

    results.push({ platform: "BigBasket", name: title.substring(0, 70), price, available, deliverable: null, deliveryNote, url: product.bigbasket });
    log.info(`BigBasket: ${available ? "IN STOCK" : "Out of stock"} | ${price}`);
  } catch (err) { log.error(`BigBasket failed: ${err.message}`); }
  return results;
}

// ─────────────────────────────────────────────
//  BLINKIT CHECKER
// ─────────────────────────────────────────────
async function checkBlinkit(page, product) {
  if (!product.blinkit) return [];
  const results = [];
  try {
    log.info(`Blinkit: Checking "${product.name}"...`);

    // Load session + hit homepage first so location context loads
    await loadSession(page, "blinkit");
    await page.goto("https://blinkit.com/", { waitUntil: "networkidle2", timeout: 60000 });
    await humanDelay(2500, 4000);
    await injectLocalStorage(page);

    // Now product page
    await page.goto(product.blinkit, { waitUntil: "networkidle2", timeout: 60000 });
    await humanDelay(3000, 5000);

    // Dismiss overlays
    try {
      const overlays = await page.$$("button[class*='close'], [aria-label='Close'], button[class*='dismiss']");
      for (const o of overlays) { await o.click().catch(() => {}); }
    } catch (_) {}

    await page.waitForSelector("h1, [class*='product'], [class*='item-name']", { timeout: 15000 }).catch(() => {});
    await humanDelay(1500, 3000);

    const title = await page.evaluate(() => {
      for (const sel of ["h1","[class*='product-name']","[class*='item-name']","[class*='ProductName']","[class*='title']"]) {
        const el = document.querySelector(sel);
        if (el?.textContent.trim().length > 5) return el.textContent.trim();
      }
      return "";
    }).catch(() => product.name) || product.name;

    const price = await page.evaluate(() => {
      for (const sel of ["[class*='product-price']","[class*='Price']","[class*='price']","[class*='amount']"]) {
        const el = document.querySelector(sel);
        const t = el?.textContent.trim();
        if (t && /[\d₹]/.test(t)) return t;
      }
      return "N/A";
    }).catch(() => "N/A");

    const pageText = await page.$eval("body", (el) => el.innerText.toLowerCase()).catch(() => "");
    const isOutOfStock = ["out of stock","sold out","not available","notify me","currently unavailable"].some((s) => pageText.includes(s));
    const buyBtn = await page.evaluate(() => {
      for (const b of document.querySelectorAll("button, [class*='add-to-cart'], [class*='AddToCart']")) {
        const t = b.textContent.trim().toLowerCase();
        if (t.includes("add") || t === "+") return t;
      }
      return null;
    }).catch(() => null);

    const available = !!buyBtn && !isOutOfStock;

    // Read saved address from Blinkit header
    const addressText = await page.evaluate(() => {
      const el = document.querySelector("[class*='address'], [class*='location'], [class*='deliver-to'], [class*='DeliverTo']");
      return el?.textContent.trim() || null;
    }).catch(() => null);

    const deliveryNote = addressText
      ? `Delivering to: ${addressText.slice(0, 60)} (from your account)`
      : "Delivery based on your Blinkit saved address";

    results.push({ platform: "Blinkit", name: title.substring(0, 70), price, available, deliverable: null, deliveryNote, url: product.blinkit });
    log.info(`Blinkit: ${available ? "IN STOCK" : "Out of stock"} | ${price}`);
  } catch (err) { log.error(`Blinkit failed: ${err.message}`); }
  return results;
}

// ─────────────────────────────────────────────
//  DISPLAY RESULTS
// ─────────────────────────────────────────────
function displayResults(allResults) {
  log.section(`PS5 Availability Report — ${timestamp()}`);
  console.log(chalk.gray(`Pincode: ${CONFIG.PINCODE}\n`));

  let anyAvailable = false;

  for (const r of allResults) {
    const statusIcon = r.available ? "🟢" : "🔴";
    const statusText = r.available ? chalk.greenBright("IN STOCK") : chalk.red("Out of Stock");
    let deliveryLine = "";
    if (r.deliverable === true)
      deliveryLine = chalk.green(` | Deliverable to ${CONFIG.PINCODE} ✔`);
    else if (r.deliverable === false)
      deliveryLine = chalk.red(` | NOT deliverable to ${CONFIG.PINCODE} ✖`);
    else if (r.deliveryNote)
      deliveryLine = chalk.gray(` | ${r.deliveryNote}`);

    console.log(`${statusIcon} ${chalk.bold(r.platform)} — ${statusText}${deliveryLine}`);
    console.log(`   ${chalk.white(r.name)}`);
    console.log(`   Price: ${chalk.yellow(r.price)}`);
    console.log(`   URL: ${chalk.gray(r.url)}\n`);

    if (r.available) anyAvailable = true;
  }

  if (anyAvailable) {
    const platforms = allResults.filter((r) => r.available).map((r) => r.platform).join(", ");
    notify("🎮 PS5 IN STOCK!", `Available on: ${platforms} — BUY NOW!`);
    console.log(chalk.bgGreen.black.bold(` 🚨 PS5 IN STOCK ON: ${platforms.toUpperCase()} — BUY NOW! `));
  } else {
    console.log(chalk.gray(`No stock found. Watching every ${CONFIG.CHECK_INTERVAL_MINS} min...`));
  }
}

// ─────────────────────────────────────────────
//  MAIN RUN
// ─────────────────────────────────────────────
async function run() {
  log.section("PS5 Availability Bot Starting");
  log.info(`Pincode: ${CONFIG.PINCODE} | Checking 4 platforms`);

  // Warn if no sessions saved
  const sites = ["amazon","flipkart","bigbasket","blinkit"];
  const missing = sites.filter((s) => !sessionExists(s));
  if (missing.length > 0) {
    log.warn(`No saved sessions for: ${missing.join(", ")}`);
    log.warn(`Run "node login-helper.js" to log in and save sessions for better accuracy.`);
  }

  let browser;
  const allResults = [];

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Stealth
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      window.navigator.chrome = { runtime: {} };
    });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-IN,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    });

    for (const product of CONFIG.PRODUCTS) {
      log.section(`Checking: ${product.name}`);

      if (product.amazon)    { allResults.push(...await checkAmazon(page, product));    await humanDelay(4000, 7000); }
      if (product.flipkart)  { allResults.push(...await checkFlipkart(page, product));  await humanDelay(4000, 7000); }
      if (product.bigbasket) { allResults.push(...await checkBigBasket(page, product)); await humanDelay(3000, 6000); }
      if (product.blinkit)   { allResults.push(...await checkBlinkit(page, product));   await humanDelay(3000, 6000); }
    }
  } catch (err) {
    log.error(`Bot error: ${err.message}`);
    if (err.message.includes("executablePath"))
      log.warn("Chrome not found! Update CHROME_PATH in CONFIG.");
  } finally {
    if (browser) await browser.close();
  }

  displayResults(allResults);
  return allResults;
}

// ─────────────────────────────────────────────
//  ENTRY POINT
// ─────────────────────────────────────────────
const isWatchMode = process.argv.includes("--watch");

if (isWatchMode) {
  log.info(`Watch mode ON — checking every ${CONFIG.CHECK_INTERVAL_MINS} minutes.`);
  log.info("Press Ctrl+C to stop.\n");
  run();
  setInterval(run, CONFIG.CHECK_INTERVAL_MINS * 60 * 1000);
} else {
  run().then(() => {
    log.info("Done! Run with --watch to keep checking automatically.");
    log.info("Example: node ps5-bot.js --watch");
  });
}
