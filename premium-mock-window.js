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
            const appWindow = examWindow && !examWindow.closed ? examWindow.opener : window;
            if (appWindow && typeof appWindow.submitPremiumMock === "function") {
              appWindow.submitPremiumMock(false, true);
              appWindow.setTimeout(() => {
                syncFromOriginal();
                const result = examWindow && !examWindow.closed && examWindow.document.getElementById("premiumMockResult");
                if (result && !result.hidden) result.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 80);
            } else {
              const host = examWindow && !examWindow.closed && examWindow.document.getElementById("mockWindowContent");
              if (host) host.insertAdjacentHTML("afterbegin", '<p role="alert" style="color:#b42318;font-weight:600">Submission could not reach the exam page. Please keep this window open and retry.</p>');
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
  function showPurchaseGate(targetWindow,title,message,targetId){
    targetWindow.document.open();
    targetWindow.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px;font:16px Arial,sans-serif;background:#f4f7f7;color:#203735}
      main{width:min(100%,760px);background:#fff;padding:clamp(22px,5vw,36px);border:1px solid #dce5e3;border-radius:16px;box-shadow:0 12px 35px rgba(20,55,50,.07)}
      h2{margin:0 0 12px;font-size:clamp(23px,4vw,30px)}p{line-height:1.55;color:#536563}
      .choices{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0 12px}
      button{min-height:48px;padding:12px 16px;border:0;border-radius:9px;background:#08756b;color:#fff;font-weight:700;font-size:15px;cursor:pointer}
      button.secondary{background:#e8f2f0;color:#174b45;border:1px solid #c8dfda}
      button:disabled{opacity:.65;cursor:wait}.note{font-size:13px;margin-top:18px}
      @media(max-width:560px){body{padding:12px}.choices{grid-template-columns:1fr}main{padding:22px}}
    </style></head><body><main><div style="font-size:12px;letter-spacing:2px;font-weight:700;color:#08756b;margin-bottom:12px">CDAC CMCE PREMIUM ACCESS</div><h2>${title}</h2><p>${message}</p><p><strong>Choose how you want to unlock access:</strong></p><div class="choices"><button id="popupBuyModule" type="button">Unlock this module · ₹10</button><button id="popupBuyCourse" class="secondary" type="button">Unlock complete course · ₹40</button></div><p id="popupStatus" role="status" class="note">Sign in and payment are securely handled by the original application tab. After payment verification, this window will open your selected content automatically.</p></main><script>
      const send=async(type)=>{const status=document.getElementById("popupStatus");const buttons=[document.getElementById("popupBuyModule"),document.getElementById("popupBuyCourse")];buttons.forEach(b=>b.disabled=true);status.textContent="Opening secure purchase…";try{if(!window.opener||window.opener.closed||typeof window.opener.__startPremiumPurchaseFromPopup!=="function")throw new Error("Return to the application tab, refresh it, and open this page again.");await window.opener.__startPremiumPurchaseFromPopup(type,"${targetId}");status.textContent="Continue sign-in or secure checkout in the original application tab. This window will update after access is verified.";}catch(error){status.textContent=error.message||"Could not start purchase.";buttons.forEach(b=>b.disabled=false);}};
      document.getElementById("popupBuyModule").addEventListener("click",()=>send("module"));document.getElementById("popupBuyCourse").addEventListener("click",()=>send("course"));
    </script></body></html>`);
    targetWindow.document.close();
  }

  function preparePremiumExamWindow() {
    if (examWindow && !examWindow.closed) { examWindow.focus(); return; }
    examWindow = window.open("", "cmcePremiumMockExam", "popup=yes,width=1280,height=900,resizable=yes,scrollbars=yes");
    if (!examWindow) { alert("Your browser blocked the exam window. Allow pop-ups for this site and try again."); return; }
    showPurchaseGate(examWindow,"Unlock this premium mock test","This mock test is part of the premium question bank. Choose module-only or complete-course access below.", "startPremiumMock");
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
      // The mock-tests list itself is also mirrored into a popup. Submit
      // directly in the opener without a confirmation dialog there: a native
      // confirm() belongs to the opener and can be hidden behind this popup.
      if (button.id === "submitPremiumMock") {
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          const appWindow = mocksWindow && !mocksWindow.closed ? mocksWindow.opener : window;
          if (appWindow && typeof appWindow.submitPremiumMock === "function") {
            appWindow.submitPremiumMock(false, true);
            appWindow.setTimeout(() => {
              syncMocksWindow();
              const result = mocksWindow && !mocksWindow.closed && mocksWindow.document.getElementById("premiumMockResult");
              if (result && !result.hidden) result.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 80);
          } else {
            const status = mocksWindow && !mocksWindow.closed && mocksWindow.document.getElementById("mockWindowContent");
            if (status) status.insertAdjacentHTML("afterbegin", '<p role="alert" style="color:#b42318;font-weight:600">Submission could not reach the exam page. Please keep this window open and retry.</p>');
          }
        });
        return;
      }
      const original = button.id ? document.getElementById(button.id) : null;
      if (original) {
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          original.click();
          window.setTimeout(syncMocksWindow, 0);
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
    showPurchaseGate(mocksWindow,"Unlock premium mock tests","Premium mock tests require an active purchase. Choose module-only or complete-course access below.", "openPremiumMocksSection");
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
    showPurchaseGate(bankWindow,"Unlock the premium question bank","The premium question bank is available after purchasing this module or the complete course. Choose your access below.", "openPremiumBankSection");
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