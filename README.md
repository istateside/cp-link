# cp-link
# DONT USE THIS YET
This is a utility function to copy an npm package's built, distributed files from the package root
to another package's node_modules.

### Why
If possible, you should use `npm link` or `yarn link` instead. But, if for whatever reason, you
can't use those tools, you can achieve a similar result by manually copy and pasting the built files
of an npm package into the `node_modules` folder of a consuming package.

### NOTE
This package currently only supports copying packages from one library into site server.
It could be updated to customize the target path to any other package pretty easily.

## Installation
- Clone this repo.
- Run `npm link` from the repo root.
- Run `npm install -g cp-link` to make the executable `cp-link` command available.

Then, from any library root
- `npm run build` (Or whatever the build command is for that package)
- `cp-link`

The script will copy the built files from the package, specified by `main` or `files` in the
package.json, into the corresponding node_modules folder in site-server.
