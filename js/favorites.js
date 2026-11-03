import {
  db,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from "./firebase.js";

/**
 * Adiciona caso aos favoritos.
 */
export async function addFavorite(userId, caseId) {
  const favoriteId = `${userId}_${caseId}`;

  await setDoc(doc(db, "favorites", favoriteId), {
    userId,
    caseId,
    createdAt: serverTimestamp()
  });
}

/**
 * Remove caso dos favoritos.
 */
export async function removeFavorite(userId, caseId) {
  const favoriteId = `${userId}_${caseId}`;
  await deleteDoc(doc(db, "favorites", favoriteId));
}

/**
 * Verifica se caso está nos favoritos.
 */
export async function isFavorite(userId, caseId) {
  const favoriteId = `${userId}_${caseId}`;
  const snap = await getDoc(doc(db, "favorites", favoriteId));
  return snap.exists();
}

/**
 * Lista favoritos do usuário.
 */
export async function getUserFavorites(userId, limitCount = 50) {
  const q = query(
    collection(db, "favorites"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);
  const favorites = snap.docs.slice(0, limitCount).map(doc => doc.data());

  // Busca dados dos casos
  const caseIds = favorites.map(f => f.caseId);
  const cases = [];

  for (const caseId of caseIds) {
    const caseDoc = await getDoc(doc(db, "cases", caseId));
    if (caseDoc.exists()) {
      cases.push({ id: caseDoc.id, ...caseDoc.data() });
    }
  }

  return cases;
}

/**
 * Toggle favorito.
 */
export async function toggleFavorite(userId, caseId) {
  const isFav = await isFavorite(userId, caseId);

  if (isFav) {
    await removeFavorite(userId, caseId);
    return false;
  } else {
    await addFavorite(userId, caseId);
    return true;
  }
}
