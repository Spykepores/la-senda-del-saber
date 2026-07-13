import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import "dotenv/config";

const PASSWORD = "trivia2026";

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // Admin user
  await db.insert(schema.localUsers).values({
    name: "PoresPores (Admin)",
    email: "admin@sendadelsaber.com",
    phone: "3000000000",
    passwordHash,
    role: "admin",
  }).onConflictDoNothing();
  console.log("✅ Admin created: admin@sendadelsaber.com / 3000000000 — password: trivia2026");

  // Demo client 1
  await db.insert(schema.localUsers).values({
    name: "David (Demo)",
    email: "demo1@sendadelsaber.com",
    phone: "3001111111",
    passwordHash,
    role: "user",
  }).onConflictDoNothing();
  console.log("✅ Demo 1 created: demo1@sendadelsaber.com / 3001111111 — password: trivia2026");

  // Demo client 2
  await db.insert(schema.localUsers).values({
    name: "Maria (Demo)",
    email: "demo2@sendadelsaber.com",
    phone: "3002222222",
    passwordHash,
    role: "user",
  }).onConflictDoNothing();
  console.log("✅ Demo 2 created: demo2@sendadelsaber.com / 3002222222 — password: trivia2026");

  // Seed sample questions
  const sampleQuestions = [
    {
      category: "genealogy" as const,
      difficulty: "easy" as const,
      question: "¿Quién fue el primer hombre creado por Dios?",
      option1: "Adán",
      option2: "Noé",
      option3: "Abraham",
      option4: "Moisés",
      correctAnswer: 0,
      explanation: "Dios creó a Adán del polvo de la tierra (Génesis 2:7).",
      isActive: true,
    },
    {
      category: "parables" as const,
      difficulty: "easy" as const,
      question: "¿En la parábola del sembrador, qué representa la tierra buena?",
      option1: "El corazón receptivo que produce fruto",
      option2: "Las riquezas del mundo",
      option3: "Los fariseos",
      option4: "El desierto",
      correctAnswer: 0,
      explanation: "La tierra buena representa a quienes escuchan la palabra, la reciben y producen fruto (Marcos 4:20).",
      isActive: true,
    },
    {
      category: "stories" as const,
      difficulty: "medium" as const,
      question: "¿Cuántos días duró el diluvio de Noé?",
      option1: "7 días",
      option2: "40 días",
      option3: "3 días",
      option4: "1 año",
      correctAnswer: 1,
      explanation: "Llovió sobre la tierra cuarenta días y cuarenta noches (Génesis 7:12).",
      isActive: true,
    },
    {
      category: "prophecy" as const,
      difficulty: "medium" as const,
      question: "¿Quién profetizó que un niño nacería de una virgen?",
      option1: "Isaías",
      option2: "Jeremías",
      option3: "Ezequiel",
      option4: "Daniel",
      correctAnswer: 0,
      explanation: "Isaías 7:14 profetizó: 'La virgen concebirá y dará a luz un hijo'.",
      isActive: true,
    },
    {
      category: "doctrine" as const,
      difficulty: "easy" as const,
      question: "¿Cuál es el primer mandamiento con promesa?",
      option1: "Honra a tu padre y a tu madre",
      option2: "No matarás",
      option3: "No robarás",
      option4: "Ama al Señor tu Dios",
      correctAnswer: 0,
      explanation: "Efesios 6:2-3: 'Honra a tu padre y a tu madre, que es el primer mandamiento con promesa'.",
      isActive: true,
    },
    {
      category: "characters" as const,
      difficulty: "easy" as const,
      question: "¿Quién fue el profeta que venció a los profetas de Baal en el Monte Carmelo?",
      option1: "Elías",
      option2: "Eliseo",
      option3: "Samuel",
      option4: "Jeremías",
      correctAnswer: 0,
      explanation: "Elías desafió a 450 profetas de Baal y Dios respondió con fuego del cielo (1 Reyes 18).",
      isActive: true,
    },
    {
      category: "books" as const,
      difficulty: "easy" as const,
      question: "¿Cuál es el primer libro del Nuevo Testamento?",
      option1: "Mateo",
      option2: "Génesis",
      option3: "Marcos",
      option4: "Juan",
      correctAnswer: 0,
      explanation: "El Evangelio de Mateo es el primer libro del Nuevo Testamento.",
      isActive: true,
    },
  ];

  for (const q of sampleQuestions) {
    await db.insert(schema.questions).values(q).onConflictDoNothing();
  }
  console.log(`✅ ${sampleQuestions.length} sample questions seeded`);

  // Seed sample seasons
  await db.insert(schema.seasons).values({
    bookName: "genesis",
    bookDisplay: "Genesis",
    weeks: 4,
    description: "El libro de los comienzos: creación, caída, diluvio y patriarcas",
    color: "#10B981",
    isActive: true,
  }).onConflictDoNothing();
  console.log("✅ Sample season seeded: Genesis");

  console.log("\n🎉 Seed complete!");
  console.log("\n=== USUARIOS DEMO ===");
  console.log("👑 Admin:  admin@sendadelsaber.com  |  3000000000  |  password: trivia2026");
  console.log("👤 Demo1: demo1@sendadelsaber.com  |  3001111111  |  password: trivia2026");
  console.log("👤 Demo2: demo2@sendadelsaber.com  |  3002222222  |  password: trivia2026");
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
