import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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
    specialConditions = "",
    scenario = "",
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
    specialConditions,
    scenario,
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

  if (!caseData.publish) {
    Object.assign(caseDoc, { steps, diagnosis, conduct, explanation });
  }

  const caseRef = await addDoc(collection(db, "cases"), caseDoc);

  // Se for para publicar, cria a versão
  if (caseData.publish) {
    await publishCaseVersion(caseRef.id, {
      steps,
      specialConditions,
      scenario,
      diagnosis,
      conduct,
      explanation,
      diagnosisKeywords,
      optionSet
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
  const { steps, specialConditions = "", scenario = "", diagnosis, conduct, explanation, diagnosisKeywords, optionSet } = versionData;

  const caseDoc = await getDoc(doc(db, "cases", caseId));
  const currentVersion = caseDoc.data().currentVersion || 0;
  const newVersion = currentVersion + 1;

  await setDoc(doc(db, "cases", caseId, "versions", String(newVersion)), {
    steps,
    specialConditions,
    scenario,
    diagnosis,
    conduct,
    explanation,
    diagnosisKeywords: diagnosisKeywords || [],
    optionSet: optionSet || [],
    publishedAt: serverTimestamp(),
    supersededAt: null
  });

  return newVersion;
}

/**
 * Atualiza um caso existente.
 */
export async function updateCase(caseId, updates) {
  const caseRef = doc(db, "cases", caseId);
  const caseDoc = await getDoc(caseRef);

  if (!caseDoc.exists()) {
    throw new Error("Caso não encontrado");
  }

  const currentData = caseDoc.data();
  const caseUpdates = {
    title: updates.title,
    specialty: updates.specialty,
    specialConditions: updates.specialConditions || "",
    scenario: updates.scenario || "",
    tags: updates.tags || [],
    difficulty: updates.difficulty,
    visibility: updates.visibility,
    diagnosisKeywords: updates.diagnosisKeywords || [],
    optionSet: updates.optionSet || [],
    updatedAt: serverTimestamp()
  };

  if (currentData.status === "published") {
    const currentVersion = currentData.currentVersion;
    const newVersion = await publishCaseVersion(caseId, updates);

    if (currentVersion > 0) {
      await updateDoc(
        doc(db, "cases", caseId, "versions", String(currentVersion)),
        { supersededAt: serverTimestamp() }
      );
    }

    await updateDoc(caseRef, {
      ...caseUpdates,
      currentVersion: newVersion,
      stepCount: updates.steps.length
    });
  } else {
    await updateDoc(caseRef, {
      ...caseUpdates,
      steps: updates.steps,
      specialConditions: updates.specialConditions || "",
      scenario: updates.scenario || "",
      diagnosis: updates.diagnosis,
      conduct: updates.conduct,
      explanation: updates.explanation,
      stepCount: updates.steps.length
    });
  }
}

/**
 * Remove um caso do autor e os documentos vinculados a ele.
 */
export async function deleteCase(caseId, userId, isAdmin = false) {
  const caseRef = doc(db, "cases", caseId);
  const caseDoc = await getDoc(caseRef);

  if (!caseDoc.exists()) {
    throw new Error("Caso não encontrado");
  }
  if (caseDoc.data().authorId !== userId && !isAdmin) {
    throw new Error("Você não tem permissão para excluir este caso");
  }

  const [versions, ratings, favorites] = await Promise.all([
    getDocs(collection(db, "cases", caseId, "versions")),
    getDocs(query(collection(db, "ratings"), where("caseId", "==", caseId))),
    getDocs(query(collection(db, "favorites"), where("caseId", "==", caseId)))
  ]);

  const relatedReferences = [
    ...versions.docs,
    ...ratings.docs,
    ...favorites.docs
  ].map(document => document.ref);

  for (let index = 0; index < relatedReferences.length; index += 450) {
    const batch = writeBatch(db);
    relatedReferences.slice(index, index + 450).forEach(reference => batch.delete(reference));
    await batch.commit();
  }

  await deleteDoc(caseRef);
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
    specialConditions: versionData.specialConditions || "",
    scenario: versionData.scenario || "",
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
