#!/usr/bin/env node

import { execSync } from "child_process";

let repoName = "";
try {
  const gitUrl = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
  const match = gitUrl.match(/\/([^/]+?)(\.git)?$/);
  if (match) repoName = match[1];
} catch {
  console.log("Não foi possível detectar o nome do repositório automaticamente.");
  repoName = process.argv[2] || "";
}

if (!repoName) {
  console.error("Uso: node build-gh-pages.js [nome-do-repositorio]");
  console.error("Ou configure o remote do Git: git remote add origin <url>");
  process.exit(1);
}

console.log(`Construindo para o repositório: ${repoName}`);
console.log(`Base path: /${repoName}/`);

const previousBasePath = process.env.VITE_BASE_PATH;
process.env.VITE_BASE_PATH = `/${repoName}/`;

try {
  console.log("Fazendo build...");
  execSync("npx vite build", { stdio: "inherit" });
  console.log("Build concluído com sucesso!");
  console.log("Os arquivos estão na pasta dist/");
  console.log(`URL: https://SEU_USUARIO.github.io/${repoName}/`);
} finally {
  if (previousBasePath === undefined) {
    delete process.env.VITE_BASE_PATH;
  } else {
    process.env.VITE_BASE_PATH = previousBasePath;
  }
}
