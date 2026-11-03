// Detecta dados sensíveis que podem identificar pacientes.
// Retorna array de avisos encontrados.

const PATTERNS = {
  cpf: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  phone: /\(?\d{2}\)?\s?\d{4,5}-?\d{4}\b/g,
  email: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
  prontuario: /\b(prontu[aá]rio|registro)\s*(n[°º]?|número)?\s*:?\s*[\d\-\/]+\b/gi,
  iniciais: /\(([A-Z]\.?){2,}\)/g,
  dataNascimento: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g
};

const WARNINGS = {
  cpf: "Possível CPF detectado",
  phone: "Possível telefone detectado",
  email: "E-mail detectado",
  prontuario: "Referência a prontuário/registro detectado",
  iniciais: "Iniciais entre parênteses detectadas",
  dataNascimento: "Data completa detectada (pode ser data de nascimento)"
};

export function detectSensitive(text) {
  if (!text || typeof text !== "string") return [];

  const warnings = [];

  for (const [key, pattern] of Object.entries(PATTERNS)) {
    if (pattern.test(text)) {
      warnings.push({
        type: key,
        message: WARNINGS[key]
      });
    }
  }

  return warnings;
}

// Retorna true se encontrou algum dado sensível
export function hasSensitiveData(text) {
  return detectSensitive(text).length > 0;
}

// Formata avisos para exibição
export function formatWarnings(warnings) {
  if (warnings.length === 0) return "";

  return warnings.map(w => `⚠ ${w.message}`).join("\n");
}
