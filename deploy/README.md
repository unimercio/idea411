# Hostinger VPS deployment

The admin page at **/admin/deploy** triggers the
`.github/workflows/deploy-vps.yml` workflow, which SSHes into your VPS and
runs `deploy/deploy.sh`.

## One-time VPS setup

1. **Install prerequisites** (Ubuntu 22.04+):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs git nginx
   curl -fsSL https://bun.sh/install | bash
   sudo npm i -g pm2
   ```
2. **Create a deploy user and clone the repo** (path becomes `VPS_APP_DIR`):
   ```bash
   sudo adduser --disabled-password deploy
   sudo -iu deploy
   git clone https://github.com/unimercio/idea411.git ~/idea411
   ```
3. **SSH key for GitHub Actions** — on your laptop:
   ```bash
   ssh-keygen -t ed25519 -f vps_deploy -C github-actions
   ssh-copy-id -i vps_deploy.pub deploy@YOUR.VPS.IP
   ```
   Add the **private** key as the `VPS_SSH_KEY` secret in GitHub.
4. **Environment variables** — create `/home/deploy/idea411/.env.production` with:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_PROJECT_ID=...
   VITE_SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_URL=...
   SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   LOVABLE_API_KEY=...
   OPENROUTER_API_KEY=...
   PERPLEXITY_API_KEY=...
   GITHUB_TOKEN=...
   PORT=3000
   ```
   PM2 picks these up via the ecosystem file's `env` block + dotenv loader.
5. **Nginx + TLS** — copy `deploy/nginx.conf.example` to
   `/etc/nginx/sites-available/idea411`, symlink into `sites-enabled/`,
   then `sudo nginx -t && sudo systemctl reload nginx` and
   `sudo certbot --nginx -d your-domain.com`.

## GitHub repository secrets

Set these under **Settings → Secrets and variables → Actions** in
`unimercio/idea411`:

| Secret          | Example                          |
| --------------- | -------------------------------- |
| `VPS_HOST`      | `123.45.67.89` or `vps.example`  |
| `VPS_USER`      | `deploy`                         |
| `VPS_PORT`      | `22` (optional)                  |
| `VPS_SSH_KEY`   | full private key, incl. headers  |
| `VPS_APP_DIR`   | `/home/deploy/idea411`           |

## First deploy

From the admin page click **Deploy now**, or run locally:
```bash
gh workflow run deploy-vps.yml -f ref=main
```
