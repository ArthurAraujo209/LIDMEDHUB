// Script para popular categorias no Firestore.
// Execute no console do navegador após fazer login como admin.

import { db, collection, addDoc, getDocs, serverTimestamp } from "./firebase.js";

const CATEGORIES = [
  { name: "Cardiologia", slug: "cardiologia", order: 1 },
  { name: "Neurologia", slug: "neurologia", order: 2 },
  { name: "Pediatria", slug: "pediatria", order: 3 },
  { name: "Clínica Médica", slug: "clinica-medica", order: 4 },
  { name: "Dermatologia", slug: "dermatologia", order: 5 },
  { name: "Psiquiatria", slug: "psiquiatria", order: 6 },
  { name: "Ortopedia", slug: "ortopedia", order: 7 },
  { name: "Ginecologia", slug: "ginecologia", order: 8 },
  { name: "Obstetrícia", slug: "obstetricia", order: 9 },
  { name: "Infectologia", slug: "infectologia", order: 10 },
  { name: "Endocrinologia", slug: "endocrinologia", order: 11 },
  { name: "Pneumologia", slug: "pneumologia", order: 12 },
  { name: "Gastroenterologia", slug: "gastroenterologia", order: 13 },
  { name: "Nefrologia", slug: "nefrologia", order: 14 },
  { name: "Hematologia", slug: "hematologia", order: 15 },
  { name: "Oncologia", slug: "oncologia", order: 16 }
];

export async function seedCategories() {
  console.log("Iniciando seed de categorias...");

  // Verifica se já existem categorias
  const existing = await getDocs(collection(db, "categories"));
  if (!existing.empty) {
    console.warn(`Já existem ${existing.size} categorias. Deseja continuar? (pode criar duplicatas)`);
    if (!confirm("Continuar mesmo assim?")) {
      return;
    }
  }

  let created = 0;
  let errors = 0;

  for (const cat of CATEGORIES) {
    try {
      await addDoc(collection(db, "categories"), {
        ...cat,
        active: true,
        createdAt: serverTimestamp()
      });
      console.log(`✓ Categoria criada: ${cat.name}`);
      created++;
    } catch (err) {
      console.error(`✗ Erro ao criar ${cat.name}:`, err);
      errors++;
    }
  }

  console.log(`\nSeed concluído: ${created} criadas, ${errors} erros.`);
}

// Auto-executa se estiver sendo importado como módulo
if (import.meta.url === `${location.origin}/js/seed-categories.js`) {
  console.log("Para executar, chame seedCategories() no console.");
}
