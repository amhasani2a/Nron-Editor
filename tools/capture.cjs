const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
(async () => {
  const server = spawn(
    "python3",
    ["-m", "http.server", "4319", "--directory", "src"],
    { stdio: "ignore" },
  );
  const browser = await chromium.launch({
    executablePath: "/usr/local/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    await new Promise((r) => setTimeout(r, 500));
    fs.mkdirSync("/data/nron-previews", { recursive: true });
    for (const [name, width, height, theme, modal] of [
      ["desktop", 1440, 960, "light"],
      ["mobile", 390, 844, "light"],
      ["mobile-dark", 390, 844, "dark"],
      ["commands", 390, 844, "light", "commands"],
      ["settings", 390, 844, "light", "settings"],
      ["plugins", 390, 844, "dark", "plugins"],
      ["menu", 390, 844, "light", "menu"],
      ["transform", 390, 844, "light", "transform"],
      ["confirmation", 390, 844, "light", "confirmation"],
      ["update-error", 390, 844, "light", "update-error"],
      ["print", 1024, 900, "dark", "print"],
    ]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto("http://127.0.0.1:4319");
      await page.waitForFunction(() => document.body.dataset.ready === "true");
      await page.evaluate(async (theme) => {
        document.querySelector(`[data-theme-val="${theme}"]`).click();
        DOM.visualEditor.innerHTML =
          "<h1>جایی برای کلمه‌ها</h1><p>بعضی ایده‌ها با یک خط شروع می‌شوند. اینجا می‌توانیم بی‌عجله بنویسیم، برگردیم و دوباره بخوانیم.</p><h2>یک میز کار خلوت</h2><p>قرار نیست همه ابزارها همیشه جلوی چشم باشند. برای پیدا کردن یک کار، دکمهٔ فرمان‌ها را بزنید؛ از مرتب‌کردن سطرها تا ساختن طرح یک نوشته.</p><blockquote>خوب نوشتن، اغلب یعنی یک بار دیگر نوشتن.</blockquote><p>نسخه‌های قبلی در تاریخچه می‌مانند و نوشته‌ها روی همین دستگاه ذخیره می‌شوند.</p>";
        await renameTab(state.activeTabId, "یادداشتی برای شروع");
        await saveCurrentTab();
        await updateStats();
      }, theme);
      if (modal === "commands") await page.locator("#btn-commands").click();
      if (modal === "settings")
        await page.evaluate(() =>
          document.querySelector("#settings-modal").classList.remove("hidden"),
        );
      if (modal === "plugins")
        await page.evaluate(() => {
          NronStudio.commands.find((c) => c.id === "plugins").run();
        });
      if (modal === "menu") await page.locator("#btn-menu").click();
      if (modal === "transform")
        await page.evaluate(() => NronStudio.commands[0].run());
      if (modal === "confirmation")
        await page.evaluate(() => {
          NronStudio.commands.find((c) => c.id === "plugins").run();
          askDialog(
            "افزودن پلاگین؛ فقط تبدیل متن سند. برای تأیید بنویسید بله",
            [{ label: "بله" }],
          );
        });
      if (modal === "update-error") {
        await page.route(
          "https://api.github.com/repos/amhasani2a/Nron-Editor/releases/latest",
          (route) =>
            route.fulfill({
              status: 404,
              body: "{}",
              contentType: "application/json",
            }),
        );
        await page.evaluate(() =>
          NronStudio.commands.find((c) => c.id === "updates").run(),
        );
      }
      if (modal === "print") await page.emulateMedia({ media: "print" });
      await page.waitForTimeout(200);
      await page.screenshot({ path: "/data/nron-previews/" + name + ".png" });
      console.log(
        name,
        await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          buttons: document.querySelectorAll("button").length,
        })),
      );
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
