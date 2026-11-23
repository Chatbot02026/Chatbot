# Chatbot

Responsive Azerbaijani group chat/admin panel built with React, Vite and Supabase. The repository can be connected to GitHub and deployed on Vercel.

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste and run `supabase/schema.sql` once.
3. In **Project Settings → API**, copy Project URL and the public anon/publishable key. Never put a `service_role` key in this browser app.
4. In **Authentication → URL Configuration**, add the deployed Vercel URL to Site URL and Redirect URLs.

The schema creates groups, membership, chat messages and private PDF storage with Row Level Security. Group owners can change invitation codes and manage PDFs. Other authenticated users can join by code.

## Local setup

```sh
npm install
```

Copy `.env.example` to `.env.local` and enter your project details:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Run `npm run dev`.

## GitHub and Vercel

Push this folder to a GitHub repository and import it in Vercel. Use the Vite preset, build command `npm run build`, and output directory `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Vercel Project Settings → Environment Variables, then redeploy.

## Scope

Email/password accounts, group creation and invite-code joining, owner code rotation and group deletion, Supabase Realtime group messages, and private PDF upload/deletion are connected. Messages travel over TLS and are access controlled, but end-to-end encryption is not implemented. Email confirmation behavior is controlled in Supabase Auth.
