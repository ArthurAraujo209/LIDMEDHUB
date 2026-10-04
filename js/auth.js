import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "./firebase.js";

import { publicName } from "./utils/publicName.js";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/* ----- Mensagens de erro amigáveis ----- */

const AUTH_ERRORS = {
  "auth/email-already-in-use": "Este e-mail já está cadastrado.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/weak-password": "A senha é muito fraca. Use no mínimo 6 caracteres.",
  "auth/user-not-found": "E-mail ou senha inválidos.",
  "auth/wrong-password": "E-mail ou senha inválidos.",
  "auth/invalid-credential": "E-mail ou senha inválidos.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "auth/network-request-failed": "Falha de rede. Verifique sua conexão.",
  "auth/popup-closed-by-user": "Login com Google cancelado.",
  "auth/popup-blocked": "Popup bloqueado pelo navegador. Permita popups para este site.",
  "auth/account-exists-with-different-credential":
    "Já existe uma conta com este e-mail usando outro método de login.",
  "auth/unauthorized-domain":
    "Domínio não autorizado no Firebase. Contate o administrador.",
  "auth/operation-not-allowed":
    "Método de login desativado no Firebase. Contate o administrador."
};

export function getAuthErrorMessage(code) {
  return AUTH_ERRORS[code] || "Ocorreu um erro. Tente novamente.";
}

/* ----- Leitura / criação de perfil ----- */

export async function getUserDoc(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

function buildUserDoc(user, { role = "student", name } = {}) {
  const fallbackName = (user.email || "").split("@")[0] || "Usuário";
  const displayName = String(name || user.displayName || fallbackName)
    .trim()
    .replace(/\s+/g, " ");

  const pub = publicName(displayName) || "?";
  const safeRole = role === "professor" ? "professor" : "student";

  return {
    uid: user.uid,
    email: user.email || "",
    displayName,
    publicName: pub,
    photoURL: user.photoURL || "",
    role: safeRole,
    status: "pending"
  };
}

export async function createUserDoc(user, opts = {}) {
  const base = buildUserDoc(user, opts);
  const payload = { ...base, createdAt: serverTimestamp() };
  await setDoc(doc(db, "users", user.uid), payload);
  return { ...base, createdAt: new Date() };
}

export async function ensureUserDoc(user, opts = {}) {
  const existing = await getUserDoc(user.uid);
  if (existing) return existing;
  return createUserDoc(user, opts);
}

/* ----- Ações de autenticação ----- */

export async function signupEmail({ name, email, password, role }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  // Atualiza displayName no perfil do Auth (best-effort).
  try {
    await updateProfile(user, { displayName: name });
  } catch (_) {
    /* não bloqueia o cadastro */
  }

  // Cria o documento do usuário. Se falhar, tenta limpar a conta recém-criada.
  try {
    await createUserDoc(user, { name, role });
  } catch (err) {
    try { await user.delete(); } catch (_) {}
    throw err;
  }

  return user;
}

export async function loginEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  // Se for o primeiro login via Google, cria o doc com role default 'student'.
  await ensureUserDoc(cred.user);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export async function resetPassword(email) {
  if (!email) throw new Error("missing-email");
  await sendPasswordResetEmail(auth, email);
}