/*
  ==========================================================================
  الاتصال بجوجل شيت عن طريق Google Apps Script
  ==========================================================================
  حط هنا رابط الـ Web App اللي هتاخده بعد ما تنشر ملف Code.gs
  (شرح كامل للخطوات موجود في README.md)
*/

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw9uulD7UmaIzLo_B4jnJIJ6aKVuhPb1Co2BQ6yfPnVT_hHa1_CEBaFXdaAB6GOM6DT/exec";

function isApiConfigured() {
  return typeof APPS_SCRIPT_URL === "string" &&
    APPS_SCRIPT_URL.startsWith("http");
}

async function callBackend(payload) {
  if (!isApiConfigured()) {
    throw new Error(
      "لسه محددتش رابط الـ Google Apps Script. افتح assets/js/api.js وحط الرابط في APPS_SCRIPT_URL."
    );
  }
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    // مهم: text/plain بدل application/json عشان نتفادى مشاكل CORS مع Apps Script
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error("حصل خطأ في الاتصال بالسيرفر (" + res.status + ")");
  }
  const data = await res.json();
  if (data && data.error) {
    throw new Error(data.error);
  }
  return data;
}

/** تسجيل الدخول: بيرجع بيانات المتدرب لو موجود، أو يسجله كمتدرب جديد */
function apiLogin(code, name) {
  return callBackend({ action: "login", code, name });
}

/** حفظ آخر نقطة توصل لها المتدرب + حالة إنجاز الوحدات + درجات الاختبارات */
function apiSaveProgress(state) {
  return callBackend({
    action: "saveProgress",
    code: state.code,
    name: state.name,
    lastUnitId: state.lastUnitId || "",
    lastTopicId: state.lastTopicId || "",
    completedUnits: state.completedUnits || [],
    quizScores: state.quizScores || {}
  });
}
