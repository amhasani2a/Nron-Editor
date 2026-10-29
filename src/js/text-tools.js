/* Deterministic operations: pure functions shared by commands and recipe plugins. */
window.NronText = (() => {
  const lines = (f) => (s) => f(s.split("\n")).join("\n");
  const operations = {
    upper: (s) => s.toLocaleUpperCase(),
    lower: (s) => s.toLocaleLowerCase(),
    title: (s) => s.replace(/\b\p{L}/gu, (c) => c.toLocaleUpperCase()),
    trim: (s) => s.trim(),
    "trim-lines": lines((a) => a.map((x) => x.trim())),
    "collapse-spaces": (s) => s.replace(/[ \t]+/g, " "),
    "collapse-blank": (s) => s.replace(/\n{3,}/g, "\n\n"),
    "remove-blank": lines((a) => a.filter((x) => x.trim())),
    "sort-asc": lines((a) => a.sort((a, b) => a.localeCompare(b, "fa"))),
    "sort-desc": lines((a) => a.sort((a, b) => b.localeCompare(a, "fa"))),
    "sort-numeric": lines((a) =>
      a.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    ),
    unique: lines((a) => [...new Set(a)]),
    reverse: lines((a) => a.reverse()),
    "fa-digits": (s) => s.replace(/[0-9]/g, (c) => "۰۱۲۳۴۵۶۷۸۹"[c]),
    "en-digits": (s) =>
      s.replace(/[۰-۹٠-٩]/g, (c) =>
        String(
          "۰۱۲۳۴۵۶۷۸۹".includes(c)
            ? "۰۱۲۳۴۵۶۷۸۹".indexOf(c)
            : "٠١٢٣٤٥٦٧٨٩".indexOf(c),
        ),
      ),
    normalize: (s) => s.replace(/ك/g, "ک").replace(/[يى]/g, "ی"),
    "strip-diacritics": (s) => s.replace(/[\u064B-\u065F\u0670]/g, ""),
    "remove-zwnj": (s) => s.replace(/\u200c/g, " "),
    "normalize-spaces": (s) => s.replace(/[\u00a0\u2007\u202f]/g, " "),
    "straight-quotes": (s) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"),
    "number-lines": lines((a) => a.map((s, i) => `${i + 1}. ${s}`)),
    "bullet-lines": lines((a) => a.map((s) => "• " + s)),
    "quote-lines": lines((a) => a.map((s) => "> " + s)),
    "remove-line-numbers": lines((a) =>
      a.map((s) => s.replace(/^\s*\d+[.)]\s+/, "")),
    ),
    "join-lines": (s) => s.replace(/\n+/g, " "),
    "sentence-lines": (s) => s.replace(/([.!?؟])\s+/g, "$1\n"),
  };
  const isNewer = (a, b) => {
    const re = /^v?(\d+)\.(\d+)\.(\d+)$/;
    const x = re.exec(a),
      y = re.exec(b);
    if (!x || !y) return false;
    for (let i = 1; i < 4; i++) {
      if (+x[i] !== +y[i]) return +x[i] > +y[i];
    }
    return false;
  };
  function validPlugin(p) {
    return !!(
      p &&
      /^[a-z][a-z0-9.-]{1,63}$/.test(p.id) &&
      typeof p.name === "string" &&
      p.name.length <= 80 &&
      /^\d+\.\d+\.\d+$/.test(p.version) &&
      (!p.permissions ||
        p.permissions.every((x) =>
          ["document:read", "document:replace"].includes(x),
        )) &&
      Array.isArray(p.commands) &&
      p.commands.length > 0 &&
      p.commands.length <= 20 &&
      p.commands.every(
        (c) =>
          c &&
          typeof c.id === "string" &&
          /^[a-z0-9-]{1,40}$/.test(c.id) &&
          typeof c.label === "string" &&
          c.label.length <= 80 &&
          Object.hasOwn(operations, c.operation),
      ) &&
      new Set(p.commands.map((c) => c.id)).size === p.commands.length
    );
  }
  return {
    operations,
    transform: (op, text) => {
      if (!Object.hasOwn(operations, op)) throw new Error("Unknown operation");
      return operations[op](String(text));
    },
    validPlugin,
    isNewer,
  };
})();
