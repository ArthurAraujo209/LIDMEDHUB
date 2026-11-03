# Fase 2 — Perfil, Papéis e Aprovação de Usuários ✅

**Status:** Concluída  
**Data:** 03/11/2026

## 🎯 Objetivos Entregues

### 1. Perfil do Usuário
- ✅ **meu-perfil.html** — Página de edição de perfil próprio
  - Edição de `displayName` (com recálculo automático de `publicName`)
  - Edição de `photoURL` (URL externa)
  - Seleção de tema (auto/light/dark) em `preferences`
  - Visualização de estatísticas pessoais
  - Sincronização automática com `publicProfiles/{uid}`

- ✅ **perfil.html?uid=...** — Perfil público
  - Lê apenas de `publicProfiles/{uid}` (nunca de `users`)
  - Mostra `publicName`, `role`, `photoURL`
  - Exibe estatísticas públicas (casesCreated, casesSolved)
  - Placeholder para casos publicados (Fase 4)

### 2. Painel Administrativo
- ✅ **/admin/usuarios.html** — Gestão de usuários
  - Listagem de todos os usuários
  - Filtros por status (pending/approved/rejected/suspended)
  - Filtros por role (student/professor/admin)
  - Ações: Aprovar / Rejeitar / Suspender
  - Registro em `auditLog` de todas as ações
  - Proteção via `requireAdmin()`

### 3. Módulos JavaScript
- ✅ **js/profile.js**
  - `updateProfile()` — atualiza perfil e sincroniza com publicProfiles
  - `getPublicProfile()` — busca perfil público
  - Validações de campos (displayName 2-120 chars, photoURL max 500)

- ✅ **js/admin.js**
  - `listUsers()` — lista usuários com filtros
  - `updateUserStatus()` — altera status (approved/rejected/suspended)
  - `updateUserRole()` — altera role (student/professor/admin)
  - `getAuditLogs()` — busca logs de auditoria
  - Todas as ações registram em `auditLog`

### 4. CSS
- ✅ **css/pages/profile.css** — estilos para páginas de perfil
- ✅ **css/pages/admin.css** — estilos para painel administrativo

### 5. Firestore Rules
- ✅ Regras para `users/{uid}`:
  - Usuário pode atualizar próprio perfil (sem alterar role/status)
  - Admin pode alterar role/status/approvedAt/approvedBy
  
- ✅ Regras para `publicProfiles/{uid}`:
  - Leitura pública para usuários autenticados
  - Criação/atualização apenas pelo próprio usuário
  - Campos whitelistados: publicName, photoURL, role, statsPublic, updatedAt

- ✅ Regras para `auditLog/{logId}`:
  - Apenas admins podem ler e criar
  - Logs são imutáveis (update/delete: false)

## 🔧 Funcionalidades Implementadas

### Sincronização Automática
Ao atualizar `users/{uid}`, o sistema automaticamente:
1. Recalcula `publicName` a partir de `displayName`
2. Atualiza `publicProfiles/{uid}` com os campos públicos
3. Cria `publicProfiles/{uid}` se não existir

### Controle de Acesso
- `requireAdmin()` em guards.js protege rotas administrativas
- Admin pode gerenciar qualquer usuário (exceto a si mesmo em algumas ações)
- Usuário comum só pode editar próprio perfil

### Auditoria
Todas as ações administrativas registram em `auditLog`:
- `user_status_change` — mudança de status
- `user_role_change` — mudança de role
- Metadados: actorId, targetId, timestamp, reason (opcional)

## 📋 Checklist de Testes

### Perfil Próprio
- [ ] Editar displayName → publicName recalculado
- [ ] Editar photoURL → avatar atualizado
- [ ] Alterar tema → preferência salva
- [ ] Estatísticas exibidas corretamente
- [ ] publicProfiles sincronizado

### Perfil Público
- [ ] URL ?uid=outro → exibe perfil correto
- [ ] Apenas dados públicos visíveis
- [ ] Não mostra e-mail nem privateAreas
- [ ] Perfil inexistente → mensagem de erro

### Admin
- [ ] /admin/usuarios.html → apenas admin acessa
- [ ] Filtros funcionam corretamente
- [ ] Aprovar usuário pending → status muda
- [ ] Rejeitar usuário → status muda, reason opcional
- [ ] Suspender usuário → status muda, reason obrigatório
- [ ] auditLog registra ações
- [ ] Não pode alterar próprio status

### Segurança
- [ ] Usuário comum tenta alterar próprio role → rejeitado
- [ ] Usuário comum tenta acessar /admin → redirecionado
- [ ] Perfil público não expõe dados sensíveis
- [ ] publicProfiles só aceita campos whitelistados

## 🚀 Deploy

1. **Atualizar Firestore Rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Testar localmente:**
   ```bash
   npx serve .
   ```

3. **Verificar no Firestore Console:**
   - `publicProfiles` sendo criado no cadastro
   - `auditLog` registrando ações admin
   - Rules bloqueando acesso indevido

## 📝 Notas

- **publicProfiles** é criado automaticamente no cadastro (corrigido nos bugs)
- **Nome público** sempre via `publicName()` — nunca expor `displayName` em contextos públicos
- **Estatísticas privadas** (`privateAreas`) ficam em `users/{uid}`, nunca em `publicProfiles`
- **Theme** é salvo mas só será aplicado visualmente na Fase 9 (PWA)

## ➡️ Próxima Fase

**Fase 3** — Criação e edição de casos (sem Storage)
- criar-caso.html (wizard multi-step)
- editar-caso.html
- js/cases.js
- js/utils/detectSensitive.js
- Firestore Rules para `cases` e `cases/{id}/versions/{v}`
- Seed de categories
