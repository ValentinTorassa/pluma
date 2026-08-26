/** Script de prueba: inserta un artículo de ejemplo. Uso: npx tsx --env-file=.env.local scripts/seed.ts */
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const id = crypto.randomUUID();
const now = Date.now();

async function main() {
  await client.execute({
  sql: `INSERT INTO articles (id, slug, title, excerpt, content, cover_image, tags, status, published_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`,
  args: [
    id,
    "el-rol-de-la-pericia-psicologica-penal",
    "El rol de la pericia psicológica penal en el sistema judicial",
    "Un análisis sobre cómo las pericias psicológicas aportan evidencia clave en los procesos penales de la provincia de Santa Fe.",
    `## ¿Qué es una pericia psicológica penal?

La **pericia psicológica penal** es una evaluación técnica realizada por un profesional de la psicología en el marco de un proceso judicial. Su objetivo es aportar al juez elementos científicos para comprender aspectos psíquicos relevantes del caso.

![Etapas del proceso pericial](/images/pericia-proceso.svg)

## Su rol en el sistema judicial santafesino

En la provincia de Santa Fe, las pericias psicológicas cumplen funciones fundamentales:

- Evaluación de la imputabilidad y las facultades mentales del imputado
- Valoración del daño psíquico en víctimas
- Orientación técnica en causas de violencia familiar y de género

> La pericia no reemplaza la decisión judicial: la ilumina con conocimiento científico.

## Consideraciones éticas

El perito psicólogo debe mantener la *imparcialidad*, el *secreto profesional* dentro de los límites legales, y una formación continua en psicología jurídica.`,
    "/images/pericia-cover.svg",
    '["pericias","psicologia-forense","santa-fe"]',
    now,
    now,
    now,
  ],
  });

  console.log("Artículo de prueba creado:", id);
}

main();
