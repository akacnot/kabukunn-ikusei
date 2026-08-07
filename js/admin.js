const ADMIN_STORAGE_KEY = "kabukun-admin-gifts";
const ADMIN_MISSION_STORAGE_KEY = "kabukun-admin-missions";

const els = {
  giftCode: document.querySelector("#giftCode"),
  giftLabel: document.querySelector("#giftLabel"),
  giftCoins: document.querySelector("#giftCoins"),
  giftFood: document.querySelector("#giftFood"),
  saveGift: document.querySelector("#saveGift"),
  giftList: document.querySelector("#giftList"),
  jsonOutput: document.querySelector("#jsonOutput"),
  copyJson: document.querySelector("#copyJson"),
  downloadJson: document.querySelector("#downloadJson"),
  clearGifts: document.querySelector("#clearGifts")
};

Object.assign(els, {
  missionId: document.querySelector("#missionId"),
  missionTitle: document.querySelector("#missionTitle"),
  missionMetric: document.querySelector("#missionMetric"),
  missionTarget: document.querySelector("#missionTarget"),
  missionCoins: document.querySelector("#missionCoins"),
  missionFood: document.querySelector("#missionFood"),
  missionReset: document.querySelector("#missionReset"),
  saveMission: document.querySelector("#saveMission"),
  missionList: document.querySelector("#missionList")
});

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

function render() {
  const gifts = loadGifts();
  const entries = Object.entries(gifts);
  els.giftList.innerHTML = entries.length
    ? entries
        .map(
          ([code, gift]) => `
            <article class="gift-card">
              <div>
                <strong>${code}</strong>
                <span>${gift.label} / コイン${gift.rewards.coins || 0} / えさ${gift.rewards.food || 0}</span>
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

function saveGift() {
  const code = els.giftCode.value.trim().toUpperCase();
  if (!code) return;
  const gifts = loadGifts();
  gifts[code] = {
    label: els.giftLabel.value.trim() || "運営配布",
    rewards: {
      coins: Number(els.giftCoins.value || 0),
      food: Number(els.giftFood.value || 0)
    }
  };
  saveGifts(gifts);
  els.giftCode.value = "";
  els.giftLabel.value = "";
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

document.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-code]");
  if (deleteButton) {
    const gifts = loadGifts();
    delete gifts[deleteButton.dataset.deleteCode];
    saveGifts(gifts);
  }

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

render();
