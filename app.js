(function () {
  const PASSING_SCORE = COURSE_CONFIG.quizPassingScore || 3;

  const appShell = document.getElementById("appShell");
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const viewer = document.getElementById("viewer");
  const unitsListEl = document.getElementById("unitsList");
  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");
  const saveStatus = document.getElementById("saveStatus");

  // ---------- تحميل بيانات المتدرب ----------
  const cached = localStorage.getItem("trainee");
  if (!cached) {
    window.location.href = "index.html";
    return;
  }
  let trainee = JSON.parse(cached);
  trainee.completedUnits = trainee.completedUnits || [];
  trainee.quizScores = trainee.quizScores || {};

  if (!COURSE_CONFIG.units || COURSE_CONFIG.units.length === 0) {
    loadingState.style.display = "none";
    errorState.style.display = "block";
    errorState.textContent = "لا يوجد محتوى مضاف في البرنامج حتى الآن.";
    return;
  }

  // ---------- بناء تسلسل الخطوات (موضوعات + اختبار كل وحدة) ----------
  function buildSequence() {
    const seq = [];
    COURSE_CONFIG.units.forEach((unit, unitIndex) => {
      unit.topics.forEach((topic, topicIndex) => {
        seq.push({ kind: "topic", unit, unitIndex, topic, topicIndex });
      });
      seq.push({ kind: "quiz", unit, unitIndex });
    });
    return seq;
  }
  const sequence = buildSequence();

  function findStepIndex(unitId, topicId) {
    if (!unitId) return 0;
    for (let i = 0; i < sequence.length; i++) {
      const s = sequence[i];
      if (s.unit.id !== unitId) continue;
      if (s.kind === "quiz" && topicId === "quiz") return i;
      if (s.kind === "topic" && s.topic.id === topicId) return i;
    }
    return 0;
  }

  let currentIndex = findStepIndex(trainee.lastUnitId, trainee.lastTopicId);
  let openUnitIds = new Set([sequence[currentIndex].unit.id]);

  // ---------- حفظ التقدم ----------
  let saveTimer = null;
  function persistProgress() {
    localStorage.setItem("trainee", JSON.stringify(trainee));
    saveStatus.textContent = "جاري الحفظ...";
    saveStatus.className = "save-status";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await apiSaveProgress(trainee);
        saveStatus.textContent = "تم الحفظ";
        setTimeout(() => { saveStatus.textContent = ""; }, 1500);
      } catch (err) {
        saveStatus.textContent = "تعذر حفظ التقدم على السيرفر";
        saveStatus.className = "save-status warn";
      }
    }, 400);
  }

  function goToStep(index) {
    currentIndex = index;
    const step = sequence[index];
    trainee.lastUnitId = step.unit.id;
    trainee.lastTopicId = step.kind === "quiz" ? "quiz" : step.topic.id;
    openUnitIds.add(step.unit.id);
    persistProgress();
    renderSidebar();
    renderViewer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- الشريط الجانبي ----------
  function renderSidebar() {
    document.getElementById("sidebarCourseTitle").textContent = COURSE_CONFIG.courseTitle;
    document.getElementById("sidebarAcademyName").textContent = COURSE_CONFIG.academyName;

    const doneSteps = currentIndex;
    const percent = Math.round((doneSteps / sequence.length) * 100);
    progressFill.style.width = percent + "%";
    progressLabel.textContent = percent + "% مكتمل";

    unitsListEl.innerHTML = "";
    COURSE_CONFIG.units.forEach((unit, unitIndex) => {
      const block = document.createElement("div");
      block.className = "unit-block" + (openUnitIds.has(unit.id) ? " open" : "");

      const header = document.createElement("div");
      header.className = "unit-header";
      header.innerHTML =
        '<span class="unit-name">الوحدة ' + (unitIndex + 1) + ': ' + escapeHtml(stripUnitPrefix(unit.title)) + '</span>' +
        '<span class="chevron">‹</span>';
      header.addEventListener("click", () => {
        if (openUnitIds.has(unit.id)) openUnitIds.delete(unit.id);
        else openUnitIds.add(unit.id);
        renderSidebar();
      });
      block.appendChild(header);

      const list = document.createElement("ul");
      list.className = "topic-list";

      unit.topics.forEach((topic, topicIndex) => {
        const stepIndex = findStepIndex(unit.id, topic.id);
        const li = document.createElement("li");
        const isCurrent = stepIndex === currentIndex;
        const isDone = stepIndex < currentIndex;
        li.innerHTML =
          '<span class="status-dot ' + (isCurrent ? "current" : isDone ? "done" : "") + '"></span>' +
          '<span>' + escapeHtml(topic.title) + '</span>';
        if (isCurrent) li.classList.add("active");
        li.addEventListener("click", () => goToStep(stepIndex));
        list.appendChild(li);
      });

      // عنصر الاختبار
      const quizStepIndex = findStepIndex(unit.id, "quiz");
      const quizLi = document.createElement("li");
      quizLi.className = "quiz-entry";
      const quizDone = trainee.completedUnits.includes(unit.id);
      const quizCurrent = quizStepIndex === currentIndex;
      quizLi.innerHTML =
        '<span class="status-dot ' + (quizCurrent ? "current" : quizDone ? "done" : "") + '"></span>' +
        '<span>اختبار الوحدة</span>';
      if (quizCurrent) quizLi.classList.add("active");
      quizLi.addEventListener("click", () => goToStep(quizStepIndex));
      list.appendChild(quizLi);

      block.appendChild(list);
      unitsListEl.appendChild(block);
    });
  }

  // ---------- عارض المحتوى ----------
  function renderViewer() {
    const step = sequence[currentIndex];
    document.getElementById("traineeNameLabel").textContent = "مرحبًا، " + trainee.name;

    if (step.kind === "topic") {
      renderTopicStep(step);
    } else {
      renderQuizStep(step);
    }
  }

  function renderTopicStep(step) {
    const kicker = "الوحدة " + (step.unitIndex + 1) + " · الموضوع " + (step.topicIndex + 1);
    let mediaHtml = "";

    if (step.topic.type === "video") {
      mediaHtml =
        '<div class="media-frame"><iframe src="https://www.youtube.com/embed/' +
        encodeURIComponent(step.topic.youtubeId) +
        '" allowfullscreen loading="lazy"></iframe></div>' +
        (step.topic.description ? '<p class="topic-body">' + escapeHtml(step.topic.description) + '</p>' : "");
    } else if (step.topic.type === "file") {
      const fileId = step.topic.driveFileId;
      mediaHtml =
        '<div class="file-frame"><iframe src="https://drive.google.com/file/d/' +
        encodeURIComponent(fileId) + '/preview" loading="lazy"></iframe></div>' +
        '<a class="file-fallback-link" target="_blank" rel="noopener" href="https://drive.google.com/file/d/' +
        encodeURIComponent(fileId) + '/view">فتح الملف في نافذة جديدة ↗</a>' +
        (step.topic.description ? '<p class="topic-body">' + escapeHtml(step.topic.description) + '</p>' : "");
    } else {
      mediaHtml = '<div class="topic-body">' + (step.topic.body || "") + '</div>';
    }

    const isFirst = currentIndex === 0;

    viewer.innerHTML =
      '<div class="topic-kicker">' + kicker + '</div>' +
      '<div class="content-card">' +
        '<h2>' + escapeHtml(step.topic.title) + '</h2>' +
        mediaHtml +
      '</div>' +
      '<div class="nav-row">' +
        '<button class="nav-btn" id="prevBtn" ' + (isFirst ? "disabled" : "") + '>السابق</button>' +
        '<button class="nav-btn primary" id="nextBtn">التالي</button>' +
      '</div>';

    document.getElementById("prevBtn").addEventListener("click", () => {
      if (currentIndex > 0) goToStep(currentIndex - 1);
    });
    document.getElementById("nextBtn").addEventListener("click", () => {
      if (currentIndex < sequence.length - 1) goToStep(currentIndex + 1);
    });
  }

  function renderQuizStep(step) {
    const unit = step.unit;
    const questions = unit.quiz.questions;
    const selected = new Array(questions.length).fill(null);

    function renderQuestions() {
      let html =
        '<div class="topic-kicker">الوحدة ' + (step.unitIndex + 1) + ' · اختبار قصير</div>' +
        '<div class="content-card">' +
          '<h2>اختبار: ' + escapeHtml(stripUnitPrefix(unit.title)) + '</h2>' +
          '<div class="quiz-progress">' + questions.length + ' أسئلة - إجابة صحيحة واحدة لكل سؤال</div>';

      questions.forEach((q, qIndex) => {
        html += '<div class="quiz-question" data-q="' + qIndex + '">';
        html += '<div class="q-text">' + (qIndex + 1) + '. ' + escapeHtml(q.question) + '</div>';
        html += '<div class="quiz-options">';
        q.options.forEach((opt, oIndex) => {
          html += '<div class="quiz-option" data-q="' + qIndex + '" data-o="' + oIndex + '">' + escapeHtml(opt) + '</div>';
        });
        html += '</div></div>';
      });

      html +=
        '<div class="nav-row" style="justify-content:flex-end;">' +
          '<button class="nav-btn primary" id="submitQuizBtn" disabled>تسليم الاختبار</button>' +
        '</div>' +
      '</div>';

      viewer.innerHTML = html;

      viewer.querySelectorAll(".quiz-option").forEach((el) => {
        el.addEventListener("click", () => {
          const q = parseInt(el.dataset.q, 10);
          const o = parseInt(el.dataset.o, 10);
          selected[q] = o;
          const group = viewer.querySelector('.quiz-question[data-q="' + q + '"]');
          group.querySelectorAll(".quiz-option").forEach((opt) => opt.classList.remove("selected"));
          el.classList.add("selected");
          const submitBtn = document.getElementById("submitQuizBtn");
          submitBtn.disabled = selected.some((v) => v === null);
        });
      });

      document.getElementById("submitQuizBtn").addEventListener("click", () => {
        let score = 0;
        questions.forEach((q, i) => { if (selected[i] === q.correctIndex) score++; });
        trainee.quizScores[unit.id] = score;
        const passed = score >= PASSING_SCORE;
        if (passed && !trainee.completedUnits.includes(unit.id)) {
          trainee.completedUnits.push(unit.id);
        }
        persistProgress();
        renderResult(score, passed);
      });
    }

    function renderResult(score, passed) {
      const hasNext = currentIndex < sequence.length - 1;
      viewer.innerHTML =
        '<div class="topic-kicker">الوحدة ' + (step.unitIndex + 1) + ' · نتيجة الاختبار</div>' +
        '<div class="content-card">' +
          '<div class="quiz-result ' + (passed ? "passed" : "failed") + '">' +
            '<div class="score-big">' + score + ' / ' + questions.length + '</div>' +
            '<span class="badge">' + (passed ? "اجتزت الاختبار" : "لم تحقق الحد الأدنى للنجاح") + '</span>' +
            '<p style="margin-top:18px; color:var(--color-ink-muted);">' +
              (passed
                ? "أحسنت! تقدر تكمل للوحدة اللي بعدها."
                : "الحد الأدنى للنجاح هو " + PASSING_SCORE + " من " + questions.length + "، جرّب تراجع محتوى الوحدة وتعيد الاختبار.") +
            '</p>' +
          '</div>' +
          '<div class="nav-row">' +
            '<button class="nav-btn" id="retryBtn">إعادة المحاولة</button>' +
            (hasNext
              ? '<button class="nav-btn primary" id="continueBtn">' + (passed ? "المتابعة للوحدة التالية" : "متابعة على أي حال") + '</button>'
              : '<span class="badge" style="align-self:center;">لقد أنهيت كل وحدات البرنامج 🎉</span>') +
          '</div>' +
        '</div>';

      document.getElementById("retryBtn").addEventListener("click", renderQuestions);
      if (hasNext) {
        document.getElementById("continueBtn").addEventListener("click", () => goToStep(currentIndex + 1));
      }
      renderSidebar();
    }

    renderQuestions();
  }

  // ---------- أدوات مساعدة ----------
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // بيشيل بادئة "الوحدة الأولى:" من العنوان لأننا بنعرضها منفصلة برقم
  function stripUnitPrefix(title) {
    return title.replace(/^الوحدة[^:：]*[:：]\s*/, "");
  }

  document.getElementById("logoutLink").addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("trainee");
    window.location.href = "index.html";
  });

  // ---------- بدء التشغيل ----------
  document.title = COURSE_CONFIG.courseTitle;
  loadingState.style.display = "none";
  appShell.style.display = "grid";
  renderSidebar();
  renderViewer();
})();
