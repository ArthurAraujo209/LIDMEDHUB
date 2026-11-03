import { db, doc, getDoc, updateDoc, serverTimestamp, setDoc } from "./firebase.js";
import { publicName } from "./utils/publicName.js";

/**
 * Atualiza o perfil do usuário (displayName, photoURL, preferences).
 * Sincroniza automaticamente com publicProfiles/{uid}.
 */
export async function updateProfile(uid, updates) {
  if (!uid) throw new Error("UID obrigatório");

  const allowed = {};

  // Campos permitidos para atualização pelo próprio usuário
  if ("displayName" in updates) {
    const name = String(updates.displayName || "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 120) {
      throw new Error("Nome deve ter entre 2 e 120 caracteres");
    }
    allowed.displayName = name;
    allowed.publicName = publicName(name);
  }

  if ("photoURL" in updates) {
    const url = String(updates.photoURL || "").trim();
    if (url.length > 500) {
      throw new Error("URL da foto muito longa (máx. 500 caracteres)");
    }
    allowed.photoURL = url;
  }

  if ("preferences" in updates && updates.preferences) {
    if ("theme" in updates.preferences) {
      const theme = String(updates.preferences.theme);
      if (!["auto", "light", "dark"].includes(theme)) {
        throw new Error("Preferência de tema inválida");
      }
      allowed["preferences.theme"] = theme;
    }
  }

  if (Object.keys(allowed).length === 0) {
    throw new Error("Nenhum campo válido para atualizar");
  }

  allowed.updatedAt = serverTimestamp();

  // Atualiza users/{uid}
  await updateDoc(doc(db, "users", uid), allowed);

  // Sincroniza com publicProfiles/{uid}
  const publicUpdates = {};
  if ("publicName" in allowed) publicUpdates.publicName = allowed.publicName;
  if ("photoURL" in allowed) publicUpdates.photoURL = allowed.photoURL;

  if (Object.keys(publicUpdates).length > 0) {
    publicUpdates.updatedAt = serverTimestamp();

    // Garante que o perfil público existe
    const publicRef = doc(db, "publicProfiles", uid);
    const publicSnap = await getDoc(publicRef);

    if (!publicSnap.exists()) {
      // Se não existe, busca role de users e cria
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        await setDoc(publicRef, {
          publicName: allowed.publicName || publicSnap.data()?.publicName || "?",
          photoURL: allowed.photoURL || "",
          role: userSnap.data().role || "student",
          statsPublic: { casesCreated: 0, casesSolved: 0 },
          updatedAt: serverTimestamp()
        });
      }
    } else {
      await updateDoc(publicRef, publicUpdates);
    }
  }
}

/**
 * Busca perfil público de um usuário.
 */
export async function getPublicProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "publicProfiles", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/**
 * Lista casos públicos de um autor específico.
 * (Placeholder para Fase 4 — quando cases estiver implementado)
 */
export async function getUserPublicCases(uid, limit = 10) {
  // TODO: Implementar na Fase 4
  return [];
}
