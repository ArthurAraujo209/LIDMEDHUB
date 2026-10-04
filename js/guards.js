import { auth, onAuthStateChanged } from "./firebase.js";
import { getUserDoc } from "./auth.js";

/* Cache leve de perfis em memória para evitar múltiplos reads no mesmo carregamento. */
const _profileCache = new Map();

export function clearProfileCache(uid) {
  if (uid) _profileCache.delete(uid);
  else _profileCache.clear();
}

export function waitForAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

export async function loadProfile(user, { force = false } = {}) {
  if (!user) return null;
  if (!force && _profileCache.has(user.uid)) return _profileCache.get(user.uid);
  const profile = await getUserDoc(user.uid);
  if (profile) _profileCache.set(user.uid, profile);
  return profile;
}

export function currentUser() {
  return auth.currentUser;
}

function navigate(path) {
  const target = path;
  if (location.pathname + location.search !== target) {
    location.replace(target);
  }
}

/**
 * Exige usuário autenticado. Retorna { user, profile } ou null (e redireciona).
 * Por padrão não força refetch do perfil, a menos que { force: true }.
 */
export async function requireAuth({ redirect = "/login.html", force = false } = {}) {
  const user = await waitForAuth();
  if (!user) {
    navigate(redirect);
    return null;
  }
  const profile = await loadProfile(user, { force });
  return { user, profile };
}

/**
 * Exige usuário autenticado E aprovado. Redireciona conforme o status.
 * Retorna { user, profile } apenas se approved.
 */
export async function requireApproved({ redirect = "/login.html" } = {}) {
  const user = await waitForAuth();
  if (!user) {
    navigate(redirect);
    return null;
  }
  const profile = await loadProfile(user, { force: true });

  if (!profile) {
    navigate("/aguardando-aprovacao.html");
    return null;
  }

  switch (profile.status) {
    case "approved":
      return { user, profile };
    case "pending":
      navigate("/aguardando-aprovacao.html");
      return null;
    case "rejected":
      navigate("/login.html?rejected=1");
      return null;
    case "suspended":
      navigate("/login.html?suspended=1");
      return null;
    default:
      navigate("/login.html");
      return null;
  }
}

/**
 * Se já houver usuário autenticado, redireciona.
 * Usado em /login.html e /cadastro.html.
 */
export async function redirectIfAuthed({ to = "/dashboard.html" } = {}) {
  const user = await waitForAuth();
  if (!user) return null;
  const profile = await loadProfile(user);
  if (profile?.status === "approved") {
    navigate(to);
    return { user, profile };
  }
  navigate("/aguardando-aprovacao.html");
  return { user, profile };
}