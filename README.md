# Simetria LT

Svetainė su savu CMS, CRM ir produktų katalogu, sukurta su [Next.js](https://nextjs.org) (App Router), [Prisma](https://www.prisma.io) + PostgreSQL ir Tailwind CSS.

## Funkcijos

- **Vieša svetainė** — pagrindinis puslapis, produktų katalogas su kategorijomis, produkto puslapiai, kontaktų forma.
- **CMS** (`/admin/pages`) — puslapių kūrimas ir redagavimas (pvz., `home`, `apie-mus`), SEO laukai, juodraščiai/paskelbimas. Puslapiai pasiekiami adresu `/<slug>`.
- **CRM** (`/admin/leads`) — kontaktų formos užklausos automatiškai tampa CRM įrašais; būsenos (Nauja → Susisiekta → Kvalifikuota → Laimėta/Prarasta), pastabos, rankinis įvedimas.
- **Katalogas** (`/admin/products`) — produktai su nuotraukų įkėlimu, kategorijos, masinis įkėlimas iš CSV (žr. `catalogue-example.csv`).

## Paleidimas

```bash
npm install
cp .env.example .env        # sugeneruokite SESSION_SECRET: openssl rand -hex 32
npx prisma migrate deploy   # pritaiko migracijas PostgreSQL duomenų bazei (DATABASE_URL)
npm run db:seed             # sukuria administratorių ir pavyzdinius duomenis
npm run dev
```

Svetainė: http://localhost:3000 · Administravimas: http://localhost:3000/admin

Numatytasis administratorius (keičiamas per `.env` prieš `db:seed`):
`admin@simetria.lt` / `admin123` — **būtinai pakeiskite produkcijoje**.

## CSV importas

Katalogo įkėlimas per `/admin/products` → „Katalogo įkėlimas (CSV)“. Stulpeliai:

```
name,sku,price,sale_price,currency,category,brand,typology,material,in_showroom,description,published
```

- `name` privalomas; kiti neprivalomi.
- Produktai atnaujinami pagal `sku`, o jei jo nėra — pagal pavadinimą.
- Kategorijos sukuriamos automatiškai.

## Diegimas į Vercel

1. Vercel → **Add New Project** → importuokite šį GitHub repo (framework: Next.js, nustatymai iš `vercel.json`).
2. Duomenų bazė — vienas iš variantų:
   - **Vercel Storage → Neon Postgres** → Connect Project: Vercel sukurs `DATABASE_URL`; papildomai pridėkite `DIRECT_URL` su ta pačia reikšme.
   - **Supabase**: Project Settings → Database → Connection string. `DATABASE_URL` = *Transaction pooler* (port 6543) + `?pgbouncer=true&connection_limit=1`; `DIRECT_URL` = *Session pooler* (port 5432).
3. **Storage → Blob** → Connect Project (sukurs `BLOB_READ_WRITE_TOKEN`, reikalingas nuotraukų įkėlimui).
4. **Settings → Environment Variables** pridėkite `SESSION_SECRET` (`openssl rand -hex 32`).
5. Ten pat pridėkite `SEED_ADMIN_EMAIL` ir `SEED_ADMIN_PASSWORD` — administratorius sukuriamas automatiškai per build (`prisma db seed`; produkcijoje pavyzdiniai duomenys nekuriami).
6. **Deploy**. Build komanda `prisma migrate deploy && prisma db seed && next build` sukuria lenteles ir administratorių.
7. Nuotraukos iš Figma dedamos į `public/images/` (žr. `public/images/README.md`) ir commit'inamos į repo.

Produkte produktų nuotraukos keliamos į Vercel Blob; lokaliai (be `BLOB_READ_WRITE_TOKEN`) — į `public/uploads/`.
