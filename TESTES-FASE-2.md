# Guia de Testes - Fase 2

## 🧪 Como Testar a Fase 2

### Pré-requisitos
1. Firebase configurado e rules deployadas
2. Servidor local rodando: `npx serve .`
3. Pelo menos 2 usuários cadastrados (1 admin, 1 aluno)

---

## Teste 1: Edição de Perfil Próprio

**Arquivo:** meu-perfil.html

1. **Login como usuário aprovado**
2. **Acesse** `/meu-perfil.html`
3. **Edite o nome:**
   - Altere "Arthur Lima" para "Arthur Lima Araújo"
   - Clique em "Salvar alterações"
   - ✅ Verifique que o publicName mudou para "A.L.A."
4. **Adicione foto:**
   - Cole uma URL de imagem externa (ex: https://i.pravatar.cc/150)
   - Salve
   - ✅ Avatar deve mostrar a imagem
5. **Mude o tema:**
   - Selecione "Escuro"
   - ✅ Toast de confirmação deve aparecer
6. **Verifique no Firestore Console:**
   ```
   users/{uid}:
     displayName: "Arthur Lima Araújo"
     publicName: "A.L.A."
     photoURL: "https://..."
     preferences: { theme: "dark" }
     updatedAt: <timestamp>
   
   publicProfiles/{uid}:
     publicName: "A.L.A."
     photoURL: "https://..."
     updatedAt: <timestamp>
   ```

---

## Teste 2: Perfil Público

**Arquivo:** perfil.html

1. **Copie o UID de outro usuário** do Firestore Console
2. **Acesse** `/perfil.html?uid={UID_COPIADO}`
3. **Verifique:**
   - ✅ Mostra apenas publicName (não displayName completo)
   - ✅ Mostra role (badge)
   - ✅ Mostra estatísticas públicas (casos criados/resolvidos)
   - ✅ NÃO mostra e-mail
   - ✅ NÃO mostra privateAreas
4. **Teste UID inexistente:**
   - Acesse `/perfil.html?uid=abc123invalido`
   - ✅ Deve mostrar "Perfil não encontrado"

---

## Teste 3: Painel Administrativo

**Arquivo:** admin/usuarios.html

### 3.1 Acesso
1. **Login como usuário NÃO-ADMIN**
2. **Tente acessar** `/admin/usuarios.html`
3. ✅ Deve redirecionar para `/dashboard.html`

4. **Login como ADMIN**
5. **Acesse** `/admin/usuarios.html`
6. ✅ Página carrega com lista de usuários

### 3.2 Filtros
1. **Selecione "Pendente"** no filtro de status
2. ✅ Mostra apenas usuários com status pending
3. **Selecione "Estudante"** no filtro de perfil
4. ✅ Mostra apenas usuários com role student
5. **Limpe filtros** (selecione "Todos")
6. ✅ Mostra todos os usuários

### 3.3 Aprovar Usuário
1. **Localize um usuário com status "Pendente"**
2. **Clique em "Aprovar"**
3. **Confirme** no alert
4. ✅ Status muda para "Aprovado"
5. ✅ Toast de sucesso aparece
6. **Verifique no Firestore Console:**
   ```
   users/{uid}:
     status: "approved"
     approvedAt: <timestamp>
     approvedBy: "{admin_uid}"
   
   auditLog/{logId}:
     actorId: "{admin_uid}"
     action: "user_status_change"
     targetType: "user"
     targetId: "{user_uid}"
     metadata: { newStatus: "approved" }
     timestamp: <timestamp>
   ```

### 3.4 Rejeitar Usuário
1. **Localize um usuário pendente**
2. **Clique em "Rejeitar"**
3. **Digite um motivo** (opcional) no prompt
4. ✅ Status muda para "Rejeitado"
5. **Verifique auditLog** no Console

### 3.5 Suspender Usuário
1. **Localize um usuário aprovado**
2. **Clique em "Suspender"**
3. **Digite um motivo** (obrigatório)
4. ✅ Status muda para "Suspenso"
5. **Tente fazer login com esse usuário:**
   - ✅ Deve redirecionar para `/login.html?suspended=1`
   - ✅ Mensagem de conta suspensa aparece

---

## Teste 4: Segurança (DevTools)

### 4.1 Tentar Alterar Próprio Role
1. **Login como estudante**
2. **Abra DevTools → Console**
3. **Execute:**
   ```javascript
   import { db, doc, updateDoc } from '/js/firebase.js';
   const uid = firebase.auth().currentUser.uid;
   await updateDoc(doc(db, 'users', uid), { role: 'admin' });
   ```
4. ✅ Deve dar erro: `Missing or insufficient permissions`

### 4.2 Tentar Alterar Próprio Status
1. **Execute:**
   ```javascript
   await updateDoc(doc(db, 'users', uid), { status: 'approved' });
   ```
2. ✅ Deve dar erro: `Missing or insufficient permissions`

### 4.3 Tentar Ler Outro Usuário
1. **Execute:**
   ```javascript
   import { db, doc, getDoc } from '/js/firebase.js';
   const snap = await getDoc(doc(db, 'users', 'outro_uid_aqui'));
   console.log(snap.data());
   ```
2. ✅ Deve dar erro ou retornar undefined

---

## Teste 5: Fluxo Completo

### Cenário: Novo usuário cadastra e é aprovado

1. **Abra aba anônima**
2. **Cadastre novo usuário:**
   - Nome: "Maria Silva"
   - E-mail: maria@teste.com
   - Senha: 123456
   - Perfil: Estudante
3. ✅ Redireciona para `/aguardando-aprovacao.html`
4. ✅ Mostra status "Pendente"

5. **Em outra aba, login como admin**
6. **Acesse** `/admin/usuarios.html`
7. **Localize "Maria Silva"** na lista
8. **Aprove o usuário**

9. **Volte para a aba de Maria**
10. **Clique em "Verificar status"** ou aguarde 30s
11. ✅ Status muda para "Aprovado"
12. ✅ Redireciona para `/dashboard.html`

13. **Como Maria, acesse** `/meu-perfil.html`
14. ✅ Mostra "M.S." como publicName
15. **Edite o nome** para "Maria Clara Silva"
16. ✅ publicName muda para "M.C.S."

17. **Como admin, acesse** `/perfil.html?uid={maria_uid}`
18. ✅ Mostra "M.C.S." (não o nome completo)

---

## ✅ Checklist Final

- [ ] Perfil próprio: edição funciona
- [ ] Perfil próprio: sincroniza com publicProfiles
- [ ] Perfil público: mostra apenas dados públicos
- [ ] Perfil público: não expõe dados sensíveis
- [ ] Admin: lista usuários corretamente
- [ ] Admin: filtros funcionam
- [ ] Admin: aprovar usuário funciona
- [ ] Admin: rejeitar usuário funciona
- [ ] Admin: suspender usuário funciona
- [ ] Admin: auditLog registra ações
- [ ] Segurança: usuário não pode alterar próprio role
- [ ] Segurança: usuário não pode alterar próprio status
- [ ] Segurança: não-admin não acessa /admin
- [ ] Dashboard: botão admin só aparece para admin

---

## 🐛 Problemas Conhecidos

Nenhum conhecido até o momento.

## 📞 Suporte

Se encontrar bugs, documente:
1. Passos para reproduzir
2. Comportamento esperado vs obtido
3. Console do navegador (erros)
4. Firestore Console (estado dos dados)
