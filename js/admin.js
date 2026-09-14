import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const ADMIN_STORAGE_KEY = "kabukun-admin-gifts";
const ADMIN_MISSION_STORAGE_KEY = "kabukun-admin-missions";
const ADMIN_NOTICE_STORAGE_KEY = "kabukun-admin-notices";

const els = {
  giftCode: document.querySelector("#giftCode"),
  giftLabel: document.querySelector("#giftLabel"),
  giftCoins: document.querySelector("#giftCoins"),
  giftFood: document.querySelector("#giftFood"),
  giftUsageLimit: document.querySelector("#giftUsageLimit"),
  saveGift: document.querySelector("#saveGift"),
  giftList: document.querySelector("#giftList"),
  jsonOutput: document.querySelector("#jsonOutput"),
  copyJson: document.querySelector("#copyJson"),
  downloadJson: document.querySelector("#downloadJson"),
  clearGifts: document.querySelector("#clearGifts"),
  firebaseStatus: document.querySelector("#firebaseStatus"),
  missionId: document.querySelector("#missionId"),
  missionTitle: document.querySelector("#missionTitle"),
  missionMetric: document.querySelector("#missionMetric"),
  missionTarget: document.querySelector("#missionTarget"),
  missionCoins: document.querySelector("#missionCoins"),
  missionFood: document.querySelector("#missionFood"),
  missionReset: document.querySelector("#missionReset"),
  saveMission: document.querySelector("#saveMission"),
  missionList: document.querySelector("#missionList"),
  noticeId: document.querySelector("#noticeId"),
  noticeTitle: document.querySelector("#noticeTitle"),
  noticeBody: document.querySelector("#noticeBody"),
  saveNotice: document.querySelector("#saveNotice"),
  noticeList: document.querySelector("#noticeList")
};

let app = null;
let auth = null;
let db = null;
let adminUser = null;
let firebaseAdminReady = false;
let renderTimer = 0;

function loadGifts() {
  return JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || "{}");
}

function saveGifts(gifts) {
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(gifts));
  queueRender();
}

function loadMissions() {
  return JSON.parse(localStorage.getItem(ADMIN_MISSION_STORAGE_KEY) || "[]");
}

function saveMissions(missions) {
  localStorage.setItem(ADMIN_MISSION_STORAGE_KEY, JSON.stringify(missions));
  queueRender();
}

function loadNotices() {
  return JSON.parse(localStorage.getItem(ADMIN_NOTICE_STORAGE_KEY) || "[]");
}

function queueRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => render(), 0);
}

async function initFirebaseAdmin() {
  const config = window.KABUKUN_FIREBASE_CONFIG;
  if (!config?.apiKey || config.apiKey === "YOUR_API_KEY") {
    els.firebaseStatus.textContent = "Firebase未設定: ローカル保存のみ";
    return;
  }

  try {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    adminUser = await waitForAuthUser();
    const adminSnap = await getDoc(doc(db, "users", adminUser.uid));
    firebaseAdminReady = adminSnap.exists() && adminSnap.data().role === "admin";
    els.firebaseStatus.textContent = firebaseAdminReady
      ? `Firebase連携中: admin (${adminUser.uid})`
      : `ローカル保存のみ: Firebase保存には users/${adminUser.uid} に role: "admin" が必要`;
  } catch (error) {
    console.error("[Firebase] admin initialization failed", error);
    els.firebaseStatus.textContent = "Firebase接続エラー: Consoleを確認してください";
  }
}

async function waitForAuthUser() {
  const existingUser = await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
  if (existingUser) return existingUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

async function loadFirebasePromoCodes() {
  if (!firebaseAdminReady) return {};
  try {
    const snapshot = await getDocs(collection(db, "promoCodes"));
    return Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data()]));
  } catch (error) {
    console.error("[Firebase] promo code load failed", error);
    return {};
  }
}

async function loadFirebaseMissions() {
  if (!firebaseAdminReady) return [];
  try {
    const snapshot = await getDocs(collection(db, "adminMissions"));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.error("[Firebase] mission load failed", error);
    return [];
  }
}

async function loadFirebaseNotices() {
  if (!firebaseAdminReady) return [];
  try {
    const snapshot = await getDocs(collection(db, "adminNotices"));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.error("[Firebase] notice load failed", error);
    return [];
  }
}

async function render() {
  const localGifts = loadGifts();
  const firebaseGifts = await loadFirebasePromoCodes();
  const gifts = { ...localGifts, ...firebaseGifts };
  const entries = Object.entries(gifts);
  els.giftList.innerHTML = entries.length
    ? entries
        .map(
          ([code, gift]) => `
            <article class="gift-card">
              <div>
                <strong>${code}</strong>
                <span>${gift.label} / コイン${gift.rewards?.coins || 0} / えさ${gift.rewards?.food || 0} / ${gift.usedCount || 0}/${gift.usageLimit || 1}回使用</span>
              </div>
              <button data-delete-code="${code}" class="danger">削除</button>
            </article>`
        )
        .join("")
    : "<p>保存中の配布コードはありません。</p>";
  els.jsonOutput.value = JSON.stringify(gifts, null, 2);
  await renderMissions();
  await renderNotices();
}

async function renderMissions() {
  const localMissions = loadMissions();
  const firebaseMissions = await loadFirebaseMissions();
  const byId = new Map();
  [...localMissions, ...firebaseMissions].forEach((mission) => byId.set(mission.id, mission));
  const missions = [...byId.values()];
  els.missionList.innerHTML = missions.length
    ? missions
        .map(
          (mission) => `
            <article class="gift-card">
              <div>
                <strong>${mission.title}</strong>
                <span>${mission.metric} / ${mission.target} / ${mission.reset === "daily" ? "毎日" : "一回だけ"} / コイン${mission.reward?.coins || 0} / えさ${mission.reward?.food || 0}${mission.enabled === false ? " / 停止中" : ""}</span>
              </div>
              <button data-delete-mission="${mission.id}" class="danger">削除</button>
            </article>`
        )
        .join("")
    : "<p>保存中のミッションはありません。</p>";
}

async function renderNotices() {
  const localNotices = loadNotices();
  const firebaseNotices = await loadFirebaseNotices();
  const byId = new Map();
  [...localNotices, ...firebaseNotices].forEach((notice) => byId.set(notice.id, notice));
  const notices = [...byId.values()];
  els.noticeList.innerHTML = notices.length
    ? notices
        .map(
          (notice) => `
            <article class="gift-card">
              <div>
                <strong>${notice.title || "お知らせ"}</strong>
                <span>${notice.id} / ${notice.enabled === false ? "停止中" : "公開中"}</span>
              </div>
              <button data-delete-notice="${notice.id}" class="danger">削除</button>
            </article>`
        )
        .join("")
    : "<p>保存中のお知らせはありません。</p>";
}

async function saveGift() {
  const code = els.giftCode.value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    els.firebaseStatus.textContent = "コードは3〜32文字の英数字・_・-で入力してください";
    return;
  }
  const gift = {
    label: els.giftLabel.value.trim() || "運営配布",
    rewards: {
      coins: Number(els.giftCoins.value || 0),
      food: Number(els.giftFood.value || 0)
    },
    usageLimit: Math.max(1, Number(els.giftUsageLimit.value || 1)),
    usedCount: 0,
    redeemedBy: [],
    enabled: true
  };
  const gifts = loadGifts();
  gifts[code] = gift;
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(gifts));
  els.firebaseStatus.textContent = `ローカル保存しました: ${code}`;

  if (firebaseAdminReady) {
    try {
      await setDoc(doc(db, "promoCodes", code), {
        ...gift,
        createdBy: adminUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      els.firebaseStatus.textContent = `Firebaseへ保存しました: ${code}`;
    } catch (error) {
      console.error("[Firebase] promo code save failed", error);
      els.firebaseStatus.textContent = "Firebase保存に失敗: Consoleを確認してください";
    }
  } else if (db && adminUser) {
    els.firebaseStatus.textContent = `ローカル保存しました: Firebase保存には users/${adminUser.uid} に role: "admin" が必要`;
  }

  els.giftCode.value = "";
  els.giftLabel.value = "";
  queueRender();
}

function downloadJson() {
  const blob = new Blob([els.jsonOutput.value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "kabukun-gift-codes.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function saveMission() {
  const id = els.missionId.value.trim() || `admin_${Date.now()}`;
  const missions = loadMissions().filter((mission) => mission.id !== id);
  const mission = {
    id,
    title: els.missionTitle.value.trim() || "運営ミッション",
    metric: els.missionMetric.value,
    target: Math.max(1, Number(els.missionTarget.value || 1)),
    reset: els.missionReset.value,
    reward: {
      coins: Number(els.missionCoins.value || 0),
      food: Number(els.missionFood.value || 0)
    },
    enabled: true
  };
  missions.push(mission);
  localStorage.setItem(ADMIN_MISSION_STORAGE_KEY, JSON.stringify(missions));
  els.firebaseStatus.textContent = `ミッションをローカル保存しました: ${id}`;

  if (firebaseAdminReady) {
    try {
      await setDoc(doc(db, "adminMissions", id), {
        ...mission,
        createdBy: adminUser.uid,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      els.firebaseStatus.textContent = `ミッションをFirebaseへ保存しました: ${id}`;
    } catch (error) {
      console.error("[Firebase] mission save failed", error);
      els.firebaseStatus.textContent = "ミッションのFirebase保存に失敗: Consoleを確認してください";
    }
  } else if (db && adminUser) {
    els.firebaseStatus.textContent = `ミッションをローカル保存しました: Firebase保存には users/${adminUser.uid} に role: "admin" が必要`;
  }

  els.missionId.value = "";
  els.missionTitle.value = "";
  queueRender();
}

async function saveNotice() {
  const id = els.noticeId.value.trim() || `notice_${Date.now()}`;
  if (!/^[A-Za-z0-9_-]{3,48}$/.test(id)) {
    els.firebaseStatus.textContent = "お知らせIDは3〜48文字の英数字・_・-で入力してください";
    return;
  }

  const notice = {
    id,
    title: els.noticeTitle.value.trim() || "運営からのお知らせ",
    body: els.noticeBody.value.trim() || "お知らせ本文を入力してください。",
    enabled: true
  };
  const notices = loadNotices().filter((item) => item.id !== id);
  notices.push(notice);
  localStorage.setItem(ADMIN_NOTICE_STORAGE_KEY, JSON.stringify(notices));
  els.firebaseStatus.textContent = `お知らせをローカル保存しました: ${id}`;

  if (firebaseAdminReady) {
    try {
      await setDoc(doc(db, "adminNotices", id), {
        ...notice,
        createdBy: adminUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      els.firebaseStatus.textContent = `お知らせをFirebaseへ保存しました: ${id}`;
    } catch (error) {
      console.error("[Firebase] notice save failed", error);
      els.firebaseStatus.textContent = "お知らせのFirebase保存に失敗: Consoleを確認してください";
    }
  } else if (db && adminUser) {
    els.firebaseStatus.textContent = `お知らせをローカル保存しました: Firebase保存には users/${adminUser.uid} に role: "admin" が必要`;
  }

  els.noticeId.value = "";
  els.noticeTitle.value = "";
  els.noticeBody.value = "";
  queueRender();
}

async function deleteGift(code) {
  const gifts = loadGifts();
  delete gifts[code];
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(gifts));
  if (firebaseAdminReady) {
    try {
      await deleteDoc(doc(db, "promoCodes", code));
    } catch (error) {
      console.error("[Firebase] promo code delete failed", error);
    }
  }
  queueRender();
}

document.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-code]");
  if (deleteButton) deleteGift(deleteButton.dataset.deleteCode);

  const deleteMissionButton = event.target.closest("[data-delete-mission]");
  if (deleteMissionButton) {
    deleteMission(deleteMissionButton.dataset.deleteMission);
  }

  const deleteNoticeButton = event.target.closest("[data-delete-notice]");
  if (deleteNoticeButton) deleteNotice(deleteNoticeButton.dataset.deleteNotice);
});

async function deleteMission(id) {
  localStorage.setItem(
    ADMIN_MISSION_STORAGE_KEY,
    JSON.stringify(loadMissions().filter((mission) => mission.id !== id))
  );
  if (firebaseAdminReady) {
    try {
      await deleteDoc(doc(db, "adminMissions", id));
      els.firebaseStatus.textContent = `ミッションを削除しました: ${id}`;
    } catch (error) {
      console.error("[Firebase] mission delete failed", error);
      els.firebaseStatus.textContent = "ミッションのFirebase削除に失敗: Consoleを確認してください";
    }
  }
  queueRender();
}

async function deleteNotice(id) {
  localStorage.setItem(
    ADMIN_NOTICE_STORAGE_KEY,
    JSON.stringify(loadNotices().filter((notice) => notice.id !== id))
  );
  if (firebaseAdminReady) {
    try {
      await deleteDoc(doc(db, "adminNotices", id));
      els.firebaseStatus.textContent = `お知らせを削除しました: ${id}`;
    } catch (error) {
      console.error("[Firebase] notice delete failed", error);
      els.firebaseStatus.textContent = "お知らせのFirebase削除に失敗: Consoleを確認してください";
    }
  }
  queueRender();
}

els.saveGift.addEventListener("click", saveGift);
els.saveMission.addEventListener("click", saveMission);
els.saveNotice.addEventListener("click", saveNotice);
els.copyJson.addEventListener("click", () => navigator.clipboard?.writeText(els.jsonOutput.value));
els.downloadJson.addEventListener("click", downloadJson);
els.clearGifts.addEventListener("click", () => saveGifts({}));

await initFirebaseAdmin();
render();
