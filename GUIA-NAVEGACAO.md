# Guia de Navegação - LIDMED HUB

## Como Acessar as Páginas

### Páginas Públicas (sem login)
- **Landing:** `/index.html` ou `/`
- **Login:** `/login.html`
- **Cadastro:** `/cadastro.html`

### Páginas Autenticadas (após login)
- **Dashboard:** `/dashboard.html` (página inicial após login)
  - Botões no painel lateral:
    - "Explorar Casos" → `/casoteca.html`
    - "Criar Novo Caso" → `/criar-caso.html`
    - "Meu Histórico" → `/historico.html`
    - "Meus Favoritos" → `/favoritos.html`

- **Meu Perfil:** `/meu-perfil.html` (link no header)
  - Editar nome, foto, tema
  - Ver estatísticas pessoais

### Fluxo de Casos
1. **Casoteca:** `/casoteca.html`
   - Lista todos os casos públicos
   - Filtros: especialidade, dificuldade, busca
   - Clique em um card → vai para resolução

2. **Resolver Caso:** `/caso.html?id={caseId}`
   - Carrega automaticamente ao clicar em um caso
   - Resolução progressiva com etapas
   - Dicas, hipóteses, pontuação
   - Ao finalizar: modal de conclusão

3. **Criar Caso:** `/criar-caso.html`
   - Wizard de 4 etapas
   - Salvar rascunho ou publicar

4. **Editar Caso:** `/editar-caso.html?id={caseId}`
   - Carrega automaticamente ao editar um caso próprio

### Histórico e Favoritos
- **Histórico:** `/historico.html`
  - Lista de casos que você resolveu
  - Score, dicas usadas, tempo

- **Favoritos:** `/favoritos.html`
  - Casos que você favoritou (botão ♡)

### Perfis Públicos
- **Ver Perfil de Outro Usuário:** `/perfil.html?uid={userId}`
  - Clique no nome do autor em qualquer caso
  - Mostra apenas dados públicos

### Admin (apenas se role = admin)
- **Dashboard Admin:** `/admin/index.html`
  - Link aparece no dashboard se você for admin
  - Estatísticas gerais

- **Gestão de Usuários:** `/admin/usuarios.html`
  - Aprovar/rejeitar/suspender usuários

- **Moderação de Casos:** `/admin/casos.html`
  - Moderar/remover casos

- **Categorias:** `/admin/categorias.html`
  - Adicionar/editar especialidades

### Páginas Especiais
- **Aguardando Aprovação:** `/aguardando-aprovacao.html`
  - Carrega automaticamente se status = pending

- **Offline:** `/offline.html`
  - Aparece quando sem internet (PWA)

- **404:** `/404.html`
  - Página não encontrada

---

## Navegação por Links no Header

Todas as páginas autenticadas têm no header:
- **Logo "L LIDMED HUB"** → volta para `/dashboard.html`
- **"Meu Perfil" ou nome público** → vai para `/meu-perfil.html`
- **"Sair"** → faz logout e volta para `/login.html`

Páginas específicas podem ter:
- **"Voltar"** ou **"Voltar ao painel"** → volta para página anterior

---

## Atalhos de Teclado (Navegador)

- **Ctrl + K** (em alguns navegadores) → barra de busca
- **Tab** → navegar entre campos/botões
- **Enter** → submeter formulários
- **Esc** → fechar modais

---

## Fluxo Recomendado (Primeira Vez)

1. **Faça login** em `/login.html`
2. **Dashboard** carrega automaticamente
3. Clique **"Explorar Casos"** → vai para casoteca
4. Clique em um **card de caso** → abre resolução
5. **Resolva o caso** (etapas, dicas, hipótese)
6. **Encerre** → veja sua pontuação
7. **Avalie o caso** (estrelas)
8. Volte ao **dashboard** → veja suas estatísticas atualizadas

Para criar casos:
1. Dashboard → **"Criar Novo Caso"**
2. Preencha o **wizard** (4 etapas)
3. **Publique**
4. Caso aparece na **casoteca**

---

## URLs Dinâmicas (com parâmetros)

- `/caso.html?id=abc123` - Resolver caso específico
- `/editar-caso.html?id=abc123` - Editar caso próprio
- `/perfil.html?uid=xyz789` - Ver perfil público
- `/admin/usuarios.html?status=pending` - Filtro pré-aplicado

---

## Debug / Acesso Direto

Se estiver testando e quiser pular etapas:

1. **Forçar aprovação** (se pendente):
   - Firebase Console → Firestore → users/{seu_uid}
   - Editar: `status: "approved"`
   - Recarregar página

2. **Virar admin**:
   - Firebase Console → Firestore → users/{seu_uid}
   - Editar: `role: "admin"` e `status: "approved"`
   - Recarregar dashboard → botão admin aparece

3. **Ver todos os casos** (mesmo privados):
   - Como admin, acesse `/admin/casos.html`

4. **Popular categorias rapidamente**:
   - Dashboard → F12 (DevTools) → Console
   - Copie e cole:
   ```javascript
   import { seedCategories } from '/js/seed-categories.js';
   await seedCategories();
   ```

---

## Problemas Comuns

**"Página não carrega"**
- Verifique se Firebase está configurado (`js/config.js`)
- Abra DevTools (F12) → Console para ver erros

**"Não consigo criar caso"**
- Verifique se está aprovado (status = approved)
- Verifique se categories foram populadas

**"Botão admin não aparece"**
- Verifique role = "admin" no Firestore
- Faça logout e login novamente

**"Caso não aparece na casoteca"**
- Verifique se visibility = "public" e status = "published"
- Recarregue a página

---

**Dica:** Use o dashboard como seu "hub central" - todos os links principais estão lá!
