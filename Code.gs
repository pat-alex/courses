/*
  ==========================================================================
  الكود الخلفي (Backend) لمنصة التدريب - Google Apps Script
  ==========================================================================
  الشرح الكامل لخطوات النشر موجود في README.md الرئيسي.

  ملخص سريع:
  1) افتح Google Sheet جديد (أو استخدم الموجود).
  2) من قائمة "Extensions / الإضافات" افتح "Apps Script".
  3) امسح أي كود موجود، والصق الكود ده بالكامل.
  4) من زر "Deploy / نشر" اختر "New deployment / نشر جديد":
        - Type: Web app
        - Execute as: Me
        - Who has access: Anyone
  5) خد رابط الـ Web App اللي هيظهر لك، وحطه في ملف
     assets/js/api.js داخل المتغير APPS_SCRIPT_URL.
  ==========================================================================
*/

const SHEET_NAME = "Progress"; // اسم التبويب اللي هيتسجل فيه بيانات المتدربين
const HEADERS = ["Code", "Name", "LastUnitId", "LastTopicId", "CompletedUnits", "QuizScores", "LastUpdated"];

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === "getProgress") {
      const code = String(e.parameter.code || "").trim();
      if (!code) return jsonOutput({ error: "الكود مطلوب" });
      const row = findRowByCode(code);
      if (!row) return jsonOutput({ found: false });
      return jsonOutput(rowToProgress(row));
    }
    return jsonOutput({ status: "الخدمة شغالة. استخدم POST لتسجيل الدخول أو حفظ التقدم." });
  } catch (err) {
    return jsonOutput({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "login") {
      return jsonOutput(loginOrRegister(body));
    }
    if (action === "saveProgress") {
      saveProgress(body);
      return jsonOutput({ success: true });
    }
    return jsonOutput({ error: "إجراء غير معروف: " + action });
  } catch (err) {
    return jsonOutput({ error: err.message });
  }
}

// ---------------------------------------------------------------------
// دوال الشيت
// ---------------------------------------------------------------------

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRowIndexByCode(code) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === code) return i + 1; // رقم الصف (1-based)
  }
  return -1;
}

function findRowByCode(code) {
  const rowIndex = findRowIndexByCode(code);
  if (rowIndex === -1) return null;
  return getSheet().getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
}

function rowToProgress(row) {
  return {
    found: true,
    code: row[0],
    name: row[1],
    lastUnitId: row[2] || "",
    lastTopicId: row[3] || "",
    completedUnits: row[4] ? String(row[4]).split(",").filter(Boolean) : [],
    quizScores: row[5] ? JSON.parse(row[5]) : {},
    lastUpdated: row[6]
  };
}

function loginOrRegister(body) {
  const code = String(body.code || "").trim();
  const name = String(body.name || "").trim();
  if (!code || !name) return { error: "الاسم والكود مطلوبين" };

  const sheet = getSheet();
  const rowIndex = findRowIndexByCode(code);

  if (rowIndex === -1) {
    sheet.appendRow([code, name, "", "", "", "{}", new Date()]);
    return {
      found: false,
      code: code,
      name: name,
      lastUnitId: "",
      lastTopicId: "",
      completedUnits: [],
      quizScores: {}
    };
  }

  const row = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
  // تحديث الاسم لو اتغيّر
  sheet.getRange(rowIndex, 2).setValue(name);
  return rowToProgress(row);
}

function saveProgress(body) {
  const code = String(body.code || "").trim();
  const name = String(body.name || "").trim();
  if (!code) throw new Error("الكود مطلوب");

  const sheet = getSheet();
  let rowIndex = findRowIndexByCode(code);
  if (rowIndex === -1) {
    sheet.appendRow([code, name, "", "", "", "{}", new Date()]);
    rowIndex = sheet.getLastRow();
  }

  const lastUnitId = body.lastUnitId || "";
  const lastTopicId = body.lastTopicId || "";
  const completedUnits = Array.isArray(body.completedUnits) ? body.completedUnits.join(",") : "";
  const quizScores = JSON.stringify(body.quizScores || {});

  sheet.getRange(rowIndex, 2, 1, 6).setValues([[
    name || sheet.getRange(rowIndex, 2).getValue(),
    lastUnitId,
    lastTopicId,
    completedUnits,
    quizScores,
    new Date()
  ]]);
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
