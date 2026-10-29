const esbuild = require("esbuild");
esbuild.buildSync({
  stdin: {
    contents:
      "import DOMPurify from 'dompurify'; import * as fflate from 'fflate'; window.DOMPurify=DOMPurify; window.NronZip=fflate; import * as updater from '@tauri-apps/plugin-updater'; window.NronUpdate=updater; import * as fs from '@tauri-apps/plugin-fs'; import * as dialog from '@tauri-apps/plugin-dialog'; window.NronNative={fs,dialog};",
    resolveDir: process.cwd(),
  },
  bundle: true,
  minify: true,
  format: "iife",
  target: ["chrome100", "safari15"],
  outfile: "src/js/vendor.js",
  legalComments: "eof",
});
