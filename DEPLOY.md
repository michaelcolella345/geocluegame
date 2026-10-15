# Putting GeoClue online

This guide takes you from the files on your computer to a live game at **https://geocluegame.com**, for free. You don't need to be a developer. Each step says exactly what to click.

You'll use three free accounts:

| Service | What it does | Cost |
|---|---|---|
| **GitHub** | Stores the game's files and their history | Free |
| **Cloudflare Pages** | Serves the website to players worldwide | Free |
| **Your domain registrar** (where you bought geocluegame.com) | Points the domain at Cloudflare | Whatever you already pay for the domain |

Set aside about 30–45 minutes. The domain step can take a few hours to take effect, but you don't have to wait around for it.

---

## Part 1: Put the files on GitHub

GitHub is where your project lives. Once Cloudflare is connected to it, **every change you save on GitHub goes live automatically within a minute or two**, including new puzzles.

### 1.1 Create a GitHub account (skip if you have one)

1. Go to <https://github.com/signup> and follow the steps.

### 1.2 Create an empty repository

A "repository" (or "repo") is just a project folder on GitHub.

1. Go to <https://github.com/new>.
2. **Repository name:** `geocluegame` (you've already created this one: <https://github.com/michaelcolella345/geocluegame>)
3. **Visibility:** choose **Public** or **Private**. Both work with Cloudflare's free plan. Private hides the files (including future answers) from casual browsing, but `puzzles.json` is still downloadable from the live site either way.
4. **Leave everything else unchecked.** Don't add a README, .gitignore or license, because the project already has them.
5. Click **Create repository**.

### 1.3 Get the files into it

Pick **one** of these two options.

**Option A: let Claude push it for you (recommended).** This keeps the full history of every stage.

1. Connect the new repo to this project ([Connect GitHub](https://claude.ai/connect-github), then add `geocluegame` in the project's settings (already done)).
2. Tell Claude "push it". Claude will push the code and confirm.

**Option B: upload it yourself in the browser.**

1. Download `geoclue-site.zip` (attached in the chat) and unzip it. You'll get a folder called `geoclue`.
2. On your new repo's page, click the **uploading an existing file** link.
3. Open the unzipped `geoclue` folder, select **everything inside it** (not the folder itself), and drag it onto the GitHub page.
   - On a Mac, press ⌘+Shift+. in Finder first so hidden files like `.gitignore` show up. It's fine if they don't upload, though.
4. Wait for every file to finish uploading. In the box at the bottom, type `First version of GeoClue` and click **Commit changes**.
5. Check that your repo's main page lists `index.html`, `data`, `js`, `css` and `assets` at the top level, not inside another `geoclue` folder.

---

## Part 2: Publish the site on Cloudflare Pages

### 2.1 Create a Cloudflare account

1. Go to <https://dash.cloudflare.com/sign-up> and sign up with your email.

### 2.2 Connect your GitHub repo

1. In the Cloudflare dashboard, open **Workers & Pages** in the left sidebar. It may be inside a **Compute** section.
2. Click **Create application**.
3. Choose the **Pages** tab, then **Connect to Git**.
   - If you only see Workers options, look for a link that says **"Looking to deploy Pages? Get started"**.
4. Click **Connect GitHub**. A GitHub window opens. Choose **Only select repositories**, pick `geocluegame`, and click **Install & Authorize**.
5. Back in Cloudflare, select the `geocluegame` repo and click **Begin setup**.

### 2.3 Build settings

GeoClue has no build step, so most of these fields stay empty.

| Field | What to enter |
|---|---|
| Project name | `geocluegame` (this gives you the free address `geocluegame.pages.dev`; if that name is taken, pick another) |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | *(leave empty)* |
| Build output directory | `/` (or leave empty if it allows that) |
| Root directory | *(leave as is)* |

Click **Save and Deploy**. After about a minute you'll see **Success** and a link like `https://geocluegame.pages.dev`. Open it. The game is live!

> GeoClue #1 is dated **2026-10-13**, so the site shows a playable puzzle from day one. The puzzles in `data/puzzles.json` run to **2026-12-11**. Add more before then, or players will see "Back tomorrow!".

### 2.4 Turn on Web Analytics (optional, free, no cookie banner needed)

1. In your Pages project, go to the **Metrics** tab.
2. Under **Web Analytics**, click **Enable**.
3. That's it. Cloudflare adds the tracking automatically on its next deploy, and you **don't** need to paste a token into `index.html`. The commented-out snippet there is only needed if you ever host somewhere else.

You'll see visitors, top countries and page loads under **Analytics & Logs > Web Analytics**.

### 2.5 Turn on gameplay stats (optional, free, no cookie banner needed)

Cloudflare counts visits but can't see how people play. GoatCounter can: for each puzzle it counts how many players **started**, **solved in 1, 2, 3, 4 or 5** guesses, or **lost**.

1. Go to <https://www.goatcounter.com/signup> and pick a code, for example `geoclue`. Your dashboard will be at `https://geoclue.goatcounter.com`.
2. Open `js/config.js` and put your code between the quotes: `GOATCOUNTER_CODE: "geoclue",`
3. Commit the change. Cloudflare redeploys on its own.

On the dashboard, gameplay rows look like `Puzzle 2: started`, `Puzzle 2: solved in 3` and `Puzzle 2: lost`. Type `Puzzle 2:` in the filter box to see just one day. A player who reloads or comes back later isn't counted twice. Players with ad blockers aren't counted, so treat the numbers as a good sample rather than an exact total.

---

## Part 3: Connect geocluegame.com

The domain was bought on Cloudflare, so its DNS is already managed there and there are no nameservers to change. (If you ever buy a domain somewhere else, first add it under **Add a domain** in Cloudflare and switch its nameservers at that registrar to the two Cloudflare shows you.)

The game runs as a **Worker** named `geocluegame` (the one with the `workers.dev` address). That's the one the domain must be attached to: the "How everyone did today" stats only work where the Worker runs.

### 3.1 Attach the domain to the Worker

1. In the Cloudflare dashboard, open **Workers & Pages** and tap **geocluegame**. If you see both a Worker and a Pages project with that name, pick the Worker.
2. Tap **Settings** → **Domains & Routes** → **+ Add** → **Custom domain**.
3. Enter `geocluegame.com` and tap **Add domain**.
4. (Optional) Repeat steps 2 and 3 for `www.geocluegame.com`. As of October 2026 this is skipped: Cloudflare wouldn't add it, and almost nobody types "www".

The domain shows **Active** after a few minutes, with the HTTPS padlock set up automatically. The game is then live at **https://geocluegame.com**. 🎉

**If it says the domain already has DNS records:** open `geocluegame.com` in the dashboard → **DNS** → **Records**, delete the **A**, **AAAA** or **CNAME** records for `geocluegame.com` and `www` (leave any **MX** email records alone), then try again.

### 3.2 (Optional) Send www to the bare domain

Both addresses already work. To make `www` *redirect* to the main address:

1. In Cloudflare, open `geocluegame.com` → **Rules** → **Redirect Rules** (or **Rules > Overview** → **Create rule** → **Redirect Rule**).
2. Use the **"Redirect from WWW to root"** template if offered, or set: *if Hostname equals `www.geocluegame.com`*, then a dynamic redirect to `concat("https://geocluegame.com", http.request.uri.path)`, status 301, preserving the query string.
3. Deploy.

---

## Part 4: Check that everything works

- [ ] `https://geocluegame.com` loads with a padlock icon.
- [ ] After finishing today's puzzle there, the "How everyone did" section appears once at least 5 people have played.
- [ ] On your phone, the "How to play" box shows on first visit.
- [ ] Share the link in a text message or on Slack and check that the GeoClue preview card appears. Previews can be cached; if an old one shows, paste the link into <https://www.opengraph.xyz> to refresh.
- [ ] Play today's game and tap **Share**.

---

## Everyday tasks

### Adding or fixing puzzles

1. On GitHub, open your repo → `data` → `puzzles.json`.
2. Click the ✏️ pencil icon (**Edit this file**).
3. Make your changes, following the format in the README. **Watch your commas:** every puzzle except the last needs a `,` after its closing `}`.
4. Click **Commit changes**.
5. Cloudflare redeploys automatically. Check the **Deployments** tab in your Pages project; it takes about a minute.

If you have Node.js on your computer, run `node tools/validate.js` before uploading to catch mistakes like a missing comma, a wrong country name, or a hard puzzle on a non-Friday. A typo in `puzzles.json` breaks the game for everyone until it's fixed, so it's worth the check.

### Testing a future puzzle

Run the game on your computer (see the README) and open `http://localhost:8000/?date=2026-11-20`. The `?date=` trick only works on your own computer, never on the live site.

### Rolling back a bad change

In Cloudflare → **Workers & Pages** → **geocluegame** → **Deployments**, find the last good deployment, open its **⋯** menu and choose **Rollback**. The site switches back within a minute. The next change merged on GitHub publishes again as normal.

### Going back to an earlier version

The game as it was on October 14, 2026, before the live map, is saved on GitHub as the branch **classic-2026-10-14**. Nothing ever changes it. From smallest step to biggest:

1. **Turn off just the live map.** On GitHub, open `js/config.js`, tap the pencil, change `LIVE_MAP: true` to `LIVE_MAP: false` and tap **Commit changes**. The site updates in a minute or two. Change it back to `true` to bring the map back.
   The same goes for **How everyone did today** on the results screen: change `EVERYONE_STATS: true` to `EVERYONE_STATS: false`.
2. **Undo one merged change.** Open that pull request on GitHub (for example "Add a live terrain map…") and tap **Revert**. GitHub makes a new pull request that undoes it. Merge that one.
3. **Go all the way back** to the saved version: use **Rolling back a bad change** above for an instant fix, then ask Claude to "put main back to classic-2026-10-14" so the code on GitHub matches.

### Changing the launch date or share address

Edit `js/config.js` on GitHub (`LAUNCH_DATE` or `SITE_URL`) and commit.
