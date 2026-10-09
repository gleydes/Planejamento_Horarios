# 🚀 Guia de Deploy no GitHub Pages

## Passo a Passo Completo

### 1️⃣ Criar o Repositório no GitHub

1. Acesse [github.com](https://github.com)
2. Clique no botão **"+"** → **"New repository"**
3. Preencha:
   - **Repository name**: `meu-planner` (ou o nome que preferir)
   - **Description**: "Meu planner pessoal"
   - **Public** ✅
   - **NÃO** marque "Add a README file" (já temos um)
4. Clique **"Create repository"**

### 2️⃣ Conectar seu Projeto ao GitHub

Abra o terminal na pasta do projeto e execute:

```bash
# Inicializa o Git
git init

# Adiciona todos os arquivos
git add .

# Primeiro commit
git commit -m "🎉 Initial commit - Meu Planner"

# Renomeia a branch para main
git branch -M main

# Conecta ao repositório remoto (SUBSTITUA SEU_USUARIO e SEU_REPOSITORIO)
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git

# Envia para o GitHub
git push -u origin main
```

### 3️⃣ Configurar o Base Path

**IMPORTANTE**: Para funcionar no GitHub Pages, você precisa configurar o `base` no `vite.config.js`.

Abra o arquivo `vite.config.js` e adicione a linha `base`:

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/SEU_REPOSITORIO/',  // ← ADICIONE ESTA LINHA com o nome do seu repo
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

**Exemplo**: Se seu repositório se chama `meu-planner`, use:
```javascript
base: '/meu-planner/',
```

### 4️⃣ Fazer o Build

```bash
npm run build
```

Isso vai criar a pasta `dist/` com os arquivos otimizados.

### 5️⃣ Publicar no GitHub Pages

#### Opção A: GitHub Actions (Automático) ✅ RECOMENDADO

1. No GitHub, vá em **Settings** → **Pages**
2. Em **Source**, selecione **GitHub Actions**
3. O workflow já está configurado em `.github/workflows/deploy.yml`
4. Faça push das mudanças:
   ```bash
   git add .
   git commit -m "🚀 Configure GitHub Pages deployment"
   git push
   ```
5. Aguarde alguns minutos. O deploy será automático!

#### Opção B: Deploy Manual

1. Instale a ferramenta `gh-pages`:
   ```bash
   npm install -D gh-pages
   ```

2. Adicione este script no `package.json`:
   ```json
   {
     "scripts": {
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. Execute:
   ```bash
   npm run build
   npm run deploy
   ```

### 6️⃣ Acessar seu Site

Após o deploy, seu site estará disponível em:

```
https://SEU_USUARIO.github.io/SEU_REPOSITORIO/
```

**Exemplo**:
```
https://joao.github.io/meu-planner/
```

## 🔧 Troubleshooting

### ❌ Página em Branco

**Problema**: Assets não carregam

**Solução**:
- Verifique se o `base` está configurado corretamente no `vite.config.js`
- Deve ser `'/NOME_DO_REPOSITORIO/'` (com barras no início e fim)
- Faça um novo build: `npm run build`
- Faça push novamente

### ❌ Erro 404

**Problema**: Página não encontrada

**Solução**:
- Verifique se o GitHub Pages está habilitado
- Aguarde alguns minutos (pode levar até 10 minutos)
- Verifique se a branch está correta (geralmente `main` ou `gh-pages`)

### ❌ CSS/JS não carregam

**Problema**: Caminhos dos assets incorretos

**Solução**:
- Confirme que o `base` no `vite.config.js` está correto
- Verifique no console do navegador se há erros 404
- Faça um novo build e deploy

## 📋 Checklist

- [ ] Repositório criado no GitHub
- [ ] Git inicializado (`git init`)
- [ ] Arquivos adicionados (`git add .`)
- [ ] Commit feito (`git commit -m "..."`)
- [ ] Remote configurado (`git remote add origin ...`)
- [ ] Push feito (`git push -u origin main`)
- [ ] `base` configurado no `vite.config.js`
- [ ] Build feito (`npm run build`)
- [ ] GitHub Pages habilitado
- [ ] Site acessível na URL correta

## 🎯 Comandos Úteis

```bash
# Ver status do Git
git status

# Ver histórico de commits
git log --oneline

# Ver remote configurado
git remote -v

# Fazer pull das últimas mudanças
git pull

# Fazer push forçado (cuidado!)
git push -f origin main
```

## 💡 Dicas

1. **Mantenha o `vite.config.js` atualizado** sempre que mudar o nome do repositório
2. **Faça commits frequentes** para manter um histórico claro
3. **Use branches** para testar novas funcionalidades
4. **Verifique o console** do navegador se algo não funcionar
5. **Aguarde alguns minutos** após o deploy (pode demorar para propagar)

## 🔗 Links Úteis

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**Precisa de ajuda?** Abra uma issue no repositório! 🐛
