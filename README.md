# 📅 Meu Planner - Organize seus Horários

Um planner completo e inteligente para organizar seus horários e otimizar sua produtividade.

## 🚀 Funcionalidades

- **📊 Dashboard** - Visão geral com estatísticas e progresso
- **📅 Visualização Diária** - Timeline completa das atividades
- **📆 Visualização Semanal** - Grade semanal com todas as atividades
- **🧠 Agendamento Inteligente** - Análise automática com sugestões
- **💾 Persistência** - Dados salvos no localStorage
- **🎨 Categorias** - Trabalho, Pessoal, Saúde, Estudo, Lazer
- **⚡ Prioridades** - Alta, Média, Baixa
- **🔄 Recorrência** - Atividades recorrentes

## 🛠️ Tecnologias

- React 18
- TypeScript
- Vite
- Tailwind CSS v4
- date-fns
- Lucide React

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
