# 🎮 PS5 Availability Bot

Automatically checks PS5 stock across **Amazon.in, Flipkart, BigBasket, and Blinkit** — with pincode/address-based delivery checking — and sends a desktop notification the moment stock is found.

---

## 📁 Files in This Folder

| File | Purpose |
|------|---------|
| `ps5-bot.js` | Main bot — checks all platforms for PS5 stock |
| `login-helper.js` | One-time login tool — opens browser for you to log in |
| `session-loader.js` | Internal utility used by the bot (don't edit) |
| `package.json` | Dependency list |
| `sessions/` | Auto-created folder where your login sessions are saved |

---

## ✅ Requirements

- **Node.js** v16 or higher — [Download here](https://nodejs.org/)
- **Google Chrome** installed on your computer

---

## 🚀 First-Time Setup

### Step 1 — Install dependencies

Open a terminal in the `PS5` folder and run:

```bash
npm install
```

### Step 2 — Configure your pincode

Open `ps5-bot.js` in any text editor and update the `CONFIG` section at the top:

```js
const CONFIG = {
  PINCODE: "560068",          // ← Your delivery pincode
  CHECK_INTERVAL_MINS: 5,     // ← How often to check (in watch mode)
  NOTIFY_ON_AVAILABLE: true,  // ← Desktop notification when in stock
  HEADLESS: true,             // ← Set false to see the browser window
  ...
}
```

### Step 3 — Log in to your accounts (recommended)

Run the login helper to save your sessions:

```bash
node login-helper.js
```

This opens an interactive menu:

```
1. Amazon.in
2. Flipkart
3. BigBasket
4. Blinkit
5. All sites (one by one)
```

Pick a number → a **visible Chrome window opens** → log in to your account and set your delivery address → come back to the terminal and **press Enter** → session saved.

To log in to all platforms at once:
```bash
node login-helper.js --all
```

To log in to a specific platform only:
```bash
node login-helper.js --site amazon
node login-helper.js --site flipkart
node login-helper.js --site bigbasket
node login-helper.js --site blinkit
```

To check which sessions are saved and how old they are:
```bash
node login-helper.js --status
```

> **Why log in?** Without a saved session, Blinkit and BigBasket may not show delivery availability for your area since they are location-based apps. Amazon and Flipkart work without login but logged-in sessions are more reliable.

---

## ▶️ Running the Bot

### One-time check:
```bash
node ps5-bot.js
```

### Auto-check every 5 minutes:
```bash
node ps5-bot.js --watch
```

Press `Ctrl+C` to stop watch mode.

---

## 🔍 What Gets Checked

| Platform | Stock Check | Delivery Check |
|----------|-------------|----------------|
| Amazon.in | ✅ | ✅ Pincode-based |
| Flipkart | ✅ | ✅ Pincode-based |
| BigBasket | ✅ | ✅ From saved account address |
| Blinkit | ✅ | ✅ From saved account address |

---

## 📊 Sample Output

```
🟢 Amazon — IN STOCK | Deliverable to 560068 ✔
   Sony PlayStation 5 Slim Console (Disc Edition)
   Price: ₹54,990
   URL: https://www.amazon.in/...

🔴 Flipkart — Out of Stock | Delivery status unknown
   Sony PS5 Slim Console CFI-2008A01X
   Price: ₹54,990
   URL: https://www.flipkart.com/...

🚨 PS5 IS IN STOCK ON: AMAZON — BUY NOW!
```

---

## 🔔 Notifications

When PS5 is found in stock you will receive:
- A **desktop notification** with sound naming which platform has stock
- A **green alert banner** in the terminal
- The **direct product URL** to go buy it immediately

---

## 🗂️ Chrome Path by OS

The script auto-detects Chrome for your OS. If it fails, update `CHROME_PATH` in `ps5-bot.js` manually:

| OS | Path |
|----|------|
| macOS | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| Windows | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Linux | `/usr/bin/google-chrome` |

---

## 🔄 Session Expiry

Sessions saved by the login helper last until the platform logs you out (typically 30–90 days). If the bot starts showing incorrect results or delivery info disappears, re-run:

```bash
node login-helper.js --site amazon    # re-login just Amazon
node login-helper.js --all            # re-login everything
```

---

## ⚠️ Important Notes

1. **Bot detection** — Amazon and Flipkart use bot detection. The script uses human-like delays and browser stealth headers to reduce this. If you get blocked or see a CAPTCHA, set `HEADLESS: false` in the config to watch what the browser is doing, wait 10–15 minutes, and try again.

2. **Blinkit & BigBasket are location-first** — These apps detect your area from your saved account address, not a typed pincode. Logging in via the login helper is the only way to get accurate delivery status from them.

3. **Amazon address popup** — When setting your delivery address on Amazon, a popup window opens and closes automatically after selection. This is normal — the bot handles it correctly.

4. **Personal use only** — Excessive scraping may violate the Terms of Service of these platforms. Use responsibly with check intervals of 5 minutes or more.

5. **Prices and availability are real-time** — Results reflect what the site shows at the exact moment of each check.

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---------|-----|
| `Chrome not found` | Update `CHROME_PATH` in `ps5-bot.js` |
| `TargetCloseError` on Amazon login | Already fixed — ensure you have the latest `login-helper.js` |
| Bot gets blocked / CAPTCHA appears | Set `HEADLESS: false`, wait 15 mins, retry |
| Blinkit/BigBasket shows no delivery info | Run `node login-helper.js` and log in to those accounts |
| Sessions not working after a few weeks | Sessions expired — run `node login-helper.js --all` again |
| `chalk is not a function` error | Already fixed — ensure you have the latest `ps5-bot.js` |
| Node.js not installed | Download from https://nodejs.org and re-run `npm install` |

---

## 📦 Dependencies

- `puppeteer-core` — Controls Chrome headlessly
- `node-notifier` — Desktop notifications with sound

---

*Built for personal use. Not affiliated with Amazon, Flipkart, BigBasket, or Blinkit.*
