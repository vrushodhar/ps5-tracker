/**
 * PS5 Availability Bot (Discord-enabled version + test alert)
 */

const puppeteer = require("puppeteer-core");
const notifier = require("node-notifier");
const axios = require("axios");
const { sessionExists, loadSession, injectLocalStorage } = require("./session-loader");

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

// Send Discord alert
async function sendDiscordAlert(message) {
  if (!DISCORD_WEBHOOK) return;
  try {
    await axios.post(DISCORD_WEBHOOK, { content: message });
  } catch (err) {
    console.log("Discord alert failed:", err.message);
  }
}

// Inline ANSI colors
const chalk = {
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  white: (s) => `\x1b[37m${s}\x1b[0m`,
  greenBright: (s) => `\x1b[92m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// CONFIG
const CONFIG = {
  PINCODE: "560070",
  CHECK_INTERVAL_MINS: 5,
  NOTIFY_ON_AVAILABLE: true,
  HEADLESS: true,

  CHROME_PATH:
    process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "/usr/bin/google-chrome",

  PRODUCTS: [
    {
      name: "PS5 Disc Edition",
      amazon: "https://www.amazon.in/dp/B0CY5HVDS2",
      flipkart:
        "https://www.flipkart.com/sony-playstation5-console-slim-cfi-2008a01x-1024-gb/p/itm89489e2adcd2c",
    },
    {
      name: "PS5 Digital Edition",
      amazon: "https://www.amazon.in/dp/B0CY5QW186",
      flipkart:
        "https://www.flipkart.com/sony-playstation5-digital-edition-slim-cfi-2008b01x-1-tb/p/itm801c70f02f720",
    },
  ],
};

function notify(title, message) {
  if (!CONFIG.NOTIFY_ON_AVAILABLE) return;
  notifier.notify({ title, message });
}

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: CONFIG.CHROME_PATH,
    headless: CONFIG.HEADLESS,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

async function humanDelay(ms = 2500) {
  return new Promise((r) => setTimeout(r, ms));
}

// AMAZON CHECK
async function checkAmazon(page, product) {
  if (!product.amazon) return [];

  const results = [];

  try {
    console.log("Checking Amazon:", product.name);

    await page.goto(product.amazon, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await humanDelay();

    const price = await page.evaluate(() => {
      const el = document.querySelector(".a-price .a-offscreen");
      return el ? el.textContent.trim() : "N/A";
    });

    const addToCart = await page.$("#add-to-cart-button");

    const available = !!addToCart;

    // Ignore accessory misreads
    if (available && price.replace(/[^\d]/g, "") < 30000) {
      return [];
    }

    results.push({
      platform: "Amazon",
      name: product.name,
      price,
      available,
      url: product.amazon,
    });
  } catch (err) {
    console.log("Amazon error:", err.message);
  }

  return results;
}

// FLIPKART CHECK
async function checkFlipkart(page, product) {
  if (!product.flipkart) return [];

  const results = [];

  try {
    console.log("Checking Flipkart:", product.name);

    await page.goto(product.flipkart, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await humanDelay();

    const price = await page.evaluate(() => {
      const el = document.querySelector("._30jeq3");
      return el ? el.textContent.trim() : "N/A";
    });

    const available = await page.evaluate(() =>
      document.body.innerText.toLowerCase().includes("add to cart")
    );

    results.push({
      platform: "Flipkart",
      name: product.name,
      price,
      available,
      url: product.flipkart,
    });
  } catch (err) {
    console.log("Flipkart error:", err.message);
  }

  return results;
}

// RESULT DISPLAY + ALERT
async function displayResults(allResults) {
  let anyAvailable = false;

  for (const r of allResults) {
    console.log(`${r.platform}: ${r.available ? "IN STOCK" : "Out of stock"}`);

    if (r.available) {
      anyAvailable = true;
    }
  }

  if (anyAvailable) {
    const availableItems = allResults.filter((r) => r.available);

    notify("🎮 PS5 IN STOCK!", "Available now!");

    for (const item of availableItems) {
      await sendDiscordAlert(
        `🚨 **PS5 IN STOCK!**
Platform: ${item.platform}
Model: ${item.name}
Price: ${item.price}
${item.url}`
      );
    }
  }
}

// MAIN RUN
async function run() {
  console.log("PS5 Tracker Running...");

  // ✅ TEST MESSAGE (temporary — confirms Discord works)
  await sendDiscordAlert(
    "✅ PS5 tracker is running successfully on GitHub Actions."
  );

  const browser = await launchBrowser();
  const page = await browser.newPage();

  const allResults = [];

  for (const product of CONFIG.PRODUCTS) {
    allResults.push(...(await checkAmazon(page, product)));
    allResults.push(...(await checkFlipkart(page, product)));
  }

  await browser.close();

  await displayResults(allResults);
}

run();
