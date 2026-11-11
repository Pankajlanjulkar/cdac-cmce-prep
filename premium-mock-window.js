(() => {
  "use strict";
  let examWindow = null;
  let syncHandle = null;

  function openPremiumExamWindow() {
    if (examWindow && !examWindow.closed) {
      examWindow.focus();
      return;
    }

    // Open synchronously inside the student's click so popup blockers allow it.
    examWindow = window.open("", "cmcePremiumMockExam", "popup=yes,width=1280,height=900,resizable=yes,scrollbars=yes");
    if (!examWindow) {
      alert("Your browser blocked the exam window. Allow pop-ups for this site and click Start mock test again.");
      return;
    }

    const doc = examWindow.document;
    const inlineStyles = Array.from(document.querySelectorAll("style")).map(style => style.textContent).join("\\n");
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

    syncHandle = window.setInterval(() => {
      if (!examWindow || examWindow.closed) {
        window.clearInterval(syncHandle);
        syncHandle = null;
        examWindow = null;
        return;
      }
      syncFromOriginal();
    }, 350);
  }

  function syncFromOriginal() {
    if (!examWindow || examWindow.closed) return;
    const host = examWindow.document.getElementById("mockWindowContent");
    if (!host) return;

    const sourceIds = ["premiumMockPanel", "premiumMockResult"];
    const fragments = sourceIds.map(id => {
      const source = document.getElementById(id);
      if (!source) return null;
      const clone = source.cloneNode(true);
      clone.hidden = source.hidden;
      clone.querySelectorAll("button").forEach((button, index) => {
        const originalById = button.id ? document.getElementById(button.id) : null;
        if (originalById) {
          button.addEventListener("click", event => {
            event.preventDefault();
            originalById.click();
          });
        } else if (button.classList.contains("exam-option")) {
          button.addEventListener("click", event => {
            event.preventDefault();
            const optionIndex = Array.from(clone.querySelectorAll("#premiumMockOptions .exam-option")).indexOf(button);
            document.querySelectorAll("#premiumMockOptions .exam-option")[optionIndex]?.click();
          });
        } else {
          const paletteIndex = Array.from(clone.querySelectorAll("#premiumMockPalette button")).indexOf(button);
          if (paletteIndex >= 0) {
            button.addEventListener("click", event => {
              event.preventDefault();
              document.querySelectorAll("#premiumMockPalette button")[paletteIndex]?.click();
            });
          }
        }
      });
      return clone;
    }).filter(Boolean);

    host.replaceChildren(...fragments);
  }

  // Capture before the original Start button handler. The existing exam logic
  // still runs unchanged, but its interface is mirrored into a separate window.
  document.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest("#startPremiumMock") : null;
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPremiumExamWindow();
  }, true);
})();