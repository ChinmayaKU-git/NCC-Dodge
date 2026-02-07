# How to Deploy to Vercel

1.  **Push to GitHub**:
    - Create a new repository on GitHub.
    - Push this code to the repository.

2.  **Import to Vercel**:
    - Go to [vercel.com](https://vercel.com) and log in.
    - Click **"Add New..."** -> **"Project"**.
    - Import your GitHub repository.

3.  **Add Database**:
    - In your Vercel project dashboard, go to the **"Storage"** tab.
    - Click **"Create Database"** -> **"Postgres"**.
    - Follow the prompts (give it a name, select region).
    - Once created, go to the **".env.local"** tab in the database page, click **"Show Secret"** and **"Copy Snippet"**.
    - Go to your Project Settings -> **Environment Variables** and paste the variables there (or they might be added automatically during creation).

4.  **Redeploy**:
    - Go to **Deployments** and redeploy if it failed initially due to missing env vars.

## Local Development (Optional)
To run this locally with the cloud database:
1.  Install Vercel CLI: `npm i -g vercel`
2.  Link project: `vercel link`
3.  Pull env vars: `vercel env pull .env.local`
4.  Run: `npm run dev` (I added a dev script, or just `node server.js`) - *Note: You need to load env vars for `node server.js`, usually using `dotenv` package which isn't installed. Using `vercel dev` is easier.*

**Better Local Dev:**
Run `vercel dev` to start the local server with all environment variables loaded automatically.
