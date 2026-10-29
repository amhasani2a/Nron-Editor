/* Small offline ZIP exporters. Word export preserves text paragraphs, not complex layout. */
window.NronFormats = (() => {
  const xml = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c],
    );
  const bytes = (s) => NronZip.strToU8(s);
  function docx(tab) {
    const root = document.createElement("div");
    root.innerHTML = NronSafety.html(tab.content);
    const blocks = Array.from(root.children);
    if (!blocks.length) blocks.push(root);
    function runs(node, bold = false, italic = false) {
      if (node.nodeType === Node.TEXT_NODE)
        return (
          node.nodeValue.match(
            /[\u0600-\u06ff\u200c\u200d]+|[^\u0600-\u06ff\u200c\u200d]+/g,
          ) || []
        )
          .map(
            (part) =>
              `<w:r><w:rPr>${bold ? "<w:b/><w:bCs/>" : ""}${italic ? "<w:i/><w:iCs/>" : ""}<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:lang w:val="en-US" w:bidi="fa-IR"/>${/[\u0600-\u06ff]/.test(part) ? "<w:rtl/>" : ""}</w:rPr><w:t xml:space="preserve">${xml(part)}</w:t></w:r>`,
          )
          .join("");
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      if (node.tagName === "BR") return "<w:r><w:br/></w:r>";
      if (node.tagName === "IMG")
        return `<w:r><w:t>${xml(node.alt || "[تصویر]")}</w:t></w:r>`;
      return Array.from(node.childNodes)
        .map((n) =>
          runs(
            n,
            bold || /^(B|STRONG|H[1-6])$/.test(node.tagName),
            italic || /^(I|EM)$/.test(node.tagName),
          ),
        )
        .join("");
    }
    const paragraphs = blocks
      .map(
        (n) =>
          `<w:p><w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr>${runs(n)}</w:p>`,
      )
      .join("");
    return NronZip.zipSync({
      "[Content_Types].xml": bytes(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      "_rels/.rels": bytes(
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
      "word/document.xml": bytes(
        `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`,
      ),
    });
  }
  function epub(tab) {
    const root = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div",
    );
    root.innerHTML = NronSafety.html(tab.content);
    const images = {};
    if (window.NronExportFont?.data)
      images["EPUB/fonts/vazirmatn.woff2"] = NronExportFont.data;
    const imageItems = [];
    root.querySelectorAll("img").forEach((node, i) => {
      const data =
        /^data:image\/(png|jpeg|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(
          node.getAttribute("src") || "",
        );
      if (!data) {
        node.replaceWith(document.createTextNode(node.alt || "[تصویر]"));
        return;
      }
      try {
        const ext = data[1] === "jpeg" ? "jpg" : data[1];
        const name = `images/image-${i}.${ext}`;
        const raw = atob(data[2]);
        images["EPUB/" + name] = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        node.setAttribute("src", name);
        imageItems.push(
          `<item id="image-${i}" href="${name}" media-type="image/${data[1]}"/>`,
        );
      } catch {
        node.replaceWith(document.createTextNode(node.alt || "[تصویر]"));
      }
    });
    const body = new XMLSerializer().serializeToString(root);
    const title = xml(tab.title);
    const uid = "urn:uuid:" + crypto.randomUUID();
    return NronZip.zipSync({
      mimetype: [bytes("application/epub+zip"), { level: 0 }],
      "META-INF/container.xml": bytes(
        '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
      ),
      "EPUB/package.opf": bytes(
        `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">${uid}</dc:identifier><dc:title>${title}</dc:title><dc:language>fa</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta></metadata><manifest><item id="content" href="content.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${imageItems.join("")}${window.NronExportFont?.data ? '<item id="font" href="fonts/vazirmatn.woff2" media-type="font/woff2"/>' : ""}</manifest><spine page-progression-direction="rtl"><itemref idref="content"/></spine></package>`,
      ),
      "EPUB/content.xhtml": bytes(
        `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="fa" dir="rtl"><head><title>${title}</title><style>${window.NronExportFont?.data ? "@font-face{font-family:NronExport;src:url(fonts/vazirmatn.woff2)}" : ""}body{direction:rtl;text-align:start;line-height:1.9;font-family:NronExport,serif}p,li{white-space:pre-wrap}pre,code{direction:ltr;text-align:left;unicode-bidi:isolate}</style></head><body>${body}</body></html>`,
      ),
      ...images,
      "EPUB/nav.xhtml": bytes(
        `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${title}</title></head><body><nav epub:type="toc"><ol><li><a href="content.xhtml">${title}</a></li></ol></nav></body></html>`,
      ),
    });
  }
  return { docx, epub };
})();
