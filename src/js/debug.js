/* NRON on-device viewport debug overlay (temporary diagnostic) */
(function () {
  function readInset(side) {
    var p = document.createElement('div');
    p.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;padding-' + side + ':env(safe-area-inset-' + side + ')';
    document.body.appendChild(p);
    var v = getComputedStyle(p).getPropertyValue('padding-' + side);
    p.remove();
    return (v || '0px').trim();
  }
  function collect() {
    var vv = window.visualViewport;
    return {
      innerW: window.innerWidth, innerH: window.innerHeight,
      outerW: window.outerWidth, outerH: window.outerHeight,
      clientW: document.documentElement.clientWidth,
      clientH: document.documentElement.clientHeight,
      screenW: screen.width, screenH: screen.height,
      dpr: window.devicePixelRatio,
      vv: vv ? (Math.round(vv.width) + 'x' + Math.round(vv.height) + ' scale=' + vv.scale.toFixed(2)) : 'n/a',
      media860: matchMedia('(max-width:860px)').matches,
      safeTop: readInset('top'), safeBottom: readInset('bottom'),
      ua: navigator.userAgent
    };
  }
  var box = document.createElement('pre');
  box.id = 'nron-debug';
  box.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;margin:0;'
    + 'background:#000;color:#0f0;font:12px/1.55 monospace;white-space:pre-wrap;direction:ltr;text-align:left;'
    + 'padding:12px 10px 46px;border-bottom:2px solid #0f0;max-height:72vh;overflow:auto;';
  function render() {
    var d = collect();
    var text = 'NRON VIEWPORT DEBUG\n'
      + 'inner  W x H : ' + d.innerW + ' x ' + d.innerH + '\n'
      + 'client W x H : ' + d.clientW + ' x ' + d.clientH + '\n'
      + 'outer  W x H : ' + d.outerW + ' x ' + d.outerH + '\n'
      + 'screen W x H : ' + d.screenW + ' x ' + d.screenH + '\n'
      + 'visualViewport: ' + d.vv + '\n'
      + 'devicePixelRatio: ' + d.dpr + '\n'
      + '>>> matchMedia(max-width:860px): ' + d.media860 + '\n'
      + 'safe-top: ' + d.safeTop + '   safe-bottom: ' + d.safeBottom + '\n'
      + 'UA: ' + d.ua;
    box.textContent = text;
    return text;
  }
  function mkBtn(label, rightCss) {
    var b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'position:fixed;top:8px;' + rightCss + ';z-index:2147483647;background:#0f0;color:#000;'
      + 'border:none;border-radius:6px;padding:7px 12px;font:bold 12px monospace';
    return b;
  }
  function mount() {
    document.body.appendChild(box);
    var closeB = mkBtn('\u0628\u0633\u062a\u0646', 'right:8px');
    var copyB = mkBtn('\u06a9\u067e\u06cc', 'right:70px');
    document.body.appendChild(closeB);
    document.body.appendChild(copyB);
    closeB.onclick = function () { box.remove(); closeB.remove(); copyB.remove(); };
    copyB.onclick = function () {
      var t = render();
      try { navigator.clipboard.writeText(t); copyB.textContent = '\u06a9\u067e\u06cc \u0634\u062f'; setTimeout(function () { copyB.textContent = '\u06a9\u067e\u06cc'; }, 1200); } catch (e) {}
    };
    render();
    addEventListener('resize', render);
    addEventListener('orientationchange', render);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', render);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
