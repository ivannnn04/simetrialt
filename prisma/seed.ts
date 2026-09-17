import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@simetria.lt";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Administratorius",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  console.log(`Admin user ready: ${email}`);

  // Sample content is only for local development; production starts empty.
  if (process.env.NODE_ENV === "production") return;

  await db.page.upsert({
    where: { slug: "home" },
    update: {},
    create: {
      slug: "home",
      title: "Simetria LT",
      published: true,
      content:
        "Sveiki atvykę į Simetria LT!\n\n## Apie mus\n\nŠį tekstą galite pakeisti administratoriaus aplinkoje (Puslapiai → home).",
    },
  });

  const category = await db.category.upsert({
    where: { slug: "pavyzdine-kategorija" },
    update: {},
    create: { name: "Pavyzdinė kategorija", slug: "pavyzdine-kategorija" },
  });

  await db.product.upsert({
    where: { slug: "pavyzdinis-produktas" },
    update: {},
    create: {
      name: "Pavyzdinis produktas",
      slug: "pavyzdinis-produktas",
      sku: "DEMO-001",
      description: "Tai pavyzdinis produktas. Ištrinkite jį administratoriaus aplinkoje.",
      priceCents: 4999,
      salePriceCents: 4250,
      brand: "Sancal",
      typology: "3-seater",
      material: "Fabric",
      inShowroom: true,
      published: true,
      categoryId: category.id,
    },
  });
  console.log("Sample page, category and product ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
