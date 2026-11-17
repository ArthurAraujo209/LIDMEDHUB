export const CLINICAL_FIELD_OPTIONS = [
  { key: "queixa", label: "Queixa principal" },
  { key: "hda", label: "História da Doença Atual (HDA)" },
  { key: "alergias", label: "Alergias" },
  { key: "antecedentes-familiares", label: "Antecedentes familiares" },
  { key: "antecedentes-patologicos-pessoais", label: "Antecedentes patológicos e pessoais" },
  { key: "antecedentes-fisiologicos", label: "Antecedentes pessoais fisiológicos" },
  { key: "condicoes-habitos-vida", label: "Condições e hábitos de vida" },
  { key: "comorbidades", label: "Comorbidades" },
  { key: "antecedentes", label: "Antecedentes" },
  { key: "medicamentos", label: "Uso de medicamentos" },
  { key: "exame-fisico", label: "Exame físico" },
  { key: "sinais-vitais", label: "Sinais vitais" },
  { key: "exames-lab", label: "Exames laboratoriais" },
  { key: "exames-imagem", label: "Exames de imagem" },
  { key: "outros-exames", label: "Outros exames complementares" },
  { key: "outras-informacoes", label: "Outras informações relevantes" },
  { key: "condutas-realizadas", label: "Condutas realizadas" },
  { key: "evolucao", label: "Evolução" }
];

const CLINICAL_FIELD_LABELS = Object.fromEntries(
  CLINICAL_FIELD_OPTIONS.map(({ key, label }) => [key, label])
);

export function getClinicalFieldLabel(key) {
  return CLINICAL_FIELD_LABELS[key] || key;
}
