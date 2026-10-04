# LIDMED HUB

Plataforma acadêmica de casos clínicos progressivos para estudantes e professores de Medicina.

## Stack

- **Frontend:** HTML5 + CSS3 + JavaScript (ES Modules, vanilla)
- **Backend:** Firebase (Authentication, Firestore, Storage) — plano **Spark**
- **Deploy do site:** Vercel (estático)
- **Deploy de Rules/Indexes:** Firebase CLI

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
├── storage.rules
├── firestore.indexes.json
├── firebase.json           → deploy de rules (não hosting)
└── vercel.json             → headers, cleanUrls
```

## Setup local

1. Clone o repositório.
2. Rode um servidor estático na raiz. Exemplos:
   ```bash
   npx serve .
   # ou
   python3 -m http.server 3000
   ```
3. Acesse `http://localhost:3000`.

> Não abra `index.html` via `file://` — módulos ES e Firebase exigem HTTP.

## Configurar Firebase

1. Crie o projeto no [Firebase Console](https://console.firebase.google.com).
2. Habilite **Authentication** (E-mail/senha + Google).
3. Crie **Firestore** e **Storage** na região `southamerica-east1`.
4. Registre um app **Web** e copie o `firebaseConfig` para `/js/config.js`.
5. Adicione o domínio da Vercel em Authentication → Domínios autorizados.

## Deploy de Rules/Indexes

```bash
npm i -g firebase-tools
firebase login
firebase use --add                # seleciona o projeto correto
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

## Deploy do site (Vercel)

- Importe o repositório na Vercel.
- Framework preset: **Other**.
- Build command: *(vazio)*.
- Output directory: `.` (raiz).

## Roadmap

- [x] **Fase 0** — Fundação (tokens, global, landing, config)
- [ ] **Fase 1** — Autenticação e cadastro
- [ ] **Fase 2** — Perfil, nome público e papéis
- [ ] **Fase 3** — Criação e edição de casos
- [ ] **Fase 4** — Casoteca (listagem, filtros, busca)
- [ ] **Fase 5** — Resolução progressiva
- [ ] **Fase 6** — Pontuação e histórico
- [ ] **Fase 7** — Avaliações e favoritos
- [ ] **Fase 8** — Painel administrativo
- [ ] **Fase 9** — PWA, offline, acessibilidade
- [ ] **Fase 10** — Refinamento e produção