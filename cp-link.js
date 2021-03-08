#! /usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

async function copyToOtherProject() {
  const packageJsonFilePath = findPackageJson();
  const package = JSON.parse(await fs.readFile(packageJsonFilePath));
  const packageBaseDir = path.dirname(packageJsonFilePath);
  const packageName = package.name;
  const packageNamePieces = packageName.split('/');

  const filesToCopy = package.files ?? package.main;

  // this is specific to Site Server, fix this later
  const projectDir = '/Users/kfleischman/projects/squarespace-v6/site-server';
  const projectNodeModules = path.resolve(projectDir, 'src/main/webapp/universal/node_modules');

  let targetPath = path.resolve(projectNodeModules, ...packageNamePieces);

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

copyToOtherProject();
