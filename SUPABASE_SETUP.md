# FlowFund Supabase Setup

FlowFund uses Supabase Auth and Supabase Postgres as the cloud layer. This project is currently a static browser app, so the public Supabase URL and publishable anon key live in `supabase-config.js`. If FlowFund is later moved to Vite, use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` instead. Do not put a service role key in the browser.

## 1. Create the database tables

Open the Supabase project SQL Editor and paste the full contents of `setup.sql`.

Project URL:

```text
https://wqwpzlxickdlthpyarze.supabase.co
```

The SQL creates:

- `profiles`
- `user_settings`
- `dashboards`
- `transactions`
- `allocations`
- `transaction_categories`
- `cashflow_health_settings`

It also enables Row Level Security and adds policies so users can only access rows where they are the owner.

## 2. Email/password auth

In Supabase, open Authentication, then Providers, then Email.

Enable Email provider. If email confirmation is enabled, new users must confirm email before they can sign in.

In Supabase, open Authentication, then URL Configuration. Set Site URL to the app URL you are actually using, for example:

```text
http://localhost:3000
```

If you are using the local preview server from this workspace, use:

```text
http://127.0.0.1:4173
```

Add that same URL to Redirect URLs. If the confirmation email opens `localhost refused to connect`, the email was confirmed but Supabase tried to return to a local URL where FlowFund was not running. Start FlowFund at that URL or replace it with your deployed app URL.

FlowFund also sends the current browser URL as the email return URL when it is opened over `http` or `https`. To force a specific return URL, set `authRedirectUrl` in `supabase-config.js`:

```js
authRedirectUrl: "http://localhost:3000",
```

Use `http://127.0.0.1:4173` here instead if that is the local app URL you are opening.

## 3. Google login

In Supabase, open Authentication, then Providers, then Google.

Enable Google and add the Client ID and Client Secret from Google Cloud Console.

Add your app URL to Supabase redirect URLs. OAuth redirects need an `http` or `https` URL, so use your deployed FlowFund URL or a local web server URL such as:

```text
http://localhost:3000
```

Then add Google to `supabase-config.js`:

```js
oauthProviders: ["google"],
```

## 4. Facebook login

In Supabase, open Authentication, then Providers, then Facebook.

Enable Facebook and add the App ID and App Secret from Meta for Developers.

Add the same app URL to the allowed redirect URLs in Supabase and in the Facebook app settings.

When both providers are enabled in Supabase, set `supabase-config.js` to:

```js
oauthProviders: ["google", "facebook"],
```

## 5. Local static app note

Opening `index.html` directly works for local data and email/password UI, but OAuth providers usually require an `http` or `https` callback. For Google/Facebook testing, serve the folder with a local static server or deploy it to a static host.
