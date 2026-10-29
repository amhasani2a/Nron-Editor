/* Reproducible post-init settings; no workstation paths or signing keys. */
const fs = require("node:fs");
const path = "src-tauri/gen/android/gradle.properties";
let text = fs.readFileSync(path, "utf8");
const settings = {
  "org.gradle.jvmargs":
    "-Xmx768m -XX:MaxMetaspaceSize=768m -XX:ActiveProcessorCount=2 -Dfile.encoding=UTF-8",
  "org.gradle.workers.max": "1",
  "org.gradle.daemon": "false",
  "org.gradle.parallel": "false",
  "kotlin.compiler.execution.strategy": "in-process",
};
for (const [key, value] of Object.entries(settings)) {
  const re = new RegExp("^" + key.replace(/\./g, "\\.") + "=.*$", "m");
  text = re.test(text)
    ? text.replace(re, key + "=" + value)
    : text + "\n" + key + "=" + value;
}
fs.writeFileSync(path, text + "\n");
console.log("Android: bounded Gradle memory, one worker, in-process Kotlin.");
// Keep the fix reproducible after `tauri android init` on CI and other machines.
fs.copyFileSync(
  "native/android/MainActivity.kt",
  "src-tauri/gen/android/app/src/main/java/com/nron/editor/MainActivity.kt",
);
const manifest = "src-tauri/gen/android/app/src/main/AndroidManifest.xml";
let xml = fs.readFileSync(manifest, "utf8");
if (!xml.includes("android:windowSoftInputMode="))
  xml = xml.replace(
    'android:launchMode="singleTask"',
    'android:launchMode="singleTask"\n            android:windowSoftInputMode="adjustResize"',
  );
fs.writeFileSync(manifest, xml);

const appGradle = "src-tauri/gen/android/app/build.gradle.kts";
let gradle = fs
  .readFileSync(appGradle, "utf8")
  .replace(/compileSdk = \d+/, "compileSdk = 36")
  .replace(/targetSdk = \d+/, "targetSdk = 36");
fs.writeFileSync(appGradle, gradle);
