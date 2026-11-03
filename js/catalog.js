import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  serverTimestamp
} from "./firebase.js";

/**
 * Lista casos da casoteca com filtros.
 */
export async function listCases(filters = {}, limitCount = 12, lastDoc = null) {
  const {
    search,
    specialty,
    difficulty,
    sortBy = "recent" // recent | popular | rating
  } = filters;

  let q = query(
    collection(db, "cases"),
    where("status", "==", "published"),
    where("visibility", "==", "public")
  );

  // Filtros
  if (specialty) {
    q = query(q, where("specialty", "==", specialty));
  }

  if (difficulty) {
    q = query(q, where("difficulty", "==", parseInt(difficulty)));
  }

  // Ordenação
  if (sortBy === "popular") {
    q = query(q, orderBy("aggregate.attemptCount", "desc"));
  } else if (sortBy === "rating") {
    q = query(q, orderBy("aggregate.ratingAvg", "desc"));
  } else {
    q = query(q, orderBy("createdAt", "desc"));
  }

  q = query(q, firestoreLimit(limitCount));

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snap = await getDocs(q);

  let cases = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    _doc: doc // Para paginação
  }));

  // Filtro de busca textual (client-side)
  if (search) {
    const searchLower = search.toLowerCase();
    cases = cases.filter(c =>
      c.title?.toLowerCase().includes(searchLower) ||
      c.tags?.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  return {
    cases: cases.map(c => {
      const { _doc, ...rest } = c;
      return rest;
    }),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === limitCount
  };
}

/**
 * Busca categorias.
 */
export async function getCategories() {
  const q = query(
    collection(db, "categories"),
    where("active", "==", true),
    orderBy("order", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Cria categoria (admin).
 */
export async function createCategory(data) {
  const { name, slug, order = 0 } = data;

  return await addDoc(collection(db, "categories"), {
    name,
    slug,
    order,
    active: true,
    createdAt: serverTimestamp()
  });
}

/**
 * Atualiza categoria (admin).
 */
export async function updateCategory(categoryId, updates) {
  await updateDoc(doc(db, "categories", categoryId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

/**
 * Remove categoria (admin).
 */
export async function deleteCategory(categoryId) {
  await updateDoc(doc(db, "categories", categoryId), {
    active: false,
    updatedAt: serverTimestamp()
  });
}

/**
 * Lista todas as categorias (incluindo inativas, para admin).
 */
export async function listAllCategories() {
  const q = query(
    collection(db, "categories"),
    orderBy("order", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
