# LIDMED HUB

Plataforma acadêmica de casos clínicos progressivos para estudantes e professores de Medicina.

## Stack

- **Frontend:** HTML5 + CSS3 + JavaScript (ES Modules, vanilla)
- **Backend:** Firebase Authentication + Firestore — plano **Spark**
- **Deploy do site:** Vercel (estático)
- **Deploy de Rules/Indexes:** Firebase CLI

> Imagens clínicas são enviadas a um endpoint Vercel autenticado e hospedadas no ImgBB; não são armazenadas no Firebase Storage. Nunca envie imagens identificáveis de pacientes. O ImgBB é um serviço externo, e imagens hospedadas podem ficar publicamente acessíveis.

## Estrutura

```
/
├── index.html, login.html, cadastro.html, ...
├── admin/                  → páginas administrativas
├── css/
│   ├── tokens.css          → design system (variáveis)
│   ├── reset.css           → normalização
│   ├── global.css          → componentes base
│   └── pages/              → estilos por página
├── js/
│   ├── config.js           → firebaseConfig (editar!)
│   ├── firebase.js         → inicialização + reexports
│   ├── auth.js, guards.js, ...
│   ├── ui/                 → componentes de UI
│   └── utils/              → funções puras
├── assets/                 → ícones, logo, ilustrações
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
└── vercel.json
```

## Setup local

1. Clone o repositório.
2. Rode um servidor estático na raiz:
   ```bash
   npx serve .
   ```
3. Acesse `http://localhost:3000`.

## Configurar Firebase

1. Crie o projeto no [Firebase Console](https://console.firebase.google.com).
2. Habilite **Authentication** (E-mail/senha + Google).
3. Crie **Firestore** em `southamerica-east1`.
4. Registre um app **Web** e copie o `firebaseConfig` para `/js/config.js`.
5. Adicione o domínio da Vercel em Authentication → Domínios autorizados.

## Deploy de Rules/Indexes

```bash
firebase login
firebase use --add                       # seleciona o projeto
firebase deploy --only firestore:rules,firestore:indexes
```

## Deploy do site (Vercel)

- Framework preset: **Other**.
- Build command: *(vazio)*.
- Output directory: `.` (raiz).
- Configure `IMGBB_API_KEY` nas variáveis de ambiente do projeto Vercel. A chave é usada apenas pela função `/api/upload-image` e não deve ser colocada no frontend ou no repositório.
- Após configurar a variável, faça um novo deploy para ativar a função de upload.
- O arquivo `api/upload-image.js` precisa estar incluído no deploy. Se o upload responder HTTP 404 ou 405, confirme que o projeto foi publicado na Vercel com a raiz do repositório como diretório do projeto e que a pasta `api/` foi enviada. Hospedagem somente estática não executa essa função. Configure a chave também no ambiente Production/Preview usado pelo deploy e publique novamente.
- Para testar localmente, copie `.env.local.example` para `.env.local`, substitua o valor de `IMGBB_API_KEY` pela sua chave e rode `npx vercel dev` na raiz. A chave local não deve ser compartilhada nem adicionada ao Git; `.env.local` já está no `.gitignore`. O servidor HTTP estático não executa a função `/api/upload-image`.
- O upload exige uma conta aprovada. Imagens clínicas exigem confirmação de anonimização. JPEG, PNG e WebP de até 3 MB abrem o editor de recorte/zoom e são reprocessadas no navegador para remover metadados. Fotos de perfil também podem ser recortadas antes do envio. O ImgBB é externo e as imagens hospedadas ficam publicamente acessíveis. Nunca envie imagens identificáveis de pacientes.

## Primeiro admin

Sem painel administrativo (Fase 8), o primeiro admin é criado manualmente:
1. Cadastre-se em `/cadastro.html`.
2. No Firestore Console, em `users/{seu-uid}`:
   - `role: "admin"`
   - `status: "approved"`

## Roadmap

- [x] **Fase 0** — Fundação
- [x] **Fase 1** — Autenticação, cadastro e perfil pendente
- [x] **Fase 2** — Perfil, nome público e papéis
- [x] **Fase 3** — Criação e edição de casos
- [x] **Fase 4** — Casoteca (listagem, filtros, busca)
- [x] **Fase 5** — Resolução progressiva
- [x] **Fase 6** — Pontuação e histórico
- [x] **Fase 7** — Avaliações e favoritos
- [x] **Fase 8** — Painel administrativo
- [x] **Fase 9** — PWA, offline e acessibilidade
- [x] **Fase 10** — Refinamento e produção

**Status:** ✅ MVP COMPLETO E FUNCIONAL

## Deploy e Uso

Consulte [IMPLEMENTACAO-COMPLETA.md](IMPLEMENTACAO-COMPLETA.md) para:
- Instruções de deploy
- Checklist de testes completo
- Fluxo de uso ponta a ponta
- Documentação de todas as funcionalidades

## Estrutura de Arquivos

```
/
├── index.html, login.html, cadastro.html
├── dashboard.html, aguardando-aprovacao.html
├── meu-perfil.html, perfil.html
├── criar-caso.html, editar-caso.html
├── casoteca.html, meus-casos.html, caso.html
├── historico.html, favoritos.html
├── offline.html, 404.html
├── manifest.webmanifest, sw.js
├── admin/
│   ├── index.html, usuarios.html
│   ├── casos.html, categorias.html
├── css/
│   ├── tokens.css, reset.css, global.css
│   └── pages/ (auth, dashboard, profile, admin, cases, casoteca, caso)
├── js/
│   ├── config.js, firebase.js, auth.js, guards.js
│   ├── profile.js, admin.js, cases.js, catalog.js
│   ├── attempts.js, scoring.js, ratings.js, favorites.js
│   ├── seed-categories.js, pwa.js
│   ├── ui/ (toast.js)
│   ├── utils/ (publicName.js, detectSensitive.js)
│   └── pages/ (criar-caso.js, editar-caso.js, casoteca.js, meus-casos.js, caso.js)
├── assets/
│   └── icons/
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
└── vercel.json
```