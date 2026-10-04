// Gera o nome público abreviado a partir do nome completo.
// Regras:
//   - Cada parte vira sua inicial maiúscula seguida de ponto.
//   - Partículas comuns em português (de, da, do, das, dos, e) são ignoradas.
//   - Ex.: "Arthur Lima"          -> "A.L."
//          "Arthur Lima Araújo"   -> "A.L.A."
//          "Maria Clara Souza"    -> "M.C.S."
//          "João"                 -> "J."
//          "Ana de Souza Lima"    -> "A.S.L."

const SKIP = new Set(["de", "da", "do", "das", "dos", "e"]);

export function publicName(fullName) {
  if (fullName == null) return "";
  const raw = String(fullName).trim();
  if (!raw) return "";

  const parts = raw
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((p) => p.length > 0 && !SKIP.has(p.toLowerCase()));

  if (parts.length === 0) return "";
  return parts.map((p) => p[0].toUpperCase()).join(".") + ".";
}

// Utilitário auxiliar para exibir em telas de perfil/boas-vindas.
export function formatDisplayName(fullName) {
  if (fullName == null) return "";
  return String(fullName).trim().replace(/\s+/g, " ");
}