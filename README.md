# Trato Feito Bank — Gestão Veicular

Mini-ERP para gestão veicular, financeiro e equipe. Frontend Vite/React + Supabase.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Auth + Edge Functions)
- React Query, React Router, React Hook Form

## Desenvolvimento

```sh
npm install
npm run dev
```

App sobe em http://localhost:8080.

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```
VITE_SUPABASE_PROJECT_ID=...
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>
```

## Deploy

Deploy automático na Vercel a partir de `main`.
