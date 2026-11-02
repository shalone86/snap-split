# Handoff: deploy an app made from this template

For an agent or a person on the owner's computer.

1. `npm install && npm test`
2. `npx wrangler whoami` must show the owner's account (ariyandhamma@gmail.com). If `CLOUDFLARE_API_TOKEN` belongs to another account, unset it.
3. Check that no Worker with the same name exists (`npx wrangler deployments list --name <name>` should say it doesn't exist), so nothing gets overwritten.
4. `npx wrangler deploy`
5. Custom domain (ask the owner first; it creates a DNS record): uncomment the `routes` line in `wrangler.jsonc` and deploy again.
6. Verify: `curl -s https://<url>/api/health` → `{"tts":true,...}`; the page loads; on a phone, add it to the home screen and check the icon.
