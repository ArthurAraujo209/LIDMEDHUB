export async function uploadImage(blob, user, purpose) {
  if (!(blob instanceof Blob) || !["clinical", "profile"].includes(purpose)) {
    throw new Error("Imagem ou finalidade do upload inválida.");
  }

  const image = await blobToDataUrl(blob);
  const idToken = await user.getIdToken();
  const response = await fetch("/api/upload-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({
      image,
      purpose,
      confirmAnonymized: purpose === "clinical"
    })
  });

  let result;
  try {
    result = await response.json();
  } catch (error) {
    if (response.status === 404 || response.status === 405) {
      throw new Error(
        `A função de upload não está disponível neste deploy (HTTP ${response.status}). ` +
        "Publique a pasta api/ em uma plataforma que execute funções serverless, como a Vercel."
      );
    }
    throw new Error("O serviço de imagens não está disponível neste ambiente.");
  }

  if (!response.ok) throw new Error(result.error || "Não foi possível enviar a imagem.");
  if (typeof result.url !== "string") throw new Error("O serviço de imagens retornou uma resposta inválida.");
  return result.url;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Não foi possível ler a imagem processada.")));
    reader.readAsDataURL(blob);
  });
}
