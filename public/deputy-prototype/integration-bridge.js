/* Local extension to the recovered published build. No credentials or event data. */
(() => {
  function install() {
    for (const navigation of document.querySelectorAll('[data-sidebar="menu"]')) {
      if (navigation.querySelector('[data-aegis-integration-link]')) continue;
      const template = navigation.querySelector('[data-sidebar="menu-button"]');
      const item = document.createElement("li");
      item.setAttribute('data-aegis-integration-link', 'true');
      item.style.marginTop = "14px";
      const link = document.createElement("a");
      link.href = "/integrations";
      link.className = template?.className || "";
      link.style.cssText =
        "display:flex;align-items:center;gap:10px;text-decoration:none;border:1px solid var(--border);padding:10px;border-radius:8px;";
      link.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 8h8v8H8zM12 2v6m0 8v6M2 12h6m8 0h6"/></svg><span>Integrations</span><small style="margin-left:auto;font-size:9px;opacity:.7">CONNECT</small>';
      item.append(link);
      navigation.append(item);
    }
    const header = document.querySelector("main header");
    if (header && !document.getElementById("aegis-demo-boundary")) {
      const note = document.createElement("div");
      note.id = "aegis-demo-boundary";
      note.style.cssText =
        "padding:8px 28px;font-size:11px;border-bottom:1px solid var(--border);color:var(--muted-foreground);";
      note.textContent =
        "PROTOTYPE DEMONSTRATION · These screens use sample data and manual inputs. Authenticated Northstar events appear separately in Integrations.";
      header.after(note);
    }
  }
  new MutationObserver(install).observe(document.documentElement, {
    subtree: true,
    childList: true,
  });
  install();
  const stage = new URLSearchParams(location.search).get("stage");
  if (stage && /^\d$/.test(stage) && Number(stage) < 9) {
    const select = () =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const buttons = document.querySelectorAll(
            '[data-sidebar="menu-button"]',
          );
          buttons[Number(stage)]?.click();
        }),
      );
    if (document.readyState === "complete") select();
    else window.addEventListener("load", select, { once: true });
  }
})();
