# KOLA Messaging Lab — Gemini edition

## Included
- `index.html`: KOLA website with Messaging Lab and Parts Paradise promotion.
- `worker.js`: Cloudflare Worker API using Google Gemini for advert generation, with KV storage for campaign drafts and customer feedback.
- `wrangler.toml`: deployment configuration template.

## Before deployment
1. Create a Cloudflare KV namespace (Workers & Pages → KV). Copy its namespace ID into `wrangler.toml`, replacing `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.
2. Confirm the Worker name and route in `wrangler.toml` match the existing KOLA deployment. Do not deploy under a different name or overwrite another production Worker unintentionally.
3. Add your Gemini key as a Cloudflare Worker secret named exactly `GEMINI_API_KEY`. Never place the key in `index.html` or share it in chat. With Wrangler: `npx wrangler secret put GEMINI_API_KEY`. In the Cloudflare dashboard, use the Worker's Settings → Variables and Secrets → Add → Secret.
4. Ensure the KV binding is named exactly `KOLA_DATA`.
5. Deploy the Worker and static assets from this project folder using Wrangler: `npx wrangler deploy`. A dashboard-only deployment may require a separate static-assets upload/configuration.
6. Visit `https://k-digital-ng.successphu.workers.dev/api/health`. Expect `ok: true`, `aiConfigured: true`, and `storageConfigured: true` once the secret and KV binding are set.

## Gemini configuration
- Default model: `gemini-2.5-flash`. Change `GEMINI_MODEL` in `wrangler.toml` only to a model available to your Google AI Studio API key.
- Gemini free-tier eligibility, rate limits, model availability and data-use terms can vary by account, region and change over time. Check Google AI Studio and the Gemini API pricing/terms before relying on free usage.

## Included API routes
- `GET /api/health` — reports whether Gemini and KV are configured.
- `POST /api/generate` — generates advert copy and broad audience suggestions using Gemini.
- `POST /api/feedback` — stores consented customer feedback in KV.
- `POST /api/campaigns` — stores campaign drafts in KV.

## Store promotion
Parts Paradise is promoted at `https://parts-paradise-builder.lovable.app` in the navigation, announcement area, Messaging Lab and footer.

## Important launch notes
- This creates advert drafts and audience suggestions; it does not automatically publish paid Meta or Google advertisements. Direct publishing requires approved platform apps, business accounts, permissions, access tokens and further integration.
- Feedback and campaign data are stored in KV. Add authentication and admin-only reporting before exposing customer feedback to staff.
- Add rate limiting, abuse protection, a privacy notice and data retention/deletion controls before public launch.
