const { createVerify } = require("node:crypto");

const PROJECT_ID = "limedhub";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_BODY_BYTES = 4_300_000;
const FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let firebaseCertificates = null;
let certificateExpiry = 0;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Método não permitido.");
  }

  const origin = req.headers.origin;
  if (origin && req.headers.host) {
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch (error) {
      return sendError(res, 403, "Origem da solicitação inválida.");
    }
    if (originHost !== req.headers.host) {
      return sendError(res, 403, "Origem da solicitação não autorizada.");
    }
  }

  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer (.+)$/i);
  let authorizedUser = false;
  try {
    authorizedUser = Boolean(match && await verifyFirebaseIdToken(match[1]));
  } catch (error) {
    console.error("Não foi possível validar a conta para o envio de imagem.", error);
    return sendError(res, 503, "Não foi possível validar sua conta agora. Tente novamente.");
  }
  if (!authorizedUser) {
    return sendError(res, 401, "Faça login novamente para enviar uma imagem.");
  }

  const imgbbApiKey = process.env.IMGBB_API_KEY;
  if (!imgbbApiKey) {
    return sendError(res, 503, "O serviço de imagens ainda não foi configurado no Vercel.");
  }

  let body;
  try {
    body = await readRequestBody(req);
  } catch (error) {
    return sendError(res, error.statusCode || 400, error.message);
  }

  if (!body || !["clinical", "profile"].includes(body.purpose) || typeof body.image !== "string") {
    return sendError(res, 400, "Informe a finalidade e uma imagem válida.");
  }
  if (body.purpose === "clinical" && body.confirmAnonymized !== true) {
    return sendError(res, 400, "Confirme a anonimização antes de enviar a imagem clínica.");
  }

  const imageMatch = body.image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!imageMatch) {
    return sendError(res, 400, "Formato inválido. Use uma imagem JPEG, PNG ou WebP.");
  }

  const imageBuffer = Buffer.from(imageMatch[2], "base64");
  if (imageBuffer.length === 0 || imageBuffer.length > MAX_IMAGE_BYTES) {
    return sendError(res, 413, "A imagem deve ter até 3 MB.");
  }
  if (!hasValidImageSignature(imageMatch[1], imageBuffer)) {
    return sendError(res, 400, "O conteúdo do arquivo não corresponde a uma imagem permitida.");
  }

  try {
    const uploadBody = new URLSearchParams({ image: imageMatch[2] });
    const uploadResponse = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: uploadBody
      }
    );
    const result = await uploadResponse.json();
    const imageUrl = result?.data?.url;

    if (!uploadResponse.ok || result?.success !== true || typeof imageUrl !== "string") {
      console.error("ImgBB recusou o upload da imagem.", { status: uploadResponse.status });
      return sendError(res, 502, "O serviço externo não conseguiu hospedar a imagem.");
    }

    const parsedUrl = new URL(imageUrl);
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "i.ibb.co") {
      console.error("ImgBB retornou um endereço de imagem inesperado.");
      return sendError(res, 502, "O serviço externo retornou um endereço inválido.");
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ url: parsedUrl.href }));
  } catch (error) {
    console.error("Falha ao contatar o serviço de hospedagem de imagens.", error);
    return sendError(res, 502, "Não foi possível contatar o serviço de imagens. Tente novamente.");
  }
};

async function readRequestBody(req) {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    const error = new Error("O envio excede o limite permitido.");
    error.statusCode = 413;
    throw error;
  }

  if (req.body !== undefined) {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
      const error = new Error("O envio excede o limite permitido.");
      error.statusCode = 413;
      throw error;
    }
    try {
      return typeof req.body === "object" ? req.body : JSON.parse(rawBody);
    } catch (error) {
      throw new Error("O corpo da solicitação não contém JSON válido.");
    }
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      const error = new Error("O envio excede o limite permitido.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw new Error("O corpo da solicitação não contém JSON válido.");
  }
}

function hasValidImageSignature(type, buffer) {
  if (type === "jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === "png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "webp") return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
}

async function verifyFirebaseIdToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch (error) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    claims.aud !== PROJECT_ID ||
    claims.iss !== `https://securetoken.google.com/${PROJECT_ID}` ||
    typeof claims.sub !== "string" ||
    claims.sub.length === 0 ||
    claims.sub.length > 128 ||
    !Number.isInteger(claims.exp) ||
    claims.exp <= now ||
    !Number.isInteger(claims.iat) ||
    claims.iat > now + 60 ||
    claims.exp - claims.iat > 3600
  ) {
    return false;
  }

  const certificates = await getFirebaseCertificates();
  const certificate = certificates[header.kid];
  if (!certificate) return false;

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  try {
    if (!verifier.verify(certificate, Buffer.from(parts[2], "base64url"))) return false;
  } catch (error) {
    return false;
  }
  return isApprovedFirebaseUser(token, claims.sub);
}

async function isApprovedFirebaseUser(token, uid) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(uid)}`,
    { headers: { "Authorization": `Bearer ${token}` } }
  );
  if (response.status === 404 || response.status === 403) return false;
  if (!response.ok) throw new Error(`Não foi possível consultar o perfil (HTTP ${response.status}).`);

  const userDocument = await response.json();
  return userDocument?.fields?.status?.stringValue === "approved";
}

async function getFirebaseCertificates() {
  if (firebaseCertificates && Date.now() < certificateExpiry) return firebaseCertificates;

  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) throw new Error(`Não foi possível validar a sessão Firebase (HTTP ${response.status}).`);

  const maxAgeMatch = (response.headers.get("cache-control") || "").match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 300;
  firebaseCertificates = await response.json();
  certificateExpiry = Date.now() + maxAgeSeconds * 1000;
  return firebaseCertificates;
}

function sendError(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify({ error: message }));
}
