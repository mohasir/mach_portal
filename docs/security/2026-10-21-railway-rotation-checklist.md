# Railway incident — credential rotation checklist

Incident: Railway disclosed on 2026-10-21 that an unauthorized third party may have accessed
encrypted environment variables and decrypted some of them. Railway recommends rotating every
variable stored in the platform, for all users.

- Disclosure: https://blog.railway.com/p/security-disclosure-wednesday-october-21st
- Status: https://status.railway.com/ (incident QH8L8B3E)

Constraint: builds and deployments are paused, so running services keep the **old** variables
until a redeploy is possible. Variables are parsed once at boot (`apps/api/src/env.ts`).

## 0. Before rotating

- [ ] Check email for a Railway notice marking the account as affected.
- [ ] List every variable in Railway for **all** services (api, web, PDF service, database). Add any not listed below.
- [ ] Decide per secret: rotate now (downtime until redeploy) or wait for builds (exposure window stays open). See "Impact" column.
- [ ] Generate all new values up front and keep them in a password manager, not in chat or files in the repo.

## 1. Secrets to rotate

| Done | Variable | Service | Impact of rotating before redeploy | How to rotate |
|---|---|---|---|---|
| [ ] | `DATABASE_URL` | api | **API goes down** (new pool connections fail) until redeploy with the new URL | Reset the Postgres user password / regenerate credentials; build the new URL; set it in Railway |
| [ ] | `BETTER_AUTH_SECRET` | api + web | None until redeploy; afterwards **all sessions invalidated** (users must log in again) | `openssl rand -base64 32`; set the **same** value in api and web |
| [ ] | `R2_ACCESS_KEY_ID` | api | Uploads / deletes / PDF storage fail until redeploy if the old token is revoked first | Cloudflare → R2 → API tokens: create new token scoped to the bucket |
| [ ] | `R2_SECRET_ACCESS_KEY` | api | Same as above | Same token as above |
| [ ] | `PDF_SERVICE_API_KEY` | api (+ PDF service) | PDF generation fails if only one side is changed | Generate a new key; set it in the PDF service and in the api |
| [ ] | Registry / other tokens | any | — | Revoke any private registry credentials, SMTP, webhooks found in step 0 |

Service `mach-db-backup` (Railway cron container) holds its own copy of secrets:

| Done | Variable | Notes |
|---|---|---|
| [ ] | `DATABASE_URL` | Same database as the api. Use the `${{ Postgres.DATABASE_URL }}` reference; if it is a pasted string, replace it or the backups will start failing after the password regenerate. |
| [ ] | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | With `R2_ENDPOINT` set these are most likely Cloudflare R2 credentials used through an S3 client (confirm). Create a dedicated token for the backup bucket, ideally without delete permission, separate from the api's token. |
| [ ] | `R2_BUCKET`, `R2_ENDPOINT`, `AWS_DEFAULT_REGION`, `AWS_*_CHECKSUM_*` | Not secrets. |

- [ ] Check the backup bucket for deleted or missing objects since 2026-10-21 and confirm the latest backup restores.
- [ ] Copy the latest backups outside Railway before rotating, in case the old token was abused.
- [ ] After the next scheduled run, confirm the cron job still succeeds with the new values.

Not secrets (no rotation needed): `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`,
`PDF_SERVICE_URL`, `WEB_ORIGIN`, `WEB_APP_URL`, `BETTER_AUTH_URL`, `API_URL`, `PORT`,
`STORAGE_PROVIDER`, `NEXT_PUBLIC_*`.

## 2. Rotate outside Railway (possible now)

- [ ] Cloudflare R2: create the new API token.
- [ ] Cloudflare R2: revoke the old token once the new one is deployed (or immediately if audit logs show suspicious activity).
- [ ] Postgres: if the database is **not** hosted on Railway, reset its password when ready to redeploy.
- [ ] Revoke and re-authorize GitHub / CLI tokens linked to Railway.

## 3. When builds return

- [ ] Update variables in Railway (api, PDF service) with the new values.
- [ ] Update `BETTER_AUTH_SECRET` in Netlify (web site settings → Environment variables) to the **same** new value, then trigger a Netlify deploy. Netlify is not affected by the Railway incident, but the secret must match the api's, so change both in the same window.
- [ ] Redeploy api and PDF service in Railway.
- [ ] Verify login works (new `BETTER_AUTH_SECRET` logs everyone out; this is expected).
- [ ] Verify file upload and PDF generation.
- [ ] Revoke the old R2 token and any old keys that were kept alive.

## 3a. PostgreSQL (Railway guide of 2026-10-22)

Regenerate restarts the database: every open session drops (attacker's included) and services
cannot reconnect until they are redeployed. Railway accepts this short outage when a leak is
suspected; the zero-downtime dual-role flow is only for when compromise is unlikely.

- [ ] Database tab > Config > Connection: check whether **Public Access** (TCP proxy) is enabled; disable it if nothing outside the project needs it.
- [ ] List consumers: services using `${{ Postgres.DATABASE_URL }}` pick up the new password on redeploy; pasted connection strings do not (replace them with the reference).
- [ ] List external consumers of `DATABASE_PUBLIC_URL` (local dev, CI, BI tools, cron jobs off-platform).
- [ ] Once deployments are available again: **Regenerate** the password, then immediately redeploy api (and every other consumer).
- [ ] Verify: deploy logs show a successful connection, no `authentication failed`; `railway connect Postgres` works.
- [ ] `select * from pg_stat_activity;` and terminate unknown sessions with `pg_terminate_backend(<pid>)`.
- [ ] Check for unexpected roles, extensions and row changes. If data was altered, preserve evidence before restoring from backup / point-in-time recovery.

## 3b. Railway's own credential reset (guidance of 2026-10-22)

Railway reset two things on its side: bucket credentials (every bucket, every environment) and
the GitHub tokens it held for each connection (including GitHub tokens stored as registry
credentials). Audit log entries show "Railway Staff". Databases and general variables are **not**
covered by this reset.

- [ ] Reconnect GitHub in Railway Account Settings; confirm the Railway GitHub App still has access to the repo.
- [ ] For api and web: check **Source** (repo + branch `main`); reconnect if disconnected; re-enable autodeploy if it was turned off.
- [ ] Test with **Deploy Latest Commit** once builds are back.
- [ ] If any service pulls from `ghcr.io`: delete the old GitHub token, create a new one with `read:packages`, set it in Settings > Source > Registry Credentials (Pro plan), redeploy.
- [ ] If a Railway Storage Bucket exists (this repo uses Cloudflare R2): copy the new credentials and redeploy dependent services. Buckets have no automatic backups; review their files for unexpected uploads or deletions.
- [ ] Audit Logs page: export what is needed (retention depends on plan) and look for variable reads, registry credential changes and deployments that nobody on the team made.

## 3c. Second rotation after Railway confirms containment

Values rotated while the incident is still open are stored in Railway again, so an attacker who
still has access could read them too. Railway had not declared the access contained when the
first rotation was done.

- [ ] Wait for Railway to state that the incident is contained (status page / security disclosure).
- [ ] Rotate again: `DATABASE_URL` (Regenerate), `BETTER_AUTH_SECRET` (api + Netlify, same value), R2 tokens (api and backup), `PDF_SERVICE_API_KEY` (Railway + Lambda).
- [ ] After the new `BETTER_AUTH_SECRET` is live, clear sessions: `DELETE FROM "session";` (back up first; never `DROP`; do not touch `user`, `account`, `member`, `verification`).
- [ ] Confirm login works, uploads and PDF generation work, and the next backup run succeeds.

## 4. Log review for unusual activity

- [ ] Postgres: connections from unknown IPs, connection or query spikes, bulk exports since 2026-10-21 and earlier.
- [ ] Table `platform_access_log`: unexpected platform accesses.
- [ ] Better Auth tables: recent sessions from unfamiliar IPs / user agents; recently created users; role changes to admin.
- [ ] Cloudflare R2: analytics and audit log for unusual reads, writes or deletes.
- [ ] Railway: project audit log (members, tokens, variable changes) and service logs.

## 5. Local development

- [ ] If any local `.env` reuses production credentials, treat them as compromised and rotate them too.

## 6. Follow-up

- [ ] Watch https://status.railway.com/ for builds restored (staged: Enterprise, Pro, Hobby, Free/Trial).
- [ ] Read Railway's guides for next steps and the GCP / AWS anomalous-access posts.
- [ ] After closing the incident, note any exposure found in the log review.
