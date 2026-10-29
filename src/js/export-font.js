/* Export font loaded only when requested; no network or system-font dependency. */
window.NronExportFont = {
  data: null,
  css: "",
  async load() {
    if (this.data) return;
    const response = await fetch("assets/Vazirmatn-Regular.woff2");
    if (!response.ok) throw Error("فونت خروجی بارگذاری نشد");
    this.data = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of this.data) binary += String.fromCharCode(byte);
    this.css =
      "@font-face{font-family:NronExport;src:url(data:font/woff2;base64," +
      btoa(binary) +
      ") format('woff2')}body{font-family:NronExport,Tahoma,sans-serif}";
  },
};
