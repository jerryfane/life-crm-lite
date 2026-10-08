// LiteCheck: tells whether this page's code is exactly what dashboard/build.py wrote, so a copy that an AI retyped
// with a changed or missing character shows a banner at once. The code = the text of every <style data-lite> and
// <script data-lite>, in page order, line ends as \n, joined with \n. The data block (<script id="data">) is not
// part of it: it is meant to change. build.py writes the SHA-256 hex of the code to <meta name="lite-hash">.
// A marker of exactly "custom" means the design was changed on purpose: no check.
// check(doc, subtle) -> true (intact) | false (damaged, or the marker is missing) | null (can't tell, or custom).
var LiteCheck = (function () {
  "use strict";
  function codeOf(doc) {
    return [].map.call(doc.querySelectorAll("style[data-lite], script[data-lite]"), function (el) {
      return el.textContent.replace(/\r\n?/g, "\n");
    }).join("\n");
  }
  async function sha256(text, subtle) {
    var buf = await subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [].map.call(new Uint8Array(buf), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
  }
  async function check(doc, subtle) {
    var meta = doc.querySelector('meta[name="lite-hash"]'), want = meta ? (meta.getAttribute("content") || "").trim() : "";
    if (want === "custom" || !subtle) return null;
    try { return !!want && (await sha256(codeOf(doc), subtle)) === want.toLowerCase(); } catch (e) { return null; }
  }
  return { check: check, codeOf: codeOf, sha256: sha256 };
})();
if (typeof module !== "undefined") module.exports = LiteCheck;
