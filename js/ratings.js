import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  runTransaction
} from "./firebase.js";

/**
 * Cria ou atualiza avaliação de um caso.
 */
export async function rateCase(userId, caseId, stars, comment = "") {
  if (stars < 1 || stars > 5) {
    throw new Error("Avaliação deve ser entre 1 e 5 estrelas");
  }

  // Verifica se o usuário resolveu o caso
  const solvedCaseDoc = await getDoc(doc(db, "users", userId, "solvedCases", caseId));
  if (!solvedCaseDoc.exists()) {
    throw new Error("Você precisa resolver o caso antes de avaliá-lo");
  }

  const ratingId = `${userId}_${caseId}`;
  const ratingRef = doc(db, "ratings", ratingId);
  const ratingSnap = await getDoc(ratingRef);

  const isUpdate = ratingSnap.exists();
  const oldStars = isUpdate ? ratingSnap.data().stars : 0;

  // Usa transaction para atualizar média de forma consistente
  const updatedAggregate = await runTransaction(db, async (transaction) => {
    const caseRef = doc(db, "cases", caseId);
    const caseDoc = await transaction.get(caseRef);

    if (!caseDoc.exists()) {
      throw new Error("Caso não encontrado");
    }

    const aggregate = caseDoc.data().aggregate || {};
    const ratingCount = aggregate.ratingCount || 0;
    const ratingAvg = aggregate.ratingAvg || 0;

    let newCount, newAvg;

    if (isUpdate) {
      // Atualiza avaliação existente
      const totalStars = ratingAvg * ratingCount;
      const newTotalStars = totalStars - oldStars + stars;
      newAvg = newTotalStars / ratingCount;
      newCount = ratingCount;
    } else {
      // Nova avaliação
      const totalStars = ratingAvg * ratingCount;
      const newTotalStars = totalStars + stars;
      newCount = ratingCount + 1;
      newAvg = newTotalStars / newCount;
    }

    transaction.set(ratingRef, {
      userId,
      caseId,
      stars,
      comment: comment.trim(),
      createdAt: isUpdate ? ratingSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    transaction.update(caseRef, {
      "aggregate.ratingAvg": newAvg,
      "aggregate.ratingCount": newCount,
      updatedAt: serverTimestamp()
    });
    return { ratingAvg: newAvg, ratingCount: newCount };
  });
  return updatedAggregate;
}

/**
 * Busca avaliação do usuário para um caso.
 */
export async function getUserRating(userId, caseId) {
  const ratingId = `${userId}_${caseId}`;
  const snap = await getDoc(doc(db, "ratings", ratingId));
  return snap.exists() ? snap.data() : null;
}

/**
 * Lista avaliações de um caso.
 */
export async function getCaseRatings(caseId, limitCount = 20) {
  const q = query(
    collection(db, "ratings"),
    where("caseId", "==", caseId)
  );

  const snap = await getDocs(q);
  return snap.docs
    .map(document => ({ id: document.id, ...document.data() }))
    .sort((a, b) => {
      const starDifference = (Number(b.stars) || 0) - (Number(a.stars) || 0);
      if (starDifference) return starDifference;
      return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
    })
    .slice(0, limitCount);
}

function getTimestampMillis(timestamp) {
  if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
  if (typeof timestamp?.toDate === "function") return timestamp.toDate().getTime();
  const parsed = new Date(timestamp || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Verifica se o usuário pode avaliar o caso.
 */
export async function canRateCase(userId, caseId) {
  const solvedCaseDoc = await getDoc(doc(db, "users", userId, "solvedCases", caseId));
  return solvedCaseDoc.exists();
}
