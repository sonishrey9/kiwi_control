import { buildBootRecoveryGuidance } from "./ui/guidance.js";
function bootOverlay() {
    return document.querySelector("#boot-overlay");
}
function renderMessage(title, detail) {
    const overlay = bootOverlay();
    if (!overlay) {
        return;
    }
    overlay.classList.remove("is-hidden");
    overlay.innerHTML = `
    <div class="kc-boot-fallback">
      <div class="kc-boot-card">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(detail)}</p>
      </div>
    </div>
  `;
}
function renderError(detail) {
    const overlay = bootOverlay();
    if (!overlay) {
        return;
    }
    const guidance = buildBootRecoveryGuidance(detail);
    overlay.classList.remove("is-hidden");
    overlay.innerHTML = `
    <div class="kc-boot-fallback">
      <div class="kc-boot-card">
        <h1>${escapeHtml(guidance.title)}</h1>
        <p>${escapeHtml(guidance.intro)}</p>
        <ol>
          ${guidance.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
        </ol>
        <pre>${escapeHtml(guidance.detail)}</pre>
      </div>
    </div>
  `;
}
function hide() {
    bootOverlay()?.classList.add("is-hidden");
}
function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
window.__KIWI_BOOT_API__ = {
    mounted: false,
    renderMessage,
    renderError,
    hide
};
renderMessage("Loading Kiwi Control", "External boot diagnostics loaded. If this message never changes, the main renderer bundle is failing before mount.");
window.addEventListener("error", (event) => {
    if (window.__KIWI_BOOT_API__?.mounted) {
        return;
    }
    renderError(event.message || "Unknown startup error");
});
window.addEventListener("unhandledrejection", (event) => {
    if (window.__KIWI_BOOT_API__?.mounted) {
        return;
    }
    const reason = event.reason;
    renderError(typeof reason === "string" ? reason : reason?.message ?? "Unhandled promise rejection");
});
window.setTimeout(() => {
    if (window.__KIWI_BOOT_API__?.mounted) {
        return;
    }
    renderError("Renderer timeout: the main UI bundle did not report a successful mount.");
}, 3000);
