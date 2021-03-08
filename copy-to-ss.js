#! /usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

async function copyToSiteServer() {
  const packageJsonFilePath = findPackageJson();
  const package = JSON.parse(await fs.readFile(packageJsonFilePath));
  const packageBaseDir = path.dirname(packageJsonFilePath);
  const packageName = package.name;
  const packageNamePieces = packageName.split('/');

  const filesToCopy = package.files ?? package.main;

  const siteServerDir = '/Users/kfleischman/projects/squarespace-v6/site-server';
  const ssNodeModules = path.resolve(siteServerDir, 'src/main/webapp/universal/node_modules');

  let targetPath = path.resolve(ssNodeModules, ...packageNamePieces);

  for (const copyPath of filesToCopy) {
    const srcPath = path.resolve(packageBaseDir, copyPath);
    const newPath = path.resolve(targetPath, copyPath);

    if (fs.existsSync(srcPath)) {
      if (fs.existsSync(srcPath) && fs.lstatSync(srcPath).isDirectory()) {
        await fs.ensureDir(newPath);
      } else {
        await fs.ensureFile(newPath);
      }
    } else {
      throw new Error(`Expected "${srcPath}" to exist, but was not found`);
    }

    await fs.copy(copyPath, newPath)
    console.log(`Copied "${copyPath}" to "${newPath}"`);
  }
  console.log('\nSuccess.');
  process.exit(1);
}

function findPackageJson() {
  const workingDir = process.cwd();
  let currentDir = workingDir;

  while (currentDir) {
    const packageFile = path.resolve(currentDir, 'package.json');
    if (fs.existsSync(packageFile)) {
      return packageFile;
    }

    if (fs.existsSync(path.resolve(currentDir, '.git'))) {
      return null;
    }

    currentDir = path.resolve(currentDir, '../');
  }

  return packageJsonFile;
}

copyToSiteServer();
