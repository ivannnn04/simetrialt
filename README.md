# Simetria LT

Svetainė su savu CMS, CRM ir produktų katalogu, sukurta su [Next.js](https://nextjs.org) (App Router), [Prisma](https://www.prisma.io) ir Tailwind CSS.

## Funkcijos

- **Vieša svetainė** — pagrindinis puslapis, produktų katalogas su kategorijomis, produkto puslapiai, kontaktų forma.
- **CMS** (`/admin/pages`) — puslapių kūrimas ir redagavimas (pvz., `home`, `apie-mus`), SEO laukai, juodraščiai/paskelbimas. Puslapiai pasiekiami adresu `/<slug>`.
- **CRM** (`/admin/leads`) — kontaktų formos užklausos automatiškai tampa CRM įrašais; būsenos (Nauja → Susisiekta → Kvalifikuota → Laimėta/Prarasta), pastabos, rankinis įvedimas.
- **Katalogas** (`/admin/products`) — produktai su nuotraukų įkėlimu, kategorijos, masinis įkėlimas iš CSV (žr. `catalogue-example.csv`).

## Paleidimas

```bash
npm install
cp .env.example .env        # sugeneruokite SESSION_SECRET: openssl rand -hex 32
npx prisma migrate dev      # sukuria SQLite duomenų bazę
npm run db:seed             # sukuria administratorių ir pavyzdinius duomenis
npm run dev
```

Svetainė: http://localhost:3000 · Administravimas: http://localhost:3000/admin

Numatytasis administratorius (keičiamas per `.env` prieš `db:seed`):
`admin@simetria.lt` / `admin123` — **būtinai pakeiskite produkcijoje**.

## CSV importas

Katalogo įkėlimas per `/admin/products` → „Katalogo įkėlimas (CSV)“. Stulpeliai:

```
name,sku,price,currency,category,description,published
```

- `name` privalomas; kiti neprivalomi.
- Produktai atnaujinami pagal `sku`, o jei jo nėra — pagal pavadinimą.
- Kategorijos sukuriamos automatiškai.

## Produkcija

- `prisma/schema.prisma` pakeiskite `provider = "sqlite"` į `postgresql` ir nurodykite `DATABASE_URL`.
- Nuotraukos saugomos `public/uploads/` — diegiant į serverless aplinką (pvz., Vercel) perkelkite į S3/Cloudinary ar pan.
- `npm run build && npm start`.
