<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d886ace6-134d-4738-8373-dc844d0527e9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Link this workspace to Neon and pull its database variables:
   `neon link --project-id <project-id> -y`
   `neon env pull`
3. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
4. Run the app:
   `npm run dev`

The Express API uses the pooled `DATABASE_URL`. On first startup it creates the
`propaxis_app_state` table and seeds it with the demo data; API changes are
persisted to Neon so they survive a server restart.
