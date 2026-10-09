#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';

// Pega o nome do repositório da URL do Git
let repoName = '';
try {
  const gitUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
  const match = gitUrl.match(/\/([^\/]+?)(\.git)?$/);
  if (match) {
    repoName = match[1];
  }
} catch (e) {
  console.log('⚠️  Não foi possível detectar o nome do repositório automaticamente.');
  repoName = process.argv[2] || '';
}

if (!repoName) {
  console.error('❌ Uso: node build-gh-pages.js [nome-do-repositorio]');
  console.error('   Ou configure o remote do Git: git remote add origin <url>');
  process.exit(1);
}

console.log(`📦 Construindo para o repositório: ${repoName}`);
console.log(`🔧 Base path: /${repoName}/`);

// Lê o vite.config.js original
const originalConfig = readFileSync('vite.config.js', 'utf-8');

// Adiciona o base path
const modifiedConfig = originalConfig.replace(
  'export default defineConfig({',
  `export default defineConfig({\n  base: '/${repoName}/',`
);

// Salva a configuração modificada
writeFileSync('vite.config.js', modifiedConfig);

try {
  // Faz o build
  console.log('🏗️  Fazendo build...');
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('✅ Build concluído com sucesso!');
  console.log(`📁 Os arquivos estão na pasta dist/`);
  console.log(`🌐 URL: https://SEU_USUARIO.github.io/${repoName}/`);
} finally {
  // Restaura o vite.config.js original
  writeFileSync('vite.config.js', originalConfig);
  console.log('🔄 vite.config.js restaurado');
}
