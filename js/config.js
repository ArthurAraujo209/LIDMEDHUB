// Configuração pública do Firebase.
// Substitua os valores abaixo pelos do Console do Firebase:
// Configurações do Projeto → Geral → Seus apps → Web → firebaseConfig.
//
// ATENÇÃO: estas chaves são PÚBLICAS por design. A segurança real é feita por
// Security Rules no Firestore/Storage. NUNCA coloque aqui chaves privadas,
// service accounts ou secrets.

export const firebaseConfig = {
  apiKey: "AIzaSyBHzyuhxz_u4aSawA6xxd55JJ3n1qRdma8",
  authDomain: "limedhub.firebaseapp.com",
  projectId: "limedhub",
  storageBucket: "limedhub.firebasestorage.app",
  messagingSenderId: "297626828968",
  appId: "1:297626828968:web:bd746cbceda99ba45c029d",
  measurementId: "G-SZVMR8BQYQ"
};

export const APP_NAME = "LIDMED HUB";
export const APP_LOCALE = "pt-BR";
export const APP_SHORT_NAME = "LIDMED";

// Limites e constantes de negócio (usadas nas próximas fases)
export const LIMITS = {
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024, // 10 MB
  ALLOWED_MIME: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  MAX_HINT_PENALTY: 90,               // pontuação mínima é 10
  SCORE_BASE: 100,
  SCORE_PENALTY_PER_HINT: 15
};