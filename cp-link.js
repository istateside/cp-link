#! /usr/bin/env node

const fs = require('fs-extra');
const { spawn } = require('child_process');
const path = require('path');
const watch = require('node-watch');

function main() {
  const args = process.argv.slice(2);

  if (args[0] === '-w') {
    console.log('Starting watch mode.');
    const targetPath = path.resolve(process.cwd(), args[1]);

    let firing = false;
    const watcher = watch(targetPath, { recursive: true });

    watcher.on('change', function () {
      if (firing) {
        return;
      }

      firing = true;
      setTimeout(() => {
        firing = false;
        runBuildUntilQuiet();
      }, 50);
    });
  } else {
    copyToOtherProject();
  }
}

function runBuild() {
  return new Promise((resolve, reject) => {
    const build = spawn('npm' , ['run', 'build']);

    build.stdout.on('data', function(data) {
      console.log(data.toString());
    });

    build.stderr.on('data', function(data) {
      console.log(data.toString());
    });

    build.on('error', function(err) {
      console.log(err);
    });

    build.on('exit', function(codeBuf) {
      const code = codeBuf.toString();
      console.log('Build exited with code ', code);
      if (code === '0') {
        resolve(code);
      } else {
        reject(code);
      }
    });
  })
}

let needsAnother = true;
let buildPromise;

async function runBuildUntilQuiet() {
  if (buildPromise) {
    console.log('needs another setting to true');
    needsAnother = true;
    return buildPromise;
  } else {
    console.log('first call');
  }

  let shouldRun = true;
  let buildCount = 0;

  while (shouldRun) {
    buildCount++;

    console.log(`Building${buildCount > 1 ? ' again' : ''}...`);

    try {
      buildPromise = runBuild();
      needsAnother = false;
      await buildPromise;
    } catch (e) {
      console.error(e);
      return;
    }

    shouldRun = needsAnother;
    needsAnother = false;
  }

  return copyToOtherProject();
}

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

main();
