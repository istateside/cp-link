# cp-link

# This package is not meant for public use

This is a tool to copy an npm package's built files from the package root
to another package's node_modules.

### Isn't that what `npm link` does?
Yes! If you can, you should use that, or the equivalent command for your package manager.

However, if you can't use those tools for whatever reason
(like if your monorepo's build pipeline breaks when you use `npm link`),
you can achieve a similar result by manually copy and pasting the built files of an npm package
into the `node_modules` folder of a consuming package.

## Installation
- Clone this repo.
- Run `npm link` from the repo root.
- Run `npm install -g cp-link` to make the executable `cp-link` command available.

## Usage
From a directory containing the library that you want to copy to another package:
To copy the built files of `my-cool-library` into the node_modules folder of `my-project`:

```sh
cd ~/projects/my-cool-library

npm run build # or whatever your build command is

cp-link ~/my-project # Pass the directory of the project you want to copy the library to
```

The `cp-link` command will gather the files that would be bundled up by NPM on publish,
and copy them directly into the node_modules directory of the specified project folder.

You can pass the node_modules directory directly, or the directory above it.

```sh
cp-link ~/work-stuff/my-project # copies to my-project/node_modules
cp-link ~/work-stuff/my-project/node_modules # Also copies to my-project/node_modules
```

If present, cp-link will use the value of the CP_LINK_DEFAULT_DIR environment variable as the
directory to copy files to.
```sh
echo "export CP_LINK_DEFAULT_DIR=~/projects/some-library-that-i-always-use" > ~/.bashrc
source ~/.bashrc

cp-link # equivalent to running `cp-link ~/projects/some-library-that-i-always-use`
cp-link ~/projecs/some-other-directory # Still works!
```


### Advanced usage
#### Run build before copying
```sh
cp-link -b ~/my-project # Runs `npm run build` before copying the files over.
cp-link --build-command "make ." ~/my-project # Customize the build command
```

#### Watch for file changes
```sh
cp-link -w ~/my-project
```
This sets up a file watcher, which watches for changes to any file that isn't gitignored.
On a file change, the build command is triggered
(defaults to `npm run build`, customized with `--build-command "my command"`).

When the build finishes, the files are copied into the given package

To watch a specific directory:
```sh
cp-link -w ./src ~/my-project
```

That sets up the watcher to only look for changes in the `src/` directory.
