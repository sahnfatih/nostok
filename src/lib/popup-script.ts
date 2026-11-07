/**
 * Builds the storefront popup script served at /api/public/popup-script/[merchantId].
 * Vanilla JS, no dependencies: fetches the live config from the public endpoint
 * and renders the announcement popup (modal / banner / corner card).
 *
 * The script is injected into the storefront ONCE via createStorefrontJSScript
 * as a `<script defer src=...>` tag; every design change is picked up from the
 * config endpoint without re-injection.
 */
export function buildPopupScript(configUrl: string, merchantId: string): string {
  return `(function () {
  if (window.__nkPopupLoaded) return;
  window.__nkPopupLoaded = true;
  var CFG_URL = ${JSON.stringify(configUrl)};
  var LS = "nostok:popup:" + ${JSON.stringify(merchantId)};
  var MOBILE_Q = "(max-width: 639px)";

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) {}
  }
  function session(key, value) {
    try {
      if (value === undefined) return window.sessionStorage.getItem(key);
      window.sessionStorage.setItem(key, value);
    } catch (e) {}
  }

  function pathAllowed(cfg) {
    if (!cfg.targetPaths || !cfg.targetPaths.length) return true;
    var p = window.location.pathname;
    for (var i = 0; i < cfg.targetPaths.length; i++) {
      var t = cfg.targetPaths[i];
      if (!t) continue;
      if (t === "*") return true;
      if (t.charAt(t.length - 1) === "*") {
        if (p.indexOf(t.slice(0, -1)) === 0) return true;
      } else if (p === t || p.indexOf(t) === 0) return true;
    }
    return false;
  }

  function deviceAllowed(cfg) {
    if (cfg.targetDevices === "all") return true;
    var mobile = window.matchMedia(MOBILE_Q).matches;
    return cfg.targetDevices === "mobile" ? mobile : !mobile;
  }

  function frequencyAllows(cfg) {
    var key = LS + ":" + cfg.id;
    if (cfg.frequency === "always") return true;
    if (cfg.frequency === "once_ever") return !store(key + ":ever");
    if (cfg.frequency === "once_per_session") return !session(key + ":ses");
    if (cfg.frequency === "once_per_day") {
      return store(key + ":day") !== new Date().toISOString().slice(0, 10);
    }
    return true;
  }

  function frequencyMark(cfg) {
    var key = LS + ":" + cfg.id;
    if (cfg.frequency === "once_ever") store(key + ":ever", "1");
    else if (cfg.frequency === "once_per_session") session(key + ":ses", "1");
    else if (cfg.frequency === "once_per_day") store(key + ":day", new Date().toISOString().slice(0, 10));
  }

  function surfaceVars(surface) {
    if (surface === "dark") return ["#111827", "#f9fafb", "#9ca3af", "rgba(255,255,255,0.12)", "rgba(0,0,0,0.6)", "rgba(255,255,255,0.14)", "#f9fafb", "rgba(255,255,255,0.28)"];
    if (surface === "glass") return ["rgba(255,255,255,0.78)", "#111827", "#4b5563", "rgba(255,255,255,0.55)", "rgba(17,24,39,0.45)", "rgba(255,255,255,0.72)", "#111827", "rgba(17,24,39,0.12)"];
    return ["#ffffff", "#111827", "#6b7280", "rgba(17,24,39,0.10)", "rgba(17,24,39,0.45)", "rgba(255,255,255,0.92)", "#111827", "rgba(17,24,39,0.14)"];
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var X_SVG =
    '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
    '<path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>' +
    "</svg>";

  function render(cfg) {
    var vars = surfaceVars(cfg.surface);
    var accent = /^#[0-9a-fA-F]{3,8}$/.test(cfg.accentColor || "") ? cfg.accentColor : "#6c47ff";
    var isModal = cfg.template === "modal";
    var isBanner = cfg.template === "banner";

    var style = document.createElement("style");
    style.textContent =
      ".nk-pop-backdrop{position:fixed;inset:0;z-index:2147483000;background:" + vars[4] + ";display:flex;" +
      (isBanner ? "align-items:flex-end;justify-content:center;" : "align-items:center;justify-content:center;padding:16px;") +
      "opacity:0;transition:opacity .25s ease;}" +
      ".nk-pop-backdrop.nk-pop-in{opacity:1;}" +
      ".nk-pop-card{position:relative;width:100%;max-width:440px;background:" + vars[0] + ";color:" + vars[1] + ";" +
      "border:1px solid " + vars[3] + ";border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.28);overflow:hidden;font-family:inherit;}" +
      ".nk-pop-backdrop .nk-pop-card{transform:translateY(8px) scale(.98);transition:transform .25s ease;}" +
      ".nk-pop-backdrop.nk-pop-in .nk-pop-card{transform:none;}" +
      ".nk-pop-img{display:block;width:100%;max-height:200px;object-fit:cover;}" +
      ".nk-pop-body{padding:22px 52px 24px 22px;}" +
      ".nk-pop-title{margin:0 0 8px;font-size:18px;line-height:1.35;font-weight:700;padding-right:0;}" +
      ".nk-pop-text{margin:0;font-size:14px;line-height:1.6;color:" + vars[2] + ";}" +
      ".nk-pop-cta{display:inline-flex;align-items:center;justify-content:center;margin-top:18px;min-height:42px;" +
      "padding:0 20px;border-radius:10px;background:" + accent + ";color:#fff;font-size:14px;font-weight:600;" +
      "text-decoration:none;border:0;cursor:pointer;}" +
      ".nk-pop-cta:hover{filter:brightness(0.94);}" +
      ".nk-pop-x{position:absolute;top:12px;right:12px;z-index:3;display:flex;align-items:center;justify-content:center;" +
      "width:32px;height:32px;border-radius:999px;cursor:pointer;padding:0;" +
      "background:" + vars[5] + ";color:" + vars[6] + ";border:1px solid " + vars[7] + ";" +
      "backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}" +
      ".nk-pop-x:hover{filter:brightness(0.96);}" +
      ".nk-pop-banner .nk-pop-card{max-width:920px;border-radius:14px;margin:0 12px 12px;}" +
      ".nk-pop-banner .nk-pop-row{display:flex;align-items:center;gap:16px;padding:16px 60px 16px 18px;}" +
      ".nk-pop-banner .nk-pop-img{width:84px;height:64px;border-radius:10px;flex:0 0 auto;max-height:none;}" +
      ".nk-pop-banner .nk-pop-body{padding:0;flex:1 1 auto;min-width:0;}" +
      ".nk-pop-banner .nk-pop-cta{margin-top:0;flex:0 0 auto;}" +
      ".nk-pop-banner .nk-pop-x{top:50%;transform:translateY(-50%);}" +
      ".nk-pop-corner{position:fixed;right:20px;bottom:20px;z-index:2147483000;max-width:340px;" +
      "opacity:0;transform:translateY(12px);transition:opacity .25s ease, transform .25s ease;}" +
      ".nk-pop-corner.nk-pop-in{opacity:1;transform:none;}" +
      ".nk-pop-corner .nk-pop-card{box-shadow:0 18px 44px rgba(0,0,0,0.24);}" +
      ".nk-pop-corner .nk-pop-img{max-height:150px;}" +
      ".nk-pop-corner .nk-pop-body{padding:20px 52px 22px 20px;}" +
      "@media (max-width: 639px){" +
      ".nk-pop-card{max-width:100%;}" +
      ".nk-pop-banner .nk-pop-row{flex-wrap:wrap;padding:14px 52px 14px 14px;}" +
      ".nk-pop-banner .nk-pop-img{width:64px;height:52px;}" +
      ".nk-pop-banner .nk-pop-cta{width:100%;}" +
      ".nk-pop-corner{left:12px;right:12px;bottom:12px;max-width:none;}" +
      "}";
    document.head.appendChild(style);

    var root;
    if (isModal) {
      root = document.createElement("div");
      root.className = "nk-pop-backdrop";
    } else if (isBanner) {
      root = document.createElement("div");
      root.className = "nk-pop-backdrop nk-pop-banner";
    } else {
      root = document.createElement("div");
      root.className = "nk-pop-corner";
    }

    var card = document.createElement("div");
    card.className = "nk-pop-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", isModal ? "true" : "false");
    card.setAttribute("aria-label", cfg.title || "Duyuru");

    var imgHtml = cfg.imageUrl ? '<img class="nk-pop-img" src="' + esc(cfg.imageUrl) + '" alt="' + esc(cfg.title || "") + '" />' : "";
    var ctaHtml = cfg.ctaLabel
      ? '<a class="nk-pop-cta" href="' + esc(cfg.ctaUrl || "#") + '" target="_blank" rel="noopener">' + esc(cfg.ctaLabel) + "</a>"
      : "";
    var bodyHtml =
      '<div class="nk-pop-body">' +
      (cfg.title ? '<h2 class="nk-pop-title">' + esc(cfg.title) + "</h2>" : "") +
      (cfg.body ? '<p class="nk-pop-text">' + esc(cfg.body) + "</p>" : "") +
      ctaHtml +
      "</div>";
    var xHtml = '<button class="nk-pop-x" type="button" aria-label="Kapat">' + X_SVG + "</button>";

    if (isBanner) {
      card.innerHTML = '<div class="nk-pop-row">' + imgHtml + bodyHtml + "</div>" + xHtml;
    } else {
      card.innerHTML = imgHtml + bodyHtml + xHtml;
    }
    root.appendChild(card);
    document.body.appendChild(root);

    function close() {
      root.classList.remove("nk-pop-in");
      window.setTimeout(function () {
        if (root.parentNode) root.parentNode.removeChild(root);
      }, 260);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }

    card.querySelector(".nk-pop-x").addEventListener("click", close);
    if (isModal) {
      root.addEventListener("click", function (e) {
        if (e.target === root) close();
      });
    }
    document.addEventListener("keydown", onKey);

    frequencyMark(cfg);
    window.requestAnimationFrame(function () {
      root.classList.add("nk-pop-in");
    });
  }

  fetch(CFG_URL, { mode: "cors" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg || !cfg.active) return;
      if (!deviceAllowed(cfg)) return;
      if (!pathAllowed(cfg)) return;
      if (!frequencyAllows(cfg)) return;
      render(cfg);
    })
    .catch(function () {});
})();
`;
}
