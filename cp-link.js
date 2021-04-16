#! /usr/bin/env node
'use strict';

import { program } from 'commander';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import path from 'path';
import nodeWatch from 'node-watch';
import ignore from 'ignore';
import { debounce, findClosestFile } from './utils.js';
import os from 'os';
import packlist from 'npm-packlist';

const cwd = process.cwd();

const ignoreChecker = ignore();
ignoreChecker.add('.git');

const debouncedRun = debounce((endLibraryPath, buildCommand) => triggerRun(endLibraryPath, buildCommand), 100);

// this is specific to Site Server, fix this later
// const ssNodeModules = [
//   '~/projects/squarespace-v6/site-server/src/main/webapp/universal',
// ]

async function run(endLibraryPath, { watch, buildCommand }) {
  const cmd = typeof buildCommand === 'string' ? cmd : 'npm run build';

  let nodeModulesPath = endLibraryPath.replace(/^~/, os.homedir());
  if (!/node_modules\/?$/.test(endLibraryPath)) {
    nodeModulesPath = path.resolve(nodeModulesPath, 'node_modules');
  }

  if (watch) {
    const gitignorePath = findClosestFile('.gitignore');
    const baseDir = path.dirname(gitignorePath)

    if (gitignorePath) {
      ignoreChecker.add(fs.readFileSync(gitignorePath).toString());
    }

    const watchPath = path.resolve(typeof watch === 'string' ? watch : cwd);

    const watcher = nodeWatch(watchPath, {
      recursive: true,
      filter: file => !ignoreChecker.ignores(path.relative(baseDir, file))
    });

    watcher.on('change', (event, changedFile) => {
      console.log('"%s" changed', path.relative(baseDir, changedFile));

      if (fs.existsSync(changedFile)) {
        console.log('"%s" changed', path.relative(baseDir, changedFile));
        debouncedRun(nodeModulesPath, buildCommand)
      }
    });

    console.log('Starting watcher');
  } else {
    if (buildCommand) {
      await runBuild(cmd);
    }

    try {
      await copyToOtherProject(nodeModulesPath);
    } catch(e) {
      console.error(e);
    }
  }
}

async function triggerRun(endLibraryPath, buildCommand) {
  try {
    await runBuildUntilQuiet(buildCommand);
    await copyToOtherProject(endLibraryPath);
  } catch(e) {
    console.error(e);
  }
}

function runBuild(command = 'npm run build') {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const build = spawn(cmd, args);

    build.stdout.on('data', (data) => console.log(data.toString()));
    build.stderr.on('data', (data) => console.log(data.toString()));

    build.on('error', (err) => reject(err));

    build.on('exit', function(codeBuf) {
      const code = codeBuf.toString();

      if (code === '0') {
        resolve(code);
      } else {
        reject(code);
      }
    });
  })
}

let buildPromise;
async function runBuildUntilQuiet(buildCommand) {
  if (buildPromise) {
    return buildPromise;
  }

  console.log('Building...')

  let error;
  try {
    buildPromise = runBuild(buildCommand);
    await buildPromise;
  } catch (e) {
    error = e;
  }

  buildPromise = null

  if (error) {
    throw error;
  }
}

async function copyToOtherProject(libraryPath) {
  const prettyPath = libraryPath.replace(os.homedir(), '~');
  const packageJsonFilePath = findClosestFile('package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonFilePath));
  const packageBaseDir = path.dirname(packageJsonFilePath);
  const packageName = packageJson.name;
  const packageNamePieces = packageName.split('/');

  const files = await packlist({ path: packageBaseDir });

  console.log(`Copying built files to "${prettyPath}" ...`);
  let targetPath = path.resolve(libraryPath, ...packageNamePieces);

  let copyPromises = [];
  for (const copyPath of files) {
    const srcPath = path.resolve(packageBaseDir, copyPath);
    const newPath = path.resolve(targetPath, copyPath);

    copyPromises.push((async () => {
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
    })());
  }

  await Promise.all(copyPromises);

  console.log(`Copied ${copyPromises.length} files to "${prettyPath}"`);

  console.log('\nSuccess.');
}

program.version('0.0.1');
program
  .arguments('<endLibraryPath>')
  .option('-w, --watch [watchDir]', 'run a watcher and re link on new builds. defaults to current directory if watchDir not given.')
  .option('-b, --build-command [buildCmd]', 'the command to run a build for the current library. defaults to "npm run build"')
  .description(
    "A command to copy the built files from the current library into another library's node_modules/ folder", 
    {
      endLibraryPath: 'path to the folder where you want to copy this library into.'
    }
  )
  .action(run);

program.parse();
