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
  serverTimestamp,
  writeBatch
} from "./firebase.js";
import { calculateScore } from "./scoring.js";

/**
 * Inicia uma nova tentativa de resolver um caso.
 */
export async function startAttempt(userId, caseId, caseVersion) {
  const attemptData = {
    userId,
    caseId,
    caseVersion,
    status: "in_progress",
    currentStepIndex: 0,
    hintsCount: 0,
    hintsUsed: [],
    hypotheses: [],
    score: null,
    maxScore: 100,
    startedAt: serverTimestamp(),
    completedAt: null,
    durationSeconds: null
  };

  const attemptRef = await addDoc(collection(db, "attempts"), attemptData);
  return { id: attemptRef.id, ...attemptData };
}

/**
 * Busca tentativa ativa do usuário para um caso.
 */
export async function getActiveAttempt(userId, caseId) {
  const q = query(
    collection(db, "attempts"),
    where("userId", "==", userId),
    where("caseId", "==", caseId),
    where("status", "==", "in_progress")
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Registra uma hipótese.
 */
export async function submitHypothesis(attemptId, hypothesis, stepIndex, isCorrect) {
  const attemptRef = doc(db, "attempts", attemptId);
  const attemptDoc = await getDoc(attemptRef);

  if (!attemptDoc.exists()) {
    throw new Error("Tentativa não encontrada");
  }

  const hypotheses = attemptDoc.data().hypotheses || [];
  hypotheses.push({
    text: hypothesis,
    correct: isCorrect,
    stepIndex,
    submittedAt: new Date()
  });

  await updateDoc(attemptRef, { hypotheses });

  return isCorrect;
}

/**
 * Avança para próxima etapa.
 */
export async function revealNextStep(attemptId) {
  const attemptRef = doc(db, "attempts", attemptId);
  const attemptDoc = await getDoc(attemptRef);

  if (!attemptDoc.exists()) {
    throw new Error("Tentativa não encontrada");
  }

  const currentStepIndex = attemptDoc.data().currentStepIndex;

  await updateDoc(attemptRef, {
    currentStepIndex: currentStepIndex + 1
  });

  return currentStepIndex + 1;
}

/**
 * Solicita dica.
 */
export async function useHint(attemptId, stepIndex) {
  const attemptRef = doc(db, "attempts", attemptId);
  const attemptDoc = await getDoc(attemptRef);

  if (!attemptDoc.exists()) {
    throw new Error("Tentativa não encontrada");
  }

  const hintsUsed = attemptDoc.data().hintsUsed || [];
  hintsUsed.push({
    stepIndex,
    usedAt: new Date()
  });

  await updateDoc(attemptRef, {
    hintsUsed,
    hintsCount: hintsUsed.length
  });

  return hintsUsed.length;
}

/**
 * Completa o caso.
 */
export async function completeAttempt(attemptId, userId, caseId) {
  const attemptRef = doc(db, "attempts", attemptId);
  const attemptDoc = await getDoc(attemptRef);

  if (!attemptDoc.exists()) {
    throw new Error("Tentativa não encontrada");
  }

  const attemptData = attemptDoc.data();
  const hintsCount = attemptData.hintsCount || 0;
  const score = calculateScore(hintsCount);

  const startedAt = attemptData.startedAt?.toDate() || new Date();
  const durationSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);

  await updateDoc(attemptRef, {
    status: "solved",
    score,
    completedAt: serverTimestamp(),
    durationSeconds
  });

  // Atualiza estatísticas do usuário
  const batch = writeBatch(db);

  // users/{uid}
  const userRef = doc(db, "users", userId);
  const userDoc = await getDoc(userRef);
  const userStats = userDoc.data().stats || {};

  const newCasesSolved = (userStats.casesSolved || 0) + 1;
  const newTotalScore = (userStats.totalScore || 0) + score;
  const newAvgScore = newTotalScore / newCasesSolved;

  batch.update(userRef, {
    "stats.casesSolved": newCasesSolved,
    "stats.totalScore": newTotalScore,
    "stats.avgScore": newAvgScore,
    "stats.lastActivityAt": serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // publicProfiles/{uid}
  const publicProfileRef = doc(db, "publicProfiles", userId);
  const publicProfile = await getDoc(publicProfileRef);

  if (publicProfile.exists()) {
    batch.update(publicProfileRef, {
      "statsPublic.casesSolved": newCasesSolved,
      updatedAt: serverTimestamp()
    });
  }

  // cases/{caseId}
  const caseRef = doc(db, "cases", caseId);
  const caseDoc = await getDoc(caseRef);
  const aggregate = caseDoc.data().aggregate || {};

  batch.update(caseRef, {
    "aggregate.attemptCount": (aggregate.attemptCount || 0) + 1,
    "aggregate.solvedCount": (aggregate.solvedCount || 0) + 1,
    updatedAt: serverTimestamp()
  });

  // Marca que o usuário resolveu este caso (para ratings)
  const solvedCaseRef = doc(db, "users", userId, "solvedCases", caseId);
  batch.set(solvedCaseRef, {
    caseId,
    solvedAt: serverTimestamp()
  });

  // Atualiza privateAreas (estatísticas por especialidade)
  const caseData = caseDoc.data();
  const specialty = caseData.specialty;

  if (specialty) {
    const privateAreas = userDoc.data().privateAreas || {};
    const areaStats = privateAreas[specialty] || { attempts: 0, correct: 0, hintsAvg: 0 };

    const newAttempts = areaStats.attempts + 1;
    const newCorrect = areaStats.correct + 1;
    const newHintsAvg = ((areaStats.hintsAvg * areaStats.attempts) + hintsCount) / newAttempts;

    batch.update(userRef, {
      [`privateAreas.${specialty}`]: {
        attempts: newAttempts,
        correct: newCorrect,
        hintsAvg: newHintsAvg
      }
    });
  }

  await batch.commit();

  return { score, durationSeconds };
}

/**
 * Busca histórico de tentativas do usuário.
 */
export async function getUserAttempts(userId, limitCount = 50) {
  const q = query(
    collection(db, "attempts"),
    where("userId", "==", userId),
    orderBy("completedAt", "desc")
  );

  const snap = await getDocs(q);
  return snap.docs.slice(0, limitCount).map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Retoma tentativa existente.
 */
export async function resumeAttempt(attemptId) {
  const snap = await getDoc(doc(db, "attempts", attemptId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
