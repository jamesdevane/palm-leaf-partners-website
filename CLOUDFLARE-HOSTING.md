# Hosting note: palmleafpartners.com moved from Vercel to Cloudflare (2026-11-09)

**Every `*.palmleafpartners.com` site now runs on Cloudflare Workers. None of them are on Vercel any more.**
The Vercel projects and the Vercel domain entry for palmleafpartners.com have been deleted.
Look for these sites in Cloudflare (account `c9081c24f987d8475c3ed0d0faef7dea`), not in Vercel.

## What lives where now

| Hostname | Cloudflare Worker | Repo (E:\Development\…) | Deploys |
|---|---|---|---|
| palmleafpartners.com, www. | `palm-leaf-partners` | palm-leaf-partners-website | Auto on push to `main` (GitHub Actions) |
| portal., careers., communities., opportunities. | `palm-leaf-portal` | palm-leaf-portal | Auto on push to `main` (GitHub Actions) |
| thecobbles. | `cobbles-ministry-website` | cobbles-ministry-website | `wrangler deploy` (see that repo) |
| callcenter-demo. | `callcenter-demo` | DRC-Call-Center | `npm run deploy:worker` (see docs/DEPLOY_WORKERS.md) |
| internationalpeacememorial.org, www. | `international-memorial-of-peace(-www)` | DRC-International-Memorial-of-Peace | see that repo |

- **DNS:** every zone is in Cloudflare (nameservers kay/buck.ns.cloudflare.com). The Workers hostnames above are
  Workers *Custom Domains*: Cloudflare manages those DNS records itself. Don't add A/CNAME records for them.
- **Secrets:** stored on each Worker (`npx wrangler secret put NAME`), not in Vercel env vars. GitHub Actions
  deploys use the repo secrets `CLOUDFLARE_API_TOKEN` (plus `GOOGLE_MAPS_API_KEY` / `NEXT_PUBLIC_*` as build values).
- **Crons:** Vercel Cron is gone. The portal's hourly scheduler is a Cloudflare Cron Trigger (`0 * * * *`) on
  `palm-leaf-portal`. thecobbles' daily keepalive is a Cron Trigger on its Worker. The call-center jobs are wired
  but switched OFF pending a decision (see DRC-Call-Center/CLAUDE.md).
- **Logs:** Cloudflare dashboard → Workers & Pages → the Worker → Logs, or `npx wrangler tail <worker-name>`.
- **WhatsApp/Twilio:** webhooks still point at `https://portal.palmleafpartners.com/api/whatsapp`, same URL, now on Cloudflare.

## Still on Vercel (unchanged, NOT moved)

kindredlink.ai (all its subdomains), stayorbis.com (incl. app./cmd.), moosehollowlodge.com, biglodgeweddings.com.
Their DNS is in Cloudflare, but the sites themselves are Vercel projects.
