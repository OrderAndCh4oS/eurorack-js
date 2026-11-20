# Account and patch sharing setup

Vercel Functions run the app’s Better Auth session service. Google OAuth and Neon managed Better Auth email links share one account for the same verified email. Resend delivers the links, Neon PostgreSQL stores accounts and patches, and private Vercel Blob stores rack images. See [backend contracts](cloud-backend.md).

## Already configured

- Existing Vercel project: `seanorderandchaos-projects/eurorack-js`. Its root directory now points to the repository root; `vercel.json` builds `dist` plus the API.
- Neon project `purple-mud-94223804` is connected with a separate preview database. The integration supplies `DATABASE_URL`; the application also accepts `STORAGE_URL`.
- Better Auth and patch tables were migrated in both Vercel **preview and production** environments on 13 November 2026.
- Private Blob stores: `eurorack-patches-preview` for Preview and `eurorack-patches-production` for Production, both in London (`lhr1`). Each environment receives its own `BLOB_READ_WRITE_TOKEN`.
- The preview build verified a real Blob upload and authenticated download, then removed its temporary test object.
- Separate sensitive `BETTER_AUTH_SECRET` values and the appropriate `BETTER_AUTH_URL` are set for Preview and Production.
- The build includes public `/privacy-policy` and `/terms-of-service` pages using the approved public support address.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured for **Production only**. The live `/api/config` reports `enabled`, `authEnabled`, and `imagesEnabled` as `true`.
- Live anonymous checks passed: `/api/me` returned `configured: true, user: null`, the public patch listing returned HTTP 200, and the private patch listing returned HTTP 401.
- Live sign-in initiation returned an `accounts.google.com` authorization URL with the canonical `/api/auth/callback/google` redirect, only `email profile openid` scopes, and PKCE `S256`. A real user must still complete Google sign-in to verify the callback, session persistence, and logout.

## Enable email sign-in

1. Connect the Neon branch to the matching Vercel project environment. It supplies `NEON_AUTH_BASE_URL`. Keep the existing `BETTER_AUTH_SECRET`, database connection and exact `BETTER_AUTH_URL` for that environment.
2. Set the server-only `RESEND_API_KEY` in Vercel. The default sender is `Eurorack JS <support@orderandchaos.xyz>`. Verify the sending domain in Resend, or set `RESEND_FROM` to an address on a domain verified for that key. Disable click tracking for sign-in mail so the verification link reaches the browser intact. [Resend domains](https://resend.com/docs/dashboard/domains/introduction)
3. Deploy the app. In the Neon branch’s **Settings → Better Auth → Webhooks**, subscribe `send.magic_link` to `<BETTER_AUTH_URL>/api/webhooks/neon-auth`. Use the stable alias for the matching environment. For a protected Vercel preview, the webhook URL needs a project automation bypass scoped to that preview where available. Include its secret query parameter only in the Neon webhook configuration. Keep the preview deployment protected. [Neon webhooks](https://neon.com/docs/auth/guides/webhooks) · [Vercel automation bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
4. Add the exact app origin to the branch’s trusted domains. In **Magic Link**, enable the plugin and allow new user registration. The default link lifetime is five minutes. Configure each preview branch’s webhook for its own deployment. [Neon Magic Link](https://neon.com/docs/auth/guides/plugins/magic-link)
5. Check `/api/config` for `authMethods.magicLink`. It reports local configuration. Test delivery and redemption with an inbox you control. Signing in with the verified email of a Google account should open that account’s saved patches. Google credentials are optional in an email-only preview.

The existing Better Auth account, session and verification tables support this change without an application database migration.

## Create the Google client

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview), select the production project, and complete **Branding** with the name **Eurorack JS**, your public support email, and your developer contact email. The homepage is `https://eurorackjs.orderandchaos.xyz`; the authorized domain is `orderandchaos.xyz` if requested.
2. Under **Audience**, choose **External**. While the application is in Testing, add your Google account and any other testers.
3. Under **Clients → Create client**, choose **Web application**.
4. Set the production JavaScript origin to `https://eurorackjs.orderandchaos.xyz` and the authorized redirect URI to:

   ```text
   https://eurorackjs.orderandchaos.xyz/api/auth/callback/google
   ```

5. Add the production client's `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to [Vercel environment settings](https://vercel.com/seanorderandchaos-projects/eurorack-js/settings/environment-variables), selecting **Production only**. Mark the secret sensitive. Do not put credentials in browser-prefixed variables, source code, screenshots or chat.
6. For protected Preview and local development, use a **separate Google Cloud project and OAuth client**. Keep those credentials out of Production. Register the preview origin and redirect URI on that test client:

   ```text
   https://eurorack-js-preview-seanorderandchaos-projects.vercel.app
   https://eurorack-js-preview-seanorderandchaos-projects.vercel.app/api/auth/callback/google
   ```

7. Set that test client's credentials for **Preview only**, then redeploy the preview. Test sign-in, refresh, logout, account switching, private saves, publishing, copies and image revocation. Vercel's existing preview protection still requires access to this project; it has not been disabled. Redeploy Production after changing its own credentials, and complete a real sign-in there too.
8. Before opening sign-in to everyone, switch the Google audience from Testing to **In production** and complete any branding requirements shown by Google.

The callback path is defined by [Better Auth's Google provider](https://better-auth.com/docs/authentication/google); Google requires [an exact registered redirect URI](https://developers.google.com/identity/protocols/oauth2/web-server). Google's [production policy](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance) says production clients must not include test environments, redirect URIs, or JavaScript origins available only to the developer or team.

## Deploy and migrate deliberately

Normal builds do not run migrations. Sensitive Neon integration values download as placeholders through `vercel env pull`, so run the opt-in migration in the intended Vercel build environment rather than copying credentials around.

```sh
# Preview schema and private Blob round-trip check
vercel deploy --build-env EURORACK_MIGRATE_DATABASE=preview

# After preview acceptance and Google setup, deploy production and its schema
vercel deploy --prod --build-env EURORACK_MIGRATE_DATABASE=production
```

`scripts/vercel-build.mjs` refuses a migration flag whose value differs from `VERCEL_ENV`. Production migration is a separate deliberate action; the initial schema has now been applied. Keep the preview alias pointing at the tested preview deployment when redeploying. The production `eurorack-js.vercel.app` alias redirects to the custom domain so sessions have one origin.

Run `db/cleanup.mjs` periodically from a trusted environment with the matching database and Blob credentials. It clears unattached previews older than 24 hours and retries queued object deletions. Never run preview cleanup with the production Blob token. See [cleanup details](cloud-backend.md).

## Local development and checks

```sh
npm ci
npm run dev        # http://127.0.0.1:4176; cloud stays disabled without real configuration
npm test
npm run test:e2e
```

Browser tests launch a separate in-memory backend with Alice/Bob fixtures. It requires `NODE_ENV=test`, refuses Vercel, and is never selected by the production API. The full unit suite passes 2,398 tests. The full 26-test Chromium suite passed, followed by passing focused checks for the new legal page, updated copy gate, previews and analytics; three real PostgreSQL integration tests were also run against a disposable local database. Production credentials are configured and sign-in initiation is verified as described above; the actual Google callback/session/logout and WebKit checks remain untested.

For real local sign-in, use `.env.example`, a development database and private image store, and the test Google project/client with a registered callback at `http://127.0.0.1:4176/api/auth/callback/google`. Never use production credentials in the test harness.
