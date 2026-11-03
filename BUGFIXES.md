# Bugs Corrigidos - 03/11/2026

## 🔴 Bugs Críticos

### 1. Firebase Storage importado (violação de constraint)
**Arquivo:** `js/firebase.js`
**Problema:** O código importava e exportava Firebase Storage, violando a constraint explícita do projeto (Spark não oferece Storage para projetos novos).
**Correção:** Removidas todas as importações e exports de Storage.

### 2. Campos obrigatórios ausentes no cadastro
**Arquivo:** `js/auth.js` → `buildUserDoc()`
**Problema:** O documento do usuário não inicializava os campos obrigatórios definidos na especificação:
- `stats` (objeto com casesCreated, casesSolved, etc)
- `privateAreas` (objeto vazio inicialmente)
- `preferences` (objeto com theme)
- `updatedAt` (timestamp)

**Correção:** Adicionados todos os campos com valores iniciais corretos:
```javascript
stats: {
  casesCreated: 0,
  casesSolved: 0,
  totalScore: 0,
  avgScore: 0,
  lastActivityAt: null
},
privateAreas: {},
preferences: {
  theme: "auto"
}
```

### 3. Perfil público não era criado
**Arquivo:** `js/auth.js` → `createUserDoc()`
**Problema:** A coleção `publicProfiles/{uid}` não estava sendo criada no cadastro, mas é essencial para a Fase 2 (perfis públicos).
**Correção:** Implementada a criação automática de `publicProfiles/{uid}` com:
- `publicName`
- `photoURL`
- `role`
- `statsPublic: { casesCreated: 0, casesSolved: 0 }`
- `updatedAt`

### 4. Firestore Rules bloqueava TODOS os updates
**Arquivo:** `firestore.rules`
**Problema:** A regra para `users/{uid}` tinha `allow update, delete: if false`, impedindo qualquer atualização de perfil (necessário para Fases 2+).
**Correção:** Implementadas regras granulares:
- Usuário pode atualizar seu próprio perfil (sem alterar role/status/email/uid)
- Admin pode alterar role, status, approvedAt, approvedBy
- Adicionadas regras para `publicProfiles/{uid}`

### 5. Função requireAdmin() não existia
**Arquivo:** `js/guards.js`
**Problema:** A especificação menciona `requireAdmin()` para proteger páginas `/admin/*`, mas a função não estava implementada.
**Correção:** Implementada `requireAdmin()` que verifica:
- Usuário autenticado
- Status approved
- Role === 'admin'

## ⚠️ Bugs Menores

### 6. Código morto em login.html
**Arquivo:** `login.html`
**Problema:** Funções `routeAfterLogin()` e `authUid()` estavam definidas mas nunca usadas.
**Correção:** Removidas as funções não utilizadas, mantendo apenas `postLoginRedirect()`.

## ✅ Verificações Realizadas

- ✅ `publicName.js` - implementação correta
- ✅ `toast.js` - funcional
- ✅ `guards.js` - todas as funções necessárias presentes
- ✅ `dashboard.html` - sem erros
- ✅ `aguardando-aprovacao.html` - sem erros
- ✅ `cadastro.html` - sem erros

## 🧪 Testes Recomendados

Após essas correções, execute:

1. **Teste de cadastro:**
   ```
   - Cadastrar novo usuário
   - Verificar no Firestore Console se users/{uid} tem TODOS os campos
   - Verificar se publicProfiles/{uid} foi criado
   ```

2. **Teste de Rules:**
   ```
   - Tentar alterar próprio displayName via DevTools (deve permitir)
   - Tentar alterar próprio role via DevTools (deve rejeitar)
   - Admin alterar status de outro user (deve permitir)
   ```

3. **Deploy de Rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

## 📝 Notas Importantes

- O Firebase Storage foi completamente removido do código
- Todos os campos obrigatórios do schema estão sendo inicializados
- As regras agora permitem fluxos das Fases 2-10
- O campo `updatedAt` agora é criado junto com `createdAt`
