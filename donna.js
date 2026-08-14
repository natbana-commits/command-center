// Page-invariant client scripts (progress bar, command palette, the
// client-side nav router), served as one cacheable static file instead of
// being re-embedded inline in every page response and every client-side
// nav fetch/hover-prefetch. Per-page dynamic scripts stay inline in the
// server-rendered HTML (see renderLayout's pageScript param in
// src/donna/layout.ts) — only content that's identical on every page lives
// here. Bump ASSET_VERSION in layout.ts when editing this file so cached
// copies don't go stale against updated markup.

(function () {
  const bar = document.getElementById("nav-progress-bar");
  if (!bar) return;

  function start() {
    bar.classList.add("active");
  }

  document.addEventListener("click", (e) => {
    const link = e.target && e.target.closest && e.target.closest('a[href^="/donna"]');
    if (!link || link.target === "_blank") return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    start();
  });

  document.addEventListener("submit", (e) => {
    if (e.target && e.target.tagName === "FORM") start();
  });

  // A back/forward-cache restore brings back the exact DOM state from
  // the moment of navigating away, "active" class included — without
  // this the bar would sit there permanently lit on a bfcache-restored
  // page since no real navigation ever happens to reset it.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) bar.classList.remove("active");
  });
})();

(function () {
  // Static page/nav destinations — filtered entirely client-side, no
  // server round-trip. Kept in sync by hand with nav.ts's MIDDLE_TAB_META;
  // a page missing from this list just doesn't show up in the palette,
  // it isn't a broken link.
  const PALETTE_PAGES = [
    { title: "Home", href: "/donna" },
    { title: "News", href: "/donna/news" },
    { title: "Calendar", href: "/donna/calendar" },
    { title: "Reminders", href: "/donna/reminders" },
    { title: "IPOs", href: "/donna/ipos" },
    { title: "Chat", href: "/donna/chat" },
    { title: "School", href: "/donna/school" },
    { title: "Finances", href: "/donna/finances" },
    { title: "Contacts", href: "/donna/contacts" },
    { title: "Files", href: "/donna/files" },
    { title: "Settings", href: "/donna/settings" },
  ];
  const scrim = document.getElementById("palette-scrim");
  const input = document.getElementById("palette-input");
  const resultsEl = document.getElementById("palette-results");
  if (!scrim || !input || !resultsEl) return;

  let items = [];
  let activeIndex = -1;
  let searchTimer = null;

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function renderRow(item, i) {
    const sub = item.subtitle ? '<div class="hint" style="margin-top:2px;">' + escapeHtml(item.subtitle) + '</div>' : "";
    return '<div class="reminder-row palette-row" data-index="' + i + '">' +
      '<div class="reminder-body"><span class="reminder-title">' + escapeHtml(item.title) + '</span>' + sub + '</div></div>';
  }

  function highlight() {
    Array.prototype.forEach.call(resultsEl.querySelectorAll(".palette-row"), function (el, i) {
      el.classList.toggle("palette-row-active", i === activeIndex);
    });
  }

  function renderItems(newItems) {
    items = newItems;
    activeIndex = items.length > 0 ? 0 : -1;
    resultsEl.innerHTML = items.length
      ? items.map(renderRow).join("")
      : '<p class="empty" style="padding:8px;">No results.</p>';
    Array.prototype.forEach.call(resultsEl.querySelectorAll(".palette-row"), function (el, i) {
      el.addEventListener("click", function () { selectItem(i); });
    });
    highlight();
  }

  function renderStatic(query) {
    const q = query.trim().toLowerCase();
    const pages = q ? PALETTE_PAGES.filter((p) => p.title.toLowerCase().includes(q)) : PALETTE_PAGES;
    renderItems(pages.map((p) => ({ title: p.title, href: p.href })));
  }

  function selectItem(i) {
    const item = items[i];
    if (item && item.href) {
      close();
      window.location.href = item.href;
    }
  }

  // A small, deliberately curated set of prefixes — not a full
  // natural-language parser. Anything more open-ended belongs in the
  // Chat tab, which already exists for exactly that.
  async function tryQuickAction(query) {
    const m = query.match(/^(?:remind me to|add reminder:?)\\s+(.+)/i);
    if (!m) return false;
    const title = m[1].trim();
    if (!title) return false;
    resultsEl.innerHTML = '<p class="hint" style="padding:8px;">Adding reminder…</p>';
    try {
      await fetch("/donna/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "action=add&title=" + encodeURIComponent(title),
      });
    } catch (err) {}
    close();
    window.location.href = "/donna/reminders";
    return true;
  }

  async function runSearch(query) {
    if (await tryQuickAction(query)) return;

    const q = query.trim();
    renderStatic(q);
    if (!q) return;

    const staticItems = items;
    try {
      const res = await fetch("/api/donna-chat?page=search&q=" + encodeURIComponent(q));
      const data = await res.json();
      const dynamic = (data.results || []).map((r) => ({ title: r.title, subtitle: r.subtitle, href: r.href }));
      renderItems(staticItems.concat(dynamic));
    } catch (err) {
      // Static results (already rendered) still work even if the dynamic
      // fetch fails — no extra results beyond that is an acceptable
      // degradation, not an error state worth surfacing.
    }
  }

  function open() {
    scrim.classList.add("open");
    input.value = "";
    renderStatic("");
    input.focus();
  }

  function close() {
    scrim.classList.remove("open");
  }
  window.__paletteOpen = open;

  input.addEventListener("input", function () {
    clearTimeout(searchTimer);
    const query = input.value;
    searchTimer = setTimeout(function () { runSearch(query); }, 200);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      highlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlight();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) selectItem(activeIndex);
    } else if (e.key === "Escape") {
      close();
    }
  });

  scrim.addEventListener("click", close);

  document.addEventListener("keydown", function (e) {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") !== -1;
    const modifierPressed = isMac ? e.metaKey : e.ctrlKey;
    if (modifierPressed && e.key.toLowerCase() === "k") {
      e.preventDefault();
      open();
    }
  });
})();

(function () {
  const pageContent = document.getElementById("page-content");
  const sidebarNav = document.getElementById("sidebar-nav-region");
  const mobileNav = document.getElementById("mobile-nav-region");
  const progressBar = document.getElementById("nav-progress-bar");
  if (!pageContent) return;

  const prefetched = new Set();

  function isInternalHref(href) {
    if (!href) return false;
    try {
      const url = new URL(href, window.location.href);
      return url.origin === window.location.origin && url.pathname.indexOf("/donna") === 0;
    } catch (e) {
      return false;
    }
  }

  function stopProgress() {
    if (progressBar) progressBar.classList.remove("active");
  }

  // Scripts inserted via innerHTML never execute — recreate each one so
  // it actually runs (this is what re-runs a page's own client script,
  // and the Plaid SDK's <script src="..."> tag, after every swap).
  function runScripts(container) {
    const scripts = container.querySelectorAll("script");
    Array.prototype.forEach.call(scripts, function (old) {
      const fresh = document.createElement("script");
      Array.prototype.forEach.call(old.attributes, function (attr) {
        fresh.setAttribute(attr.name, attr.value);
      });
      fresh.textContent = old.textContent;
      old.replaceWith(fresh);
    });
  }

  // A plain element id (data-swap-target="foo") scopes the swap to just
  // that element instead of the whole page — for an action whose result
  // only ever affects one region (a reminder row's complete/delete, an
  // edit-form save) a full #page-content replace is both an unnecessary
  // scroll-to-top/flash and, since it also touches every unrelated widget
  // on the page, more work than the action needs. Falls back to the full
  // swap if the target id isn't present in either the current or new DOM.
  function swapFrom(doc, swapTarget) {
    if (swapTarget) {
      const current = document.getElementById(swapTarget);
      const fresh = doc.getElementById(swapTarget);
      if (current && fresh) {
        current.innerHTML = fresh.innerHTML;
        runScripts(current);
        stopProgress();
        document.dispatchEvent(new CustomEvent("donna:swapped", { detail: { target: swapTarget } }));
        return;
      }
    }
    document.title = doc.title;
    const newPageContent = doc.getElementById("page-content");
    const newSidebarNav = doc.getElementById("sidebar-nav-region");
    const newMobileNav = doc.getElementById("mobile-nav-region");
    if (newPageContent) pageContent.innerHTML = newPageContent.innerHTML;
    if (sidebarNav && newSidebarNav) sidebarNav.innerHTML = newSidebarNav.innerHTML;
    if (mobileNav && newMobileNav) mobileNav.innerHTML = newMobileNav.innerHTML;
    runScripts(pageContent);
    // history.pushState above (for a full, non-scoped navigation) already
    // lands the new hash in window.location.hash before this runs, so a
    // link to e.g. /donna/settings#settings-classes should land on that
    // section — not always reset to the top, which would silently defeat
    // any cross-page link that includes an anchor (the Home cards' and
    // pages' "Edit" links, the sidebar info icon's How-this-works link).
    const hashTarget = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (hashTarget) {
      hashTarget.scrollIntoView({ block: "start" });
    } else {
      window.scrollTo(0, 0);
    }
    stopProgress();
  }

  async function navigate(url, options, push, swapTarget) {
    if (progressBar) progressBar.classList.add("active");
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error("bad status " + res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/html");
      if (swapTarget) {
        // A scoped swap doesn't push a new history entry (it's an in-place
        // update, not a navigation to step back through) — but the server
        // may still have redirected somewhere meaningfully different (e.g.
        // saving a reminder edit leaves ?edit=<id> behind), so the address
        // bar is corrected in place with replaceState. Without this, a
        // reload right after a scoped-swap action would land back in the
        // stale view (e.g. the edit form) instead of matching what's shown.
        const target = res.url || url;
        if (target !== window.location.href) {
          history.replaceState(history.state, "", target);
        }
      } else if (push) {
        let target = res.url || url;
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1 && target.indexOf("#") === -1) target += url.slice(hashIndex);
        history.pushState({ swapped: true }, "", target);
      }
      swapFrom(doc, swapTarget);
    } catch (err) {
      // Fall back to a real navigation — never leave the click/submit
      // silently doing nothing.
      window.location.href = url;
    }
  }

  document.addEventListener("click", function (e) {
    const link = e.target && e.target.closest && e.target.closest("a[href]");
    if (!link) return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    if (!isInternalHref(link.getAttribute("href"))) return;
    // A same-page #anchor link (e.g. Settings' section nav pills) should
    // get native in-page scrolling, not a full fetch+swap — swapFrom
    // always resets scroll to the top, which would make a same-page jump
    // link look like it silently did nothing but reset your scroll
    // position instead of taking you anywhere.
    const dest = new URL(link.href, window.location.href);
    if (dest.pathname === window.location.pathname && dest.search === window.location.search && dest.hash) {
      return;
    }
    e.preventDefault();
    navigate(link.href, { method: "GET" }, true, link.getAttribute("data-swap-target") || undefined);
  });

  document.addEventListener("submit", function (e) {
    const form = e.target;
    if (!form || form.tagName !== "FORM" || e.defaultPrevented) return;
    let url;
    try {
      // getAttribute, not form.action/form.method — every form in this app
      // has a hidden <input name="action"> for its own action dispatch,
      // which shadows the form element's built-in .action/.method IDL
      // properties (a real HTML gotcha: a named form control takes
      // precedence over the same-named built-in property). .getAttribute
      // always reads the literal HTML attribute, unaffected by that.
      url = new URL(form.getAttribute("action") || window.location.href, window.location.href);
    } catch (err) {
      return;
    }
    if (url.origin !== window.location.origin) return;
    e.preventDefault();

    // Nothing visibly happened while a submit was in flight — easy to
    // read as "did that not work?" and click Add again, creating a
    // duplicate (reminders especially). Disabling every submit-role
    // button in the form for the duration covers every Add/Save form in
    // the app from this one place, not just the ones someone remembers to
    // add it to by hand. Re-enabled once navigate() settles rather than
    // left disabled — a full-page swap replaces the button anyway (this
    // is a harmless no-op on the detached old one), but a scoped
    // data-swap-target swap (e.g. the Add-reminder modal, which lives
    // outside the swapped region) leaves this exact button in place, and
    // it needs to work again for the next add.
    const submitButtons = Array.prototype.filter.call(form.querySelectorAll("button"), function (btn) {
      return btn.type !== "button" && !btn.disabled;
    });
    submitButtons.forEach(function (btn) { btn.disabled = true; });
    const reenable = function () {
      submitButtons.forEach(function (btn) { btn.disabled = false; });
    };

    const method = (form.getAttribute("method") || "GET").toUpperCase();
    const formData = new FormData(form);
    // A real native form submit includes the clicked submit button's own
    // name/value pair (e.g. <button name="action" value="move-up:...">) —
    // several forms in this app (Settings' Dashboard section) rely on
    // that instead of a hidden <input name="action">. new FormData(form)
    // alone does NOT include it (only new FormData(form, submitter) does,
    // or reading it manually via the submit event's .submitter) — without
    // this, every reorder/save click on those forms would silently POST
    // with no action at all.
    if (e.submitter && e.submitter.name) {
      formData.append(e.submitter.name, e.submitter.value);
    }
    const params = new URLSearchParams(formData);
    const swapTarget = form.getAttribute("data-swap-target") || undefined;
    const navigated =
      method === "GET"
        ? navigate(url.pathname + "?" + params.toString(), { method: "GET" }, true, swapTarget)
        : // URLSearchParams, not raw FormData — no form in this app declares
          // enctype="multipart/form-data", so every one of them relies on the
          // browser's native default encoding (application/x-www-form-
          // urlencoded). Sending a raw FormData body here would switch that
          // to multipart, which Vercel's built-in body parser (@vercel/node's
          // req.body) doesn't parse, silently dropping every field.
          navigate(url.pathname + url.search, { method: method, body: params }, true, swapTarget);
    navigated.finally(reenable);
  });

  window.addEventListener("popstate", function () {
    navigate(window.location.href, { method: "GET" }, false);
  });

  // Hover prefetch: warms the browser's own HTTP cache before the click
  // lands. mouseenter doesn't bubble, but capture-phase listeners still
  // see it on descendants, so this delegates from one document listener
  // rather than needing a listener per link.
  document.addEventListener(
    "mouseenter",
    function (e) {
      const link = e.target && e.target.closest && e.target.closest("a[href]");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!isInternalHref(href) || prefetched.has(href)) return;
      prefetched.add(href);
      fetch(link.href, { method: "GET" }).catch(function () {});
    },
    true
  );
})();
