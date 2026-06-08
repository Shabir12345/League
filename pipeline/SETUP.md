# Setting up the Riot data pipeline

This makes Clash HQ refresh everyone's stats automatically once a day. You do
this **once**. ~10 minutes.

## 1. Get a Riot API key
1. Go to https://developer.riotgames.com and sign in with your Riot account.
2. On the dashboard you'll see a **Development API Key** (starts with `RGAPI-`).
   - This one **expires every 24 hours** — fine for a first test.
3. For the daily automation to keep working, click **"Register Product" →
   "Personal API Key"**, fill in the short form (name it "Clash HQ", describe it
   as a private team stats tool, use the GitHub Pages URL). Approval is usually a
   few days. The Personal key does **not** expire daily.

## 2. Add the key to GitHub (so the robot can use it secretly)
1. Open the repo on GitHub → **Settings** (top tab).
2. Left sidebar: **Secrets and variables → Actions**.
3. Click **New repository secret**.
4. **Name:** `RIOT_API_KEY`  **Secret:** paste your `RGAPI-…` key. **Add secret**.
   - The key is encrypted. It is never shown in the website or the code.

## 3. Turn it on / test it
1. Repo → **Actions** tab → **Refresh player data** (left).
2. Click **Run workflow → Run workflow**.
3. Wait ~2–3 minutes. A green check means it worked and your stats were committed.
4. It now also runs by itself every day at 04:00 UTC.

## If something breaks
- **Run shows 401 / Unauthorized:** the key expired (dev key) or is wrong.
  Get a fresh key and update the `RIOT_API_KEY` secret (step 2). Switch to a
  Personal key to stop this happening daily.
- **One player shows ✗ 404:** their Riot ID changed — update it in
  `pipeline/config.js`.

## Running it on your own computer (optional)
Install Node 18+ then, in PowerShell, from the project folder:
```powershell
$env:RIOT_API_KEY="RGAPI-your-key-here"
node pipeline/run.js
```
