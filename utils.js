import path from 'path';
import fs from 'fs-extra';

export function debounce(func, timeout) {
  let pending;

  return (...args) => {
    if (pending) {
      clearTimeout(pending);
    }

    pending = setTimeout(
      () => {
        pending = null;
        return func(...args)
      },
      timeout
    )
  }
}

export function findClosestFile(filename) {
  let currentDir = process.cwd();

  while (currentDir) {
    const filePath = path.resolve(currentDir, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    if (fs.existsSync(path.resolve(currentDir, '.git'))) {
      return null;
    }

    currentDir = path.resolve(currentDir, '../');
  }

  return filePath;
}
