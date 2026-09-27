(function () {
  const form = document.getElementById("loginForm");
  const submitBtn = document.getElementById("submitBtn");
  const messageBox = document.getElementById("formMessage");

  // تعبئة عناوين الصفحة من ملف الإعدادات
  document.getElementById("academyNameLabel").textContent = COURSE_CONFIG.academyName;
  document.getElementById("courseTitleLabel").textContent = "تسجيل الدخول - " + COURSE_CONFIG.courseTitle;
  document.getElementById("courseSubtitleLabel").textContent = COURSE_CONFIG.courseSubtitle;
  document.title = "تسجيل الدخول - " + COURSE_CONFIG.courseTitle;

  function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.className = "form-message " + type;
  }

  // لو المتدرب سجّل قبل كده على نفس الجهاز، نعبّي بياناته تلقائيًا
  const cached = localStorage.getItem("trainee");
  if (cached) {
    try {
      const t = JSON.parse(cached);
      document.getElementById("nameInput").value = t.name || "";
      document.getElementById("codeInput").value = t.code || "";
    } catch (e) { /* تجاهل أي بيانات محلية تالفة */ }
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const name = document.getElementById("nameInput").value.trim();
    const code = document.getElementById("codeInput").value.trim();

    if (!name || !code) {
      showMessage("من فضلك اكتب الاسم والكود.", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "جاري التحقق...";
    messageBox.className = "form-message";

    try {
      const result = await apiLogin(code, name);

      const traineeState = {
        code: code,
        name: name,
        lastUnitId: result.lastUnitId || "",
        lastTopicId: result.lastTopicId || "",
        completedUnits: result.completedUnits || [],
        quizScores: result.quizScores || {}
      };
      localStorage.setItem("trainee", JSON.stringify(traineeState));

      window.location.href = "course.html";
    } catch (err) {
      showMessage(err.message || "حصل خطأ غير متوقع، حاول تاني.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "ابدأ / متابعة التدريب";
    }
  });
})();
