# LIDMED HUB

Plataforma acadêmica de casos clínicos progressivos para estudantes e professores de Medicina.

## Stack

- **Frontend:** HTML5 + CSS3 + JavaScript (ES Modules, vanilla)
- **Backend:** Firebase Authentication + Firestore — plano **Spark**
- **Deploy do site:** Vercel (estático)
- **Deploy de Rules/Indexes:** Firebase CLI

> **Firebase Storage não é usado no MVP** — indisponível no plano Spark para projetos novos.
> Anexos de arquivo (imagens, PDFs) ficam para quando o projeto migrar para Blaze.

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

## Primeiro admin

Sem painel administrativo (Fase 8), o primeiro admin é criado manualmente:
1. Cadastre-se em `/cadastro.html`.
2. No Firestore Console, em `users/{seu-uid}`:
   - `role: "admin"`
   - `status: "approved"`

## Roadmap

- [x] **Fase 0** — Fundação
- [x] **Fase 1** — Autenticação, cadastro e perfil pendente
- [ ] **Fase 2** — Perfil, nome público e papéis
- [ ] **Fase 3** — Criação e edição de casos
- [ ] **Fase 4** — Casoteca (listagem, filtros, busca)
- [ ] **Fase 5** — Resolução progressiva
- [ ] **Fase 6** — Pontuação e histórico
- [ ] **Fase 7** — Avaliações e favoritos
- [ ] **Fase 8** — Painel administrativo
- [ ] **Fase 9** — PWA, offline, acessibilidade
- [ ] **Fase 10** — Refinamento e produção