/* Pure policy, shared by the UI and regression tests. No I/O or document mutation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NronWorkspaceModel = api;
})(typeof window === "object" ? window : globalThis, () => {
  const created = (t) => Number(t.createdAt) || parseInt(t.id, 10) || 0;
  function newest(docs) {
    return docs
      .filter((t) => !t.archived)
      .reduce((a, b) => (!a || created(b) >= created(a) ? b : a), null);
  }
  function list(
    docs,
    { query = "", collection = "", mode = "active", sort = "created" } = {},
  ) {
    return docs
      .filter(
        (t) =>
          (mode === "all" || !!t.archived === (mode === "archive")) &&
          (!collection || t.collection === collection) &&
          String(t.title || "")
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      )
      .sort((a, b) =>
        sort === "name"
          ? String(a.title).localeCompare(String(b.title), "fa")
          : sort === "updated"
            ? (b.updatedAt || created(b)) - (a.updatedAt || created(a))
            : created(b) - created(a),
      );
  }
  function validTemplate(t) {
    return (
      !!t &&
      typeof t.name === "string" &&
      t.name.trim().length > 0 &&
      t.name.length <= 120 &&
      typeof t.content === "string" &&
      t.content.length <= 100000
    );
  }
  function minutes(n) {
    return Math.min(180, Math.max(1, Math.round(Number(n) || 1)));
  }
  function remaining(deadline, now = Date.now()) {
    return Math.max(0, Math.ceil((deadline - now) / 1000));
  }
  function history(rows, budget = 2 * 1024 * 1024) {
    let total = 0;
    const out = [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const size = String(rows[i].content || "").length * 2;
      if (out.length && (total + size > budget || out.length >= 40)) break;
      out.unshift(rows[i]);
      total += size;
    }
    return out;
  }
  return { newest, list, validTemplate, minutes, remaining, history };
});
