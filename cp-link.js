#! /usr/bin/env node
'use strict';

import { program } from 'commander';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import path from 'path';
import nodeWatch from 'node-watch';
import ignore from 'ignore';
import { debounce, findClosestFile } from './utils.js';

const cwd = process.cwd();

const ignoreChecker = ignore();

const debouncedRun = debounce((endLibraryPath, buildCommand) => triggerRun(endLibraryPath, buildCommand), 100);

// this is specific to Site Server, fix this later
const ssNodeModules = '~/projects/squarespace-v6/site-server/src/main/webapp/universal/node_modules';

function run(endLibraryPath = ssNodeModules, { watch, buildCommand }) {
  const cmd = typeof buildCommand === 'string' ? cmd : 'npm run build';

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
        debouncedRun(endLibraryPath, buildCommand)
      }
    });

    console.log('Starting watcher');
  } else {
    if (buildCommand) {
      runBuild(cmd);
    }

    copyToOtherProject(endLibraryPath);
  }
}

async function triggerRun(endLibraryPath, buildCommand) {
  await runBuildUntilQuiet(buildCommand);
  // return copyToOtherProject(endLibraryPath);
}

function runBuild(command = 'npm run build') {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const build = spawn(cmd, args);

    build.stdout.on('data', (data) => console.log(data.toString()));
    build.stderr.on('data', (data) => console.log(data.toString()));

    build.on('error', (err) => console.log(err));

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

  try {
    buildPromise = runBuild(buildCommand);
    await buildPromise;
  } catch (e) {
    console.error(e);
    return;
  }

  buildPromise = null
}

async function copyToOtherProject(libraryPath) {
  const packageJsonFilePath = findClosestFile('package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonFilePath));
  const packageBaseDir = path.dirname(packageJsonFilePath);
  const packageName = packageJson.name;
  const packageNamePieces = packageName.split('/');

  const filesToCopy = packageJson.files ?? packageJson.main;

  let targetPath = path.resolve(libraryPath, ...packageNamePieces);

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

program.version('0.0.1');
program
  .arguments('[endLibraryPath]')
  .option('-w, --watch [watchDir]', 'run a watcher and re link on new builds. defaults to current directory if watchDir not given.')
  .option('-b, --build-command [buildCmd]', 'the command to run a build for the current library. defaults to "npm run build"')
  .description(
    "A command to copy the built files from the current library into another library's node_modules/ folder", 
    {
      endLibraryPath: 'path to the library where you want to copy this library into. defaults to site server'
    }
  )
  .action(run);

program.parse();
