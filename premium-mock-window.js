(() => {
  "use strict";
  let examWindow = null;
  let syncHandle = null;
  let examStateObserver = null;

  function openPremiumExamWindow() {
    if (examWindow && !examWindow.closed && examWindow.document.getElementById("mockWindowContent")) {
      examWindow.focus();
      const panel = document.getElementById("premiumMockPanel");
      const result = document.getElementById("premiumMockResult");
      if (panel && result && panel.hidden && !result.hidden) { window.startPremiumMock(); syncFromOriginal(); }
      return;
    }
    if (!examWindow || examWindow.closed) {
      examWindow = window.open("", "cmcePremiumMockExam", "popup=yes,width=1280,height=900,resizable=yes,scrollbars=yes");
    }
    if (!examWindow) {
      window.startPremiumMock();
      document.getElementById("premiumMockPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const doc = examWindow.document;
    const inlineStyles = Array.from(document.querySelectorAll("style")).map(style => style.textContent).join("\n");
    const stylesheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(link => '<link rel="stylesheet" href="' + link.href.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">')
      .join("");

    doc.open();
    doc.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CDAC Premium Mock Test</title>${stylesheetLinks}
      <style>${inlineStyles}</style><style>
        body{margin:0;padding:18px;background:#f4f7f7;color:#172b2a}
        .mock-window-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:0;z-index:10;background:#fff;padding:12px 16px;border:1px solid #dce5e3;border-radius:12px;margin-bottom:16px}
        .mock-window-actions{display:flex;gap:8px;flex-wrap:wrap}
        .mock-window-actions button{padding:9px 13px;border-radius:8px;border:1px solid #cbd5d3;background:#fff;cursor:pointer;font-weight:600}
        #mockWindowContent{max-width:1400px;margin:0 auto}
        #mockWindowContent [hidden]{display:none!important}
        @media(max-width:700px){body{padding:8px}.mock-window-bar{align-items:flex-start;flex-direction:column}}
      </style></head><body>
      <div class="mock-window-bar"><strong>CDAC CMCE · Premium examination</strong><div class="mock-window-actions"><button id="mockFullscreen" type="button">Enter fullscreen</button><button id="mockClose" type="button">Close exam window</button></div></div>
      <main id="mockWindowContent"></main>
      </body></html>`);
    doc.close();

    doc.getElementById("mockFullscreen").addEventListener("click", async () => {
      try {
        if (!doc.fullscreenElement) await doc.documentElement.requestFullscreen();
        else await doc.exitFullscreen();
        doc.getElementById("mockFullscreen").textContent = doc.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen";
      } catch (_) {
        alert("Fullscreen is unavailable in this browser window. You can still maximize the window manually.");
      }
    });
    doc.getElementById("mockClose").addEventListener("click", () => examWindow.close());

    // Start the existing exam engine in the original tab. It remains the source
    // of truth for answers, timer, palette, scoring and one-attempt enforcement.
    window.startPremiumMock();
    syncFromOriginal();

    observeExamState();
    // This timer only detects a closed popup. Exam UI updates are event-driven.
    syncHandle = window.setInterval(() => {
      if (!examWindow || examWindow.closed) {
        window.clearInterval(syncHandle);
        syncHandle = null;
        if (examStateObserver) { examStateObserver.disconnect(); examStateObserver = null; }
        examWindow = null;
      }
    }, 1500);
  }

  function observeExamState() {
    if (examStateObserver) examStateObserver.disconnect();
    const targets = ["premiumMockPanel", "premiumMockResult", "premiumMockTimer"].map(id => document.getElementById(id)).filter(Boolean);
    if (!targets.length || typeof MutationObserver === "undefined") return;
    examStateObserver = new MutationObserver(() => syncFromOriginal());
    targets.forEach(target => examStateObserver.observe(target, { subtree: true, childList: true, characterData: true, attributes: true }));
  }

  function syncFromOriginal() {
    if (!examWindow || examWindow.closed) return;
    const host = examWindow.document.getElementById("mockWindowContent");
    if (!host) return;

    // Timer text changes via textContent, which does not alter innerHTML.
    // Mirror it explicitly so the popup countdown visibly advances every second.
    const sourceTimer = document.getElementById("premiumMockTimer");
    const popupTimer = examWindow.document.getElementById("premiumMockTimer");
    if (sourceTimer && popupTimer) {
      popupTimer.textContent = sourceTimer.textContent;
      popupTimer.style.color = sourceTimer.style.color;
    }

    const sourceIds = ["premiumMockPanel", "premiumMockResult"];
    sourceIds.forEach(id => {
      const source = document.getElementById(id);
      if (!source) return;
      const current = host.querySelector("#" + id);
      if (current && current.hidden === source.hidden && current.innerHTML === source.innerHTML) return;
      const clone = source.cloneNode(true);
      clone.hidden = source.hidden;
      clone.querySelectorAll("button").forEach((button, index) => {
        // Submit from the popup by calling the exam engine directly. Forwarding
        // a synthetic click to the hidden source button can be swallowed by
        // popup event capture / mirrored-DOM replacement, leaving the test open.
        if (button.id === "submitPremiumMock") {
          button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof window.submitPremiumMock === "function") {
              window.submitPremiumMock(false, true);
              window.setTimeout(syncFromOriginal, 0);
            }
          });
          return;
        }
        const originalById = button.id ? document.getElementById(button.id) : null;
        if (originalById) {
          button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            originalById.click();
            window.setTimeout(syncFromOriginal, 0);
          });
        } else if (button.classList.contains("exam-option")) {
          button.addEventListener("click", event => {
            event.preventDefault();
            const optionIndex = Array.from(clone.querySelectorAll("#premiumMockOptions .exam-option")).indexOf(button);
            document.querySelectorAll("#premiumMockOptions .exam-option")[optionIndex]?.click();
            syncFromOriginal();
          });
        } else {
          const paletteIndex = Array.from(clone.querySelectorAll("#premiumMockPalette button")).indexOf(button);
          if (paletteIndex >= 0) {
            button.addEventListener("click", event => {
              event.preventDefault();
              document.querySelectorAll("#premiumMockPalette button")[paletteIndex]?.click();
              syncFromOriginal();
            });
          }
        }
      });
      if (current) current.replaceWith(clone);
      else host.appendChild(clone);
    });
  }

  // Capture before the original Start button handler. The existing exam logic
  // still runs unchanged, but its interface is mirrored into a separate window.
  function preparePremiumExamWindow() {
    if (examWindow && !examWindow.closed) { examWindow.focus(); return; }
    examWindow = window.open("", "cmcePremiumMockExam", "popup=yes,width=1280,height=900,resizable=yes,scrollbars=yes");
    if (!examWindow) { alert("Your browser blocked the exam window. Allow pop-ups for this site and try again."); return; }
    examWindow.document.open();
    examWindow.document.write('<!doctype html><html><head><title>CDAC Premium Mock Test</title><style>body{font:16px Arial,sans-serif;background:#f4f7f7;color:#263b3b;padding:32px}main{max-width:760px;margin:10vh auto;background:#fff;padding:28px;border:1px solid #dce5e3;border-radius:14px}</style></head><body><main><h2>Checking premium access…</h2><p>Complete sign-in and purchase in the original application tab to start this test.</p></main></body></html>');
    examWindow.document.close();
  }
  document.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest("#startPremiumMock") : null;
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (window.__hasPremiumAccessGrant?.()) openPremiumExamWindow();
    else preparePremiumExamWindow();
  }, true);

  let mocksWindow = null;
  let mocksSyncHandle = null;

  function copyPageStyles(doc) {
    const inlineStyles = Array.from(document.querySelectorAll("style")).map(style => style.textContent).join("\n");
    const stylesheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(link => '<link rel="stylesheet" href="' + link.href.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">').join("");
    doc.open();
    doc.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CDAC Premium Mock Tests</title>${stylesheetLinks}<style>${inlineStyles}</style>
      <style>body{margin:0;padding:18px;background:#f4f7f7;color:#172b2a}.mock-window-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:0;z-index:10;background:#fff;padding:12px 16px;border:1px solid #dce5e3;border-radius:12px;margin-bottom:16px}.mock-window-actions{display:flex;gap:8px;flex-wrap:wrap}.mock-window-actions button{padding:9px 13px;border-radius:8px;border:1px solid #cbd5d3;background:#fff;cursor:pointer;font-weight:600}#mockWindowContent{max-width:1400px;margin:0 auto}#mockWindowContent [hidden]{display:none!important}@media(max-width:700px){body{padding:8px}.mock-window-bar{align-items:flex-start;flex-direction:column}}</style></head><body>
      <div class="mock-window-bar"><strong>CDAC CMCE · Premium Mock Tests</strong><div class="mock-window-actions"><button id="mockFullscreen" type="button">Enter fullscreen</button><button id="mockClose" type="button">Close window</button></div></div><main id="mockWindowContent"></main></body></html>`);
    doc.close();
    doc.getElementById("mockFullscreen").addEventListener("click", async () => {
      try {
        if (!doc.fullscreenElement) await doc.documentElement.requestFullscreen();
        else await doc.exitFullscreen();
        doc.getElementById("mockFullscreen").textContent = doc.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen";
      } catch (_) { alert("Fullscreen is unavailable. You can maximize this window manually."); }
    });
    doc.getElementById("mockClose").addEventListener("click", () => mocksWindow.close());
  }

  function bindMockWindowControls(root) {
    root.querySelectorAll("button").forEach(button => {
      if (button.id === "startPremiumMock") {
        button.addEventListener("click", event => {
          event.preventDefault();
          const popupSelect = mocksWindow.document.getElementById("premiumMockSelect");
          const parentSelect = document.getElementById("premiumMockSelect");
          if (popupSelect && parentSelect) parentSelect.value = popupSelect.value;
          if (typeof window.startPremiumMock === "function") window.startPremiumMock();
          syncMocksWindow();
        });
        return;
      }
      const original = button.id ? document.getElementById(button.id) : null;
      if (original) {
        button.addEventListener("click", event => {
          event.preventDefault();
          original.click();
          syncMocksWindow();
        });
      } else if (button.classList.contains("exam-option")) {
        button.addEventListener("click", event => {
          event.preventDefault();
          const idx = Array.from(root.querySelectorAll("#premiumMockOptions .exam-option")).indexOf(button);
          document.querySelectorAll("#premiumMockOptions .exam-option")[idx]?.click();
          syncMocksWindow();
        });
      } else if (button.closest("#premiumMockPalette")) {
        const idx = Array.from(root.querySelectorAll("#premiumMockPalette button")).indexOf(button);
        button.addEventListener("click", event => {
          event.preventDefault();
          document.querySelectorAll("#premiumMockPalette button")[idx]?.click();
          syncMocksWindow();
        });
      }
    });
  }

  function syncMocksWindow() {
    if (!mocksWindow || mocksWindow.closed) return;
    const doc = mocksWindow.document;
    const host = doc.getElementById("mockWindowContent");
    const sourceSection = document.getElementById("premiumMockTests");
    if (!host || !sourceSection) return;
    if (!host.querySelector("#premiumMockTests")) {
      const section = sourceSection.cloneNode(true);
      section.hidden = false;
      section.style.display = "block";
      host.replaceChildren(section);
      bindMockWindowControls(section);
      const popupSelect = doc.getElementById("premiumMockSelect");
      const parentSelect = document.getElementById("premiumMockSelect");
      if (popupSelect && parentSelect) {
        popupSelect.value = parentSelect.value;
        popupSelect.addEventListener("change", () => { parentSelect.value = popupSelect.value; });
      }
    }
    ["premiumMockPanel", "premiumMockResult"].forEach(id => {
      const source = document.getElementById(id);
      const target = doc.getElementById(id);
      if (!source || !target) return;
      if (target.hidden === source.hidden && target.innerHTML === source.innerHTML) return;
      const clone = source.cloneNode(true);
      clone.hidden = source.hidden;
      bindMockWindowControls(clone);
      target.replaceWith(clone);
    });
  }

  function openPremiumMocksWindow() {
    if (mocksWindow && !mocksWindow.closed && mocksWindow.document.getElementById("mockWindowContent")) { mocksWindow.focus(); return; }
    if (!mocksWindow || mocksWindow.closed) {
      mocksWindow = window.open("", "cmcePremiumMocks", "popup=yes,width=1280,height=900,resizable=yes,scrollbars=yes");
    }
    if (!mocksWindow) {
      alert("Your browser blocked the new window. Allow pop-ups for this site and click Open Mock Tests again.");
      return;
    }
    copyPageStyles(mocksWindow.document);
    syncMocksWindow();
    mocksSyncHandle = window.setInterval(() => {
      if (!mocksWindow || mocksWindow.closed) {
        window.clearInterval(mocksSyncHandle);
        mocksSyncHandle = null;
        mocksWindow = null;
        return;
      }
      syncMocksWindow();
    }, 350);
  }

  function preparePremiumMocksWindow() {
    if (mocksWindow && !mocksWindow.closed) { mocksWindow.focus(); return; }
    mocksWindow = window.open("", "cmcePremiumMocks", "popup=yes,width=1280,height=900,resizable=yes,scrollbars=yes");
    if (!mocksWindow) { alert("Your browser blocked the new window. Allow pop-ups for this site and click Open Mock Tests again."); return; }
    mocksWindow.document.open();
    mocksWindow.document.write('<!doctype html><html><head><title>CDAC Premium Mock Tests</title><style>body{font:16px Arial,sans-serif;background:#f4f7f7;color:#263b3b;padding:32px}main{max-width:760px;margin:10vh auto;background:#fff;padding:28px;border:1px solid #dce5e3;border-radius:14px}</style></head><body><main><h2>Checking premium access…</h2><p>Sign in and purchase this module or the complete course in the original application tab to unlock mock tests.</p></main></body></html>');
    mocksWindow.document.close();
  }
  window.openPremiumMocksWindow = openPremiumMocksWindow;
  document.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest("#openPremiumMocksSection") : null;
    if (!button) return;
    event.preventDefault();
    if (window.__hasPremiumAccessGrant?.()) openPremiumMocksWindow();
    else preparePremiumMocksWindow();
  }, true);


  let bankWindow = null;
  let bankSyncHandle = null;
  function preparePremiumBankWindow() {
    if (bankWindow && !bankWindow.closed) { bankWindow.focus(); return true; }
    bankWindow = window.open("", "cmcePremiumQuestionBank", "popup=yes,width=1180,height=850,resizable=yes,scrollbars=yes");
    if (!bankWindow) { alert("Your browser blocked the question-bank window. Allow pop-ups for this site and click Open Question Bank again."); return false; }
    bankWindow.document.open();
    bankWindow.document.write('<!doctype html><html><head><title>CDAC Premium Question Bank</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px Arial,sans-serif;background:#f4f7f7;color:#263b3b;padding:32px}main{max-width:760px;margin:10vh auto;background:white;padding:28px;border:1px solid #dce5e3;border-radius:14px}</style></head><body><main><h2>Checking premium access…</h2><p>Please complete sign-in or purchase in the original application tab. The question bank will open here once access is confirmed.</p></main></body></html>');
    bankWindow.document.close();
    return true;
  }
  function openPremiumBankWindow() {
    if (!bankWindow || bankWindow.closed) {
      bankWindow = window.open("", "cmcePremiumQuestionBank", "popup=yes,width=1180,height=850,resizable=yes,scrollbars=yes");
      if (!bankWindow) { alert("Your browser blocked the question-bank window. Allow pop-ups for this site and click Open Question Bank again."); return; }
    } else if (bankWindow.document.getElementById("bankWindowContent")) {
      bankWindow.focus();
      return;
    }
    const doc = bankWindow.document;
    const styles = Array.from(document.querySelectorAll("style")).map(x => x.textContent).join("\n");
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(x => '<link rel="stylesheet" href="' + x.href + '">').join("");
    doc.open();
    doc.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CDAC Premium Question Bank</title>${links}<style>${styles}</style><style>body{margin:0;padding:18px;background:#f4f7f7;color:#172b2a}.bank-window-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;position:sticky;top:0;z-index:10;background:#fff;padding:12px 16px;border:1px solid #dce5e3;border-radius:12px;margin-bottom:16px}.bank-window-bar button{padding:9px 13px;border-radius:8px;border:1px solid #cbd5d3;background:#fff;cursor:pointer}#bankWindowContent{max-width:1400px;margin:0 auto}#bankWindowContent [hidden]{display:none!important}</style></head><body><div class="bank-window-bar"><strong>CDAC CMCE · Premium Question Bank</strong><div><button id="bankFullscreen">Enter fullscreen</button> <button id="bankClose">Close window</button></div></div><main id="bankWindowContent"></main></body></html>`);
    doc.close();
    doc.getElementById("bankFullscreen").addEventListener("click", async () => { try { if (!doc.fullscreenElement) await doc.documentElement.requestFullscreen(); else await doc.exitFullscreen(); doc.getElementById("bankFullscreen").textContent = doc.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen"; } catch (_) { alert("Fullscreen unavailable. Maximize the window manually."); } });
    doc.getElementById("bankClose").addEventListener("click", () => bankWindow.close());
    doc.addEventListener("change", e => { if (e.target?.id === "cppPremiumLevel") document.getElementById("cppPremiumLevel").value = e.target.value; });
    doc.addEventListener("click", e => {
      // This listener runs on a different window/document. Avoid instanceof
      // checks across window realms; use the element's closest() capability.
      const b = e.target && typeof e.target.closest === "function" ? e.target.closest("button") : null;
      if (!b) return;
      if (b.id === "backToPremiumHubFromBank") { e.preventDefault(); bankWindow.close(); return; }
      if (b.id === "openCppPremium") { e.preventDefault(); document.getElementById("cppPremiumLevel").value = doc.getElementById("cppPremiumLevel").value; document.getElementById("openCppPremium").click(); syncPremiumBankWindow(); return; }
      if (b.classList.contains("quiz-option")) { const i = Array.from(doc.querySelectorAll("#premiumOptions .quiz-option")).indexOf(b); document.querySelectorAll("#premiumOptions .quiz-option")[i]?.click(); syncPremiumBankWindow(); return; }
      if (b.id === "premiumPrev" || b.id === "premiumNext") { document.getElementById(b.id).click(); syncPremiumBankWindow(); }
    });
    syncPremiumBankWindow();
    bankSyncHandle = window.setInterval(() => { if (!bankWindow || bankWindow.closed) { clearInterval(bankSyncHandle); bankSyncHandle = null; bankWindow = null; return; } syncPremiumBankWindow(); }, 350);
  }
  function syncPremiumBankWindow() {
    if (!bankWindow || bankWindow.closed) return;
    const doc = bankWindow.document, host = doc.getElementById("bankWindowContent"), source = document.getElementById("premiumBankSection");
    if (!host || !source) return;
    let target = doc.getElementById("premiumBankSection");
    if (!target) { target = source.cloneNode(true); target.hidden = false; target.style.display = "block"; host.replaceChildren(target); }
    const sourceSelect = document.getElementById("cppPremiumLevel"), popupSelect = doc.getElementById("cppPremiumLevel");
    if (sourceSelect && popupSelect && doc.activeElement !== popupSelect && popupSelect.value !== sourceSelect.value) popupSelect.value = sourceSelect.value;
    ["premiumPracticePanel","premiumUnavailable"].forEach(id => {
      const a = document.getElementById(id), b = doc.getElementById(id);
      if (!a || !b || (a.hidden === b.hidden && a.innerHTML === b.innerHTML)) return;
      const clone = a.cloneNode(true); clone.hidden = a.hidden; b.replaceWith(clone);
    });
  }
  // auth.js performs the purchase check before populating the prepared window.
  window.preparePremiumBankWindow = preparePremiumBankWindow;
  window.openPremiumBankWindow = openPremiumBankWindow;

})();