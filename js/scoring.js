// Fórmula de pontuação: score = max(10, 100 - 15 * hintsCount)

export function calculateScore(hintsCount) {
  const rawScore = 100 - 15 * hintsCount;
  return Math.max(10, rawScore);
}

export function getScoreLabel(score) {
  if (score >= 90) return "Excelente";
  if (score >= 70) return "Bom";
  if (score >= 50) return "Regular";
  return "Precisa melhorar";
}

export function getScoreColor(score) {
  if (score >= 90) return "success";
  if (score >= 70) return "primary";
  if (score >= 50) return "warning";
  return "danger";
}
