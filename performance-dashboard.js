(() => {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);

  function selection() {
    try {
      if (!selectedCourse || !Number.isInteger(selectedModuleIndex) || selectedModuleIndex < 0) return null;
      return { code: selectedCourse.code, moduleIndex: selectedModuleIndex };
    } catch (_) { return null; }
  }

  function readAttempts() {
    const selected = selection();
    if (!selected) return [];
    const rows = [];
    for (let i = 0; i < 10; i++) {
      try {
        const raw = localStorage.getItem("cmce_premium_mock_attempt_v1:" + selected.code + ":" + selected.moduleIndex + ":" + i);
        if (!raw) continue;
        const attempt = JSON.parse(raw);
        if (!attempt || !Array.isArray(attempt.questions) || attempt.questions.length !== 40) continue;
        const score = Number(attempt.score);
        if (!Number.isFinite(score) || score < 0 || score > 40) continue;
        const answers = attempt.answers && typeof attempt.answers === "object" ? attempt.answers : {};
        rows.push({
          testIndex: i,
          score,
          answered: Object.keys(answers).length,
          submittedAt: attempt.submittedAt || null
        });
      } catch (_) { /* Ignore malformed local attempt records. */ }
    }
    return rows.sort((a, b) => a.testIndex - b.testIndex);
  }

  function readPlatformAttempt() {
    const selected = selection();
    if (!selected) return null;
    try {
      const raw = localStorage.getItem("cmce_platform_test_result_v1:" + selected.code + ":" + selected.moduleIndex);
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (!item || Number(item.questionCount) !== 40 || !Number.isFinite(Number(item.score))) return null;
      return { testIndex: -1, score: Number(item.score), answered: Number(item.answered) || 0, submittedAt: item.submittedAt || null, label: "Free Platform Test" };
    } catch (_) { return null; }
  }

  function renderPerformance() {
    const host = document.getElementById("performanceContent");
    if (!host) return;
    const attempts = readAttempts();
    const platformAttempt = readPlatformAttempt();
    const allAttempts = platformAttempt ? attempts.concat(platformAttempt) : attempts;
    const completed = attempts.length;
    const totalScore = allAttempts.reduce((sum, item) => sum + item.score, 0);
    const average = allAttempts.length ? totalScore / allAttempts.length : 0;
    const best = allAttempts.length ? Math.max(...allAttempts.map(item => item.score)) : 0;
    const answered = allAttempts.reduce((sum, item) => sum + item.answered, 0);
    const correct = totalScore;
    const accuracy = answered ? (correct / answered) * 100 : 0;

    host.replaceChildren();
    const metrics = document.createElement("div");
    metrics.className = "grid";
    metrics.style.cssText = "grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px;margin:16px 0";
    const cards = [
      ["Premium mocks", completed + " / 10"],
      ["Platform test", platformAttempt ? "Completed" : "Not attempted"],
      ["Average score", allAttempts.length ? average.toFixed(1) + " / 40" : "—"],
      ["Highest score", allAttempts.length ? best + " / 40" : "—"],
      ["Answer accuracy", answered ? accuracy.toFixed(1) + "%" : "—"]
    ];
    cards.forEach(([label, value]) => {
      const card = document.createElement("div");
      card.className = "quiz-panel";
      const title = document.createElement("div");
      title.className = "eyebrow";
      title.textContent = label;
      const strong = document.createElement("h3");
      strong.style.cssText = "font-size:25px;margin:8px 0 0";
      strong.textContent = value;
      card.append(title, strong);
      metrics.appendChild(card);
    });
    host.appendChild(metrics);

    const heading = document.createElement("h3");
    heading.textContent = "Mock test history";
    host.appendChild(heading);
    if (!allAttempts.length) {
      const empty = document.createElement("p");
      empty.className = "notice";
      empty.textContent = "No submitted mock tests are recorded for this module on this device yet. Complete a premium mock test to see your score, accuracy and progress here.";
      host.appendChild(empty);
      return;
    }

    const table = document.createElement("div");
    table.style.cssText = "overflow-x:auto";
    const rows = allAttempts.map(item => {
      const pct = Math.round(item.score / 40 * 100);
      const date = item.submittedAt && !Number.isNaN(Date.parse(item.submittedAt))
        ? new Date(item.submittedAt).toLocaleString() : "—";
      const label = item.label || ("Mock Test " + (item.testIndex + 1));
      return "<tr><td>" + esc(label) + "</td><td>" + item.score + " / 40</td><td>" + pct + "%</td><td>" + item.answered + " / 40</td><td>" + esc(date) + "</td></tr>";
    }).join("");
    table.innerHTML = '<table style="width:100%;border-collapse:collapse;min-width:560px"><thead><tr><th style="text-align:left;padding:10px;border-bottom:1px solid var(--line)">Test</th><th style="text-align:left;padding:10px;border-bottom:1px solid var(--line)">Score</th><th style="text-align:left;padding:10px;border-bottom:1px solid var(--line)">Percentage</th><th style="text-align:left;padding:10px;border-bottom:1px solid var(--line)">Answered</th><th style="text-align:left;padding:10px;border-bottom:1px solid var(--line)">Submitted</th></tr></thead><tbody>' + rows + '</tbody></table>';
    host.appendChild(table);

    const note = document.createElement("p");
    note.style.cssText = "color:var(--muted);font-size:13px;margin-top:12px";
    note.textContent = "Performance data is currently stored in this browser on this device. Clearing browser storage or switching devices may remove or hide this history.";
    host.appendChild(note);
  }

  function install() {
    const home = document.getElementById("workspaceHome");
    const workspace = document.getElementById("moduleWorkspace");
    if (!home || !workspace || document.getElementById("openPerformancePage")) return;

    const card = document.createElement("article");
    card.className = "workspace-card";
    card.innerHTML = '<span class="step">PAGE 4 · ANALYSIS</span><h4>Performance Analysis</h4><p>Review your completed premium mock tests, scores, average accuracy and test history.</p><button class="btn" id="openPerformancePage" type="button">View performance</button>';
    home.appendChild(card);

    const page = document.createElement("section");
    page.className = "workspace-page";
    page.id = "performancePage";
    page.hidden = true;
    page.innerHTML = '<div class="page-toolbar"><div><div class="eyebrow">Page 4 of 4 · Results</div><h3>Performance Analysis</h3></div><button class="btn secondary" id="backFromPerformance" type="button">← Dashboard</button></div><div id="performanceContent"></div>';
    workspace.appendChild(page);

    document.getElementById("openPerformancePage").addEventListener("click", () => {
      home.hidden = true;
      workspace.querySelectorAll(".workspace-page").forEach(section => { section.hidden = section.id !== "performancePage"; });
      renderPerformance();
      page.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("backFromPerformance").addEventListener("click", () => {
      page.hidden = true;
      if (typeof openWorkspacePage === "function") openWorkspacePage("workspaceHome");
      else home.hidden = false;
    });
    // Capture free platform-test submissions as well as the premium mock records.
    if (typeof submitExam === "function" && !window.__cmcePerformanceSubmitWrapped) {
      const originalSubmitExam = submitExam;
      submitExam = function(auto) {
        const shouldSave = !examSubmitted && Array.isArray(examQs) && examQs.length === 40;
        const selected = selection();
        const record = shouldSave && selected ? {
          questionCount: 40,
          score: examQs.reduce((sum, q, i) => sum + (examAnswers[i] === q.a ? 1 : 0), 0),
          answered: Object.keys(examAnswers).length,
          submittedAt: new Date().toISOString()
        } : null;
        originalSubmitExam(auto);
        if (record) {
          try { localStorage.setItem("cmce_platform_test_result_v1:" + selected.code + ":" + selected.moduleIndex, JSON.stringify(record)); } catch (_) {}
          renderPerformance();
        }
      };
      window.__cmcePerformanceSubmitWrapped = true;
    }
    document.addEventListener("click", event => {
      const target = event.target && event.target.closest ? event.target.closest("#submitPremiumMock") : null;
      if (target) window.setTimeout(renderPerformance, 0);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();