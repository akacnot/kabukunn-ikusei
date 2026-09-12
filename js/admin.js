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
  missionList: document.querySelector("#missionList")
};

let app = null;
let auth = null;
let db = null;
let adminUser = null;
let firebaseAdminReady = false;

function loadGifts() {
  return JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || "{}");
}

function saveGifts(gifts) {
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(gifts));
  render();
}

function loadMissions() {
  return JSON.parse(localStorage.getItem(ADMIN_MISSION_STORAGE_KEY) || "[]");
}

function saveMissions(missions) {
  localStorage.setItem(ADMIN_MISSION_STORAGE_KEY, JSON.stringify(missions));
  render();
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
      : `Firebase接続済み: admin権限なし (${adminUser.uid})`;
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
  renderMissions();
}

function renderMissions() {
  const missions = loadMissions();
  els.missionList.innerHTML = missions.length
    ? missions
        .map(
          (mission) => `
            <article class="gift-card">
              <div>
                <strong>${mission.title}</strong>
                <span>${mission.metric} / ${mission.target} / ${mission.reset === "daily" ? "毎日" : "一回だけ"} / コイン${mission.reward.coins || 0} / えさ${mission.reward.food || 0}</span>
              </div>
              <button data-delete-mission="${mission.id}" class="danger">削除</button>
            </article>`
        )
        .join("")
    : "<p>保存中のミッションはありません。</p>";
}

async function saveGift() {
  const code = els.giftCode.value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return;
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
  }

  els.giftCode.value = "";
  els.giftLabel.value = "";
  render();
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

function saveMission() {
  const id = els.missionId.value.trim() || `admin_${Date.now()}`;
  const missions = loadMissions().filter((mission) => mission.id !== id);
  missions.push({
    id,
    title: els.missionTitle.value.trim() || "運営ミッション",
    metric: els.missionMetric.value,
    target: Math.max(1, Number(els.missionTarget.value || 1)),
    reset: els.missionReset.value,
    reward: {
      coins: Number(els.missionCoins.value || 0),
      food: Number(els.missionFood.value || 0)
    }
  });
  saveMissions(missions);
  els.missionId.value = "";
  els.missionTitle.value = "";
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
  render();
}

document.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-code]");
  if (deleteButton) deleteGift(deleteButton.dataset.deleteCode);

  const deleteMissionButton = event.target.closest("[data-delete-mission]");
  if (deleteMissionButton) {
    saveMissions(loadMissions().filter((mission) => mission.id !== deleteMissionButton.dataset.deleteMission));
  }
});

els.saveGift.addEventListener("click", saveGift);
els.saveMission.addEventListener("click", saveMission);
els.copyJson.addEventListener("click", () => navigator.clipboard?.writeText(els.jsonOutput.value));
els.downloadJson.addEventListener("click", downloadJson);
els.clearGifts.addEventListener("click", () => saveGifts({}));

await initFirebaseAdmin();
render();
