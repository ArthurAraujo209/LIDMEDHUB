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
  limit,
  startAfter,
  serverTimestamp,
  writeBatch
} from "./firebase.js";
import { publicName } from "./utils/publicName.js";

/**
 * Cria um novo caso (draft ou publicado).
 */
export async function createCase(authorId, caseData) {
  const {
    title,
    specialty,
    tags = [],
    difficulty,
    visibility,
    steps,
    diagnosis,
    conduct,
    explanation,
    diagnosisKeywords,
    optionSet
  } = caseData;

  // Busca publicName do autor
  const authorDoc = await getDoc(doc(db, "users", authorId));
  const authorPublicName = authorDoc.exists() ? authorDoc.data().publicName : "?";

  const caseDoc = {
    authorId,
    authorPublicName,
    title,
    specialty,
    tags,
    difficulty,
    visibility,
    status: "draft",
    currentVersion: 0,
    stepCount: steps.length,
    diagnosisKeywords: diagnosisKeywords || [],
    optionSet: optionSet || [],
    aggregate: {
      ratingAvg: 0,
      ratingCount: 0,
      attemptCount: 0,
      solvedCount: 0
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: null
  };

  const caseRef = await addDoc(collection(db, "cases"), caseDoc);

  // Se for para publicar, cria a versão
  if (caseData.publish) {
    await publishCaseVersion(caseRef.id, {
      steps,
      diagnosis,
      conduct,
      explanation
    });

    await updateDoc(caseRef, {
      status: "published",
      currentVersion: 1,
      publishedAt: serverTimestamp()
    });
  }

  return caseRef.id;
}

/**
 * Publica uma versão do caso.
 */
async function publishCaseVersion(caseId, versionData) {
  const { steps, diagnosis, conduct, explanation } = versionData;

  const caseDoc = await getDoc(doc(db, "cases", caseId));
  const currentVersion = caseDoc.data().currentVersion || 0;
  const newVersion = currentVersion + 1;

  await setDoc(doc(db, "cases", caseId, "versions", String(newVersion)), {
    steps,
    diagnosis,
    conduct,
    explanation,
    publishedAt: serverTimestamp(),
    supersededAt: null
  });

  return newVersion;
}

/**
 * Atualiza um caso existente.
 */
export async function updateCase(caseId, updates, isStructural = false) {
  const caseRef = doc(db, "cases", caseId);
  const caseDoc = await getDoc(caseRef);

  if (!caseDoc.exists()) {
    throw new Error("Caso não encontrado");
  }

  const currentData = caseDoc.data();

  // Atualização estrutural: nova versão
  if (isStructural && currentData.status === "published") {
    const { steps, diagnosis, conduct, explanation } = updates;

    // Marca versão antiga como superseded
    const currentVersion = currentData.currentVersion;
    if (currentVersion > 0) {
      await updateDoc(
        doc(db, "cases", caseId, "versions", String(currentVersion)),
        { supersededAt: serverTimestamp() }
      );
    }

    // Cria nova versão
    const newVersion = await publishCaseVersion(caseId, {
      steps,
      diagnosis,
      conduct,
      explanation
    });

    await updateDoc(caseRef, {
      currentVersion: newVersion,
      stepCount: steps.length,
      diagnosisKeywords: updates.diagnosisKeywords || currentData.diagnosisKeywords,
      optionSet: updates.optionSet || currentData.optionSet,
      updatedAt: serverTimestamp()
    });
  } else {
    // Atualização leve: apenas metadata
    const allowedUpdates = {
      title: updates.title,
      specialty: updates.specialty,
      tags: updates.tags,
      difficulty: updates.difficulty,
      visibility: updates.visibility,
      updatedAt: serverTimestamp()
    };

    await updateDoc(caseRef, allowedUpdates);
  }
}

/**
 * Busca um caso.
 */
export async function getCase(caseId) {
  const snap = await getDoc(doc(db, "cases", caseId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Busca uma versão específica do caso.
 */
export async function getCaseVersion(caseId, version) {
  const snap = await getDoc(doc(db, "cases", caseId, "versions", String(version)));
  return snap.exists() ? snap.data() : null;
}

/**
 * Lista casos do autor.
 */
export async function listMyCases(authorId, limitCount = 20, cursor = null) {
  const constraints = [
    where("authorId", "==", authorId),
    orderBy("createdAt", "desc")
  ];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(limitCount + 1));

  const q = query(
    collection(db, "cases"),
    ...constraints
  );

  const snap = await getDocs(q);
  const hasMore = snap.docs.length > limitCount;
  const pageDocs = hasMore ? snap.docs.slice(0, limitCount) : snap.docs;
  return {
    cases: pageDocs.map(caseDoc => ({ id: caseDoc.id, ...caseDoc.data() })),
    lastDoc: pageDocs.at(-1) || null,
    hasMore
  };
}

/**
 * Publica um caso draft.
 */
export async function publishCase(caseId, versionData) {
  const caseRef = doc(db, "cases", caseId);
  const caseDoc = await getDoc(caseRef);

  if (!caseDoc.exists()) {
    throw new Error("Caso não encontrado");
  }

  if (caseDoc.data().status === "published") {
    throw new Error("Caso já está publicado");
  }

  await publishCaseVersion(caseId, versionData);

  await updateDoc(caseRef, {
    status: "published",
    currentVersion: 1,
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Atualiza estatística do autor
  const authorId = caseDoc.data().authorId;
  const userRef = doc(db, "users", authorId);
  const publicProfileRef = doc(db, "publicProfiles", authorId);

  const batch = writeBatch(db);

  batch.update(userRef, {
    "stats.casesCreated": (await getDoc(userRef)).data().stats.casesCreated + 1,
    updatedAt: serverTimestamp()
  });

  const publicProfile = await getDoc(publicProfileRef);
  if (publicProfile.exists()) {
    batch.update(publicProfileRef, {
      "statsPublic.casesCreated": publicProfile.data().statsPublic.casesCreated + 1,
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();
}

/**
 * Salva como rascunho.
 */
export async function saveDraft(caseId, updates) {
  await updateDoc(doc(db, "cases", caseId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}
