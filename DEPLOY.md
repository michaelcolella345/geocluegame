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
2. **Repository name:** `geoclue`
3. **Visibility:** choose **Public** or **Private**. Both work with Cloudflare's free plan. Private hides the files (including future answers) from casual browsing, but `puzzles.json` is still downloadable from the live site either way.
4. **Leave everything else unchecked.** Don't add a README, .gitignore or license, because the project already has them.
5. Click **Create repository**.

### 1.3 Get the files into it

Pick **one** of these two options.

**Option A: let Claude push it for you (recommended).** This keeps the full history of every stage.

1. Connect the new repo to this project ([Connect GitHub](https://claude.ai/connect-github), then add `geoclue` in the project's settings).
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
4. Click **Connect GitHub**. A GitHub window opens. Choose **Only select repositories**, pick `geoclue`, and click **Install & Authorize**.
5. Back in Cloudflare, select the `geoclue` repo and click **Begin setup**.

### 2.3 Build settings

GeoClue has no build step, so most of these fields stay empty.

| Field | What to enter |
|---|---|
| Project name | `geoclue` (this gives you the free address `geoclue.pages.dev`; if that name is taken, pick another) |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | *(leave empty)* |
| Build output directory | `/` (or leave empty if it allows that) |
| Root directory | *(leave as is)* |

Click **Save and Deploy**. After about a minute you'll see **Success** and a link like `https://geoclue.pages.dev`. Open it. The game is live!

> **Before Nov 1** the page will say "GeoClue starts soon". That's expected, because the first puzzle is dated 2026-11-01. To try a puzzle early, see "Testing a future puzzle" below.

### 2.4 Turn on Web Analytics (optional, free, no cookie banner needed)

1. In your Pages project, go to the **Metrics** tab.
2. Under **Web Analytics**, click **Enable**.
3. That's it. Cloudflare adds the tracking automatically on its next deploy, and you **don't** need to paste a token into `index.html`. The commented-out snippet there is only needed if you ever host somewhere else.

You'll see visitors, top countries and page loads under **Analytics & Logs > Web Analytics**.

---

## Part 3: Connect geocluegame.com

For a "bare" domain like `geocluegame.com` (no `www`), Cloudflare needs to manage the domain's DNS. That means switching the domain's **nameservers** to Cloudflare's. You keep the domain at your registrar and keep paying for it there. Only the "address book" moves.

> ⚠️ If you use this domain for **email** (for example `you@geocluegame.com`), check in step 3.1 that Cloudflare copied your **MX** records before you switch nameservers. If you don't use it for email, don't worry about this.

### 3.1 Add the domain to Cloudflare

1. In the Cloudflare dashboard, click **Add a domain** (on the home page, or **+ Add** at the top).
2. Enter `geocluegame.com` and continue.
3. Choose the **Free** plan.
4. Cloudflare scans your existing DNS records and shows them. Click **Continue**. Delete any records that pointed the domain at a "parked" or "coming soon" page from your registrar, but keep any MX (email) records.
5. Cloudflare shows you **two nameservers**, something like `ada.ns.cloudflare.com` and `bob.ns.cloudflare.com`. Keep this page open.

### 3.2 Change the nameservers at your registrar

Where you do this depends on where you bought the domain. Look for **Nameservers** or **DNS settings** on the domain's page:

- **GoDaddy:** My Products → your domain → **DNS** → **Nameservers** → **Change** → "I'll use my own nameservers"
- **Namecheap:** Domain List → **Manage** → **Nameservers** → **Custom DNS**
- **Squarespace / Google Domains:** Domains → your domain → **DNS** → **Domain nameservers** → **Use custom nameservers**
- **Porkbun:** Domain Management → **Details** → **Authoritative Nameservers** → **Edit**

Replace the existing nameservers with Cloudflare's two and save.

Back in Cloudflare, click **Continue** / **Check nameservers**. It usually finishes in under an hour but can take up to 24 hours. Cloudflare emails you when the domain is **Active**.

### 3.3 Attach the domain to your Pages project

You can do this right away. It finishes on its own once the domain is active.

1. Go to **Workers & Pages** → your `geoclue` project → **Custom domains**.
2. Click **Set up a custom domain**, enter `geocluegame.com`, and click **Continue** → **Activate domain**.
3. Repeat for `www.geocluegame.com`, so people who type "www" also land on the game.

When both show **Active**, with the HTTPS padlock set up automatically, the game is live at **https://geocluegame.com**. 🎉

### 3.4 (Optional) Send www to the bare domain

Both addresses already work. To make `www` *redirect* to the main address:

1. In Cloudflare, open `geocluegame.com` → **Rules** → **Redirect Rules** (or **Rules > Overview** → **Create rule** → **Redirect Rule**).
2. Use the **"Redirect from WWW to root"** template if offered, or set: *if Hostname equals `www.geocluegame.com`*, then a dynamic redirect to `concat("https://geocluegame.com", http.request.uri.path)`, status 301, preserving the query string.
3. Deploy.

---

## Part 4: Check that everything works

- [ ] `https://geocluegame.com` loads with a padlock icon.
- [ ] On your phone, the "How to play" box shows on first visit.
- [ ] Share the link in a text message or on Slack and check that the GeoClue preview card appears. Previews can be cached; if an old one shows, paste the link into <https://www.opengraph.xyz> to refresh.
- [ ] After Nov 1, play a game and tap **Share**.

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

In Cloudflare → your Pages project → **Deployments**, find the last good deployment, click the **⋯** menu, and choose **Rollback to this deployment**.

### Changing the launch date or share address

Edit `js/config.js` on GitHub (`LAUNCH_DATE` or `SITE_URL`) and commit.
