# 📅 Plan-ner - Organize sua rotina

Um planner completo e inteligente para organizar seus horários e otimizar sua produtividade.

## 🚀 Funcionalidades

- **📊 Dashboard** - Visão geral com estatísticas e progresso
- **📅 Visualização Diária** - Timeline completa das atividades
- **📆 Visualização Semanal** - Grade semanal com todas as atividades
- **🧠 Agendamento Inteligente** - Análise automática com sugestões
- **🔐 Conta Google** - Atividades e notas privadas por conta, sincronizadas pelo Firestore
- **🎨 Categorias** - Trabalho, Pessoal, Saúde, Estudo, Lazer
- **⚡ Prioridades** - Alta, Média, Baixa
- **🔄 Recorrência** - Atividades recorrentes
- **📲 Instalável** - Use o Plan-ner como aplicativo no computador ou celular
- **🛜 Interface offline** - A interface pode abrir sem conexão; consultar e sincronizar dados exige internet
- **🔔 Alarmes por atividade** - Escolha som, vibração e notificações para cada lembrete
- **📝 Bloco de notas** - Crie páginas com texto, títulos, listas, checklists e citações

## 🛠️ Tecnologias

- React 18
- TypeScript
- Vite
- Tailwind CSS v4
- date-fns
- Lucide React

## 🔐 Configurar login Google e Firestore

O login precisa de um projeto Firebase próprio. Sem essa configuração, a aplicação mostra o aviso de configuração e não permite entrar.

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) e adicione um aplicativo Web.
2. Em **Authentication → Sign-in method**, habilite **Google**.
3. Em **Authentication → Settings → Authorized domains**, adicione `localhost` para desenvolvimento e o domínio publicado do Plan-ner.
4. Crie o banco em **Firestore Database**.
5. Na página **Firestore Database → Rules**, publique o conteúdo do arquivo [`firestore.rules`](./firestore.rules). As regras limitam a leitura e gravação ao UID da conta autenticada.
6. Copie `.env.example` para `.env.local` e preencha os valores da configuração do aplicativo Web Firebase:

   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=seu-projeto
   VITE_FIREBASE_APP_ID=...
   ```

7. Reinicie o servidor ou faça um novo build após editar `.env.local`.

As chaves de configuração do Firebase para Web identificam o projeto e não são senhas. A proteção dos dados depende das regras do Firestore: mantenha as regras do [`firestore.rules`](./firestore.rules) publicadas e nunca use regras públicas de leitura ou gravação. O acesso é isolado por conta; este fluxo não oferece criptografia ponta a ponta contra administradores do projeto Firebase.

Para publicar no GitHub Pages, cadastre os quatro valores `VITE_FIREBASE_*` em **Settings → Secrets and variables → Actions → Variables** do repositório. O workflow valida essa configuração antes do build e falha com uma mensagem clara se algum valor estiver faltando.

Se o navegador ainda tiver dados antigos salvos localmente, após entrar o Plan-ner oferece a importação para a conta Google. Os dados locais só são removidos depois da confirmação de envio.

## 📦 Instalação

```bash
# Clone o repositório
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
cd SEU_REPOSITORIO

# Instale as dependências
npm install

# Rode em desenvolvimento
npm run dev
```

Acesse: `http://localhost:3000`

## 📲 Instalar como aplicativo

O Plan-ner pode ser instalado no computador, Android ou iPhone. Depois de abrir o site uma vez com internet, a interface também pode abrir sem conexão. Para entrar, ver, alterar ou sincronizar atividades e notas, é necessário estar conectado à internet.

1. Publique o site em um endereço seguro (HTTPS), como o GitHub Pages.
2. Abra o site no navegador que você usa normalmente.
3. Clique em **Instalar app** e siga as instruções. No iPhone ou iPad, abra o site no Safari, toque em **Compartilhar** e escolha **Adicionar à Tela de Início**.

A instalação não exige download de uma loja de aplicativos. Entre com a mesma conta Google em cada dispositivo para acessar os dados sincronizados.

### Bloco de notas

Abra **Notas** no menu para criar páginas e escrever. Use a barra **Adicionar bloco** para inserir títulos, listas, tarefas com checklist, citações ou divisores. Pressione **Enter** ao terminar um bloco para criar outro do mesmo tipo. As notas são salvas automaticamente na conta e podem ser encontradas pela busca.

### Alarmes e lembretes

Ao criar ou editar uma atividade, ative **Lembrete no horário da atividade** e escolha som, vibração ou ambos. O botão **Testar aviso** permite conferir o som e a vibração no próprio dispositivo. Também é possível permitir notificações do navegador para exibir um aviso na tela.

O Plan-ner verifica os horários enquanto está aberto. Navegadores e sistemas operacionais podem suspender o app em segundo plano ou encerrar seus processos; por isso, alarmes e notificações não são garantidos com o app fechado, e a vibração depende do dispositivo e das permissões do navegador.

## 🚀 Deploy no GitHub Pages

### Método 1: GitHub Actions (Automático) ✅ RECOMENDADO

1. **Crie o repositório no GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```

2. **Configure o GitHub Pages**
   - Vá em **Settings** → **Pages**
   - Em **Source**, selecione **GitHub Actions**
   - O workflow irá rodar automaticamente no próximo push

3. **Acesse seu site**
   - Após o deploy, acesse: `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/`

### Método 2: Build Manual

1. **Configure o base path no `vite.config.js`**
   
   Adicione a linha `base` no arquivo `vite.config.js`:
   ```javascript
   export default defineConfig({
     plugins: [react(), tailwindcss()],
     base: '/SEU_REPOSITORIO/', // ← ADICIONE ESTA LINHA
     server: {
       host: "0.0.0.0",
       port: 3000,
       strictPort: true,
       hmr: {
         port: 3000,
       },
     },
   });
   ```

2. **Faça o build**
   ```bash
   npm run build
   ```

3. **Deploy**
   - Opção A: Use a pasta `dist/` com GitHub Pages
   - Opção B: Use ferramentas como Vercel, Netlify, etc.

## 📝 Scripts Disponíveis

```bash
npm run dev        # Servidor de desenvolvimento
npm run build      # Build para produção
npm run preview    # Visualizar build de produção
npm run typecheck  # Verificação de tipos TypeScript
```

## 🎨 Personalização

### Cores das Categorias
Edite `src/types.ts` para personalizar as cores:

```typescript
export const CATEGORY_COLORS: Record<Category, string> = {
  trabalho: '#3b82f6',  // Azul
  pessoal: '#8b5cf6',   // Roxo
  saude: '#10b981',     // Verde
  estudo: '#f59e0b',    // Amarelo
  lazer: '#ec4899',     // Rosa
  outro: '#6b7280',     // Cinza
};
```

## 🐛 Troubleshooting

### Assets não carregam no GitHub Pages
- Verifique se o `base` está configurado corretamente no `vite.config.js`
- O valor deve ser `'/NOME_DO_REPOSITORIO/'`

### Página em branco
- Verifique o console do navegador para erros
- Certifique-se de que o build foi feito corretamente
- Verifique se o caminho base está correto

## 📄 Licença

Este projeto é de código aberto e está disponível sob a licença MIT.

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

---

Feito com ❤️ usando React + TypeScript + Tailwind CSS
