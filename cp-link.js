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

function log(message) {
  process.stdout.write('\n' + message);
}

const cwd = process.cwd();

const ignoreChecker = ignore();
ignoreChecker.add('.git');

const debouncedRun = debounce((endLibraryPath, buildCommand) => triggerRun(endLibraryPath, buildCommand), 100);

const defaultPath = process.env.CP_LINK_DEFAULT_DIR || '';

async function run(endLibraryPath = defaultPath, { watch, buildCommand }) {
  const cmd = typeof buildCommand === 'string' ? buildCommand : 'npm run build';

  if (!endLibraryPath) {
    throw new Error(
      'No path given - a path to the package where you want to copy your files to must be given, ' + 
      'or a default "endLibraryPath" must be set by editing cp-link.js'
    );
  }

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

    watcher.on('change', (_event, changedFile) => {
      if (fs.existsSync(changedFile)) {
        const filename = path.relative(baseDir, changedFile);
        log(`"${filename}" changed`);
        debouncedRun(nodeModulesPath, buildCommand)
      }
    });

    log('Starting watcher');
  } else {
    if (buildCommand) {
      await runBuild(cmd);
    }

    return copyToOtherProject(nodeModulesPath);
  }
}

let isRunning = false;
let needsABuild = false;
async function triggerRun(endLibraryPath, buildCommand) {
  needsABuild = true;
  if (isRunning) {
    return;
  }

  try {
    while (needsABuild) {
      needsABuild = false;
      await runBuild(buildCommand);
    }

    await copyToOtherProject(endLibraryPath, buildCommand);
  } catch(e) {
    console.error(e);
  } finally {
    isRunning = false;
  }
}

function runBuild(command = 'npm run build') {
  return new Promise((resolve, reject) => {
    log('Building...')
    const [cmd, ...args] = command.split(' ');
    const build = spawn(cmd, args);

    build.stdout.on('data', (data) => process.stdout.write(data.toString()));
    build.stderr.on('data', (data) => process.stderr.write(data.toString()));

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

async function copyToOtherProject(libraryPath) {
  const prettyPath = libraryPath.replace(os.homedir(), '~');
  const packageJsonFilePath = findClosestFile('package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonFilePath));
  const packageBaseDir = path.dirname(packageJsonFilePath);
  const packageName = packageJson.name;
  const packageNamePieces = packageName.split('/');

  const files = await packlist({ path: packageBaseDir });

  log(`Copying built files to "${prettyPath}" ...\n`);

  let targetPath = path.resolve(libraryPath, ...packageNamePieces);

  await Promise.all(files.map(copyPath => async function() {
    const srcPath = path.resolve(packageBaseDir, copyPath);
    const newPath = path.resolve(targetPath, copyPath);

    const exists = await fs.pathExists(srcPath);
    if (!exists) {
      throw new Error(`Expected "${srcPath}" to exist, but was not found`);
    }

    if ((await fs.lstat(srcPath)).isDirectory()) {
      await fs.ensureDir(newPath);
    } else {
      await fs.ensureFile(newPath);
    }

    return fs.copy(copyPath, newPath);
  }));

  log(`Copied files to "${prettyPath}"`);
  log('\nSuccess.');
}

program.version('0.0.1');
program
  .arguments('[endLibraryPath]')
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
