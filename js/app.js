const state = Store.load();

const els = {
  screens: document.querySelectorAll(".screen"),
  titleKabuImage: document.querySelector("#titleKabuImage"),
  kabukunImage: document.querySelector("#kabukunImage"),
  roomImage: document.querySelector("#roomImage"),
  coinCount: document.querySelector("#coinCount"),
  foodCount: document.querySelector("#foodCount"),
  friendshipValue: document.querySelector("#friendshipValue"),
  feedButton: document.querySelector("#feedButton"),
  earnButton: document.querySelector("#earnButton"),
  minigameButton: document.querySelector("#minigameButton"),
  photoButton: document.querySelector("#photoButton"),
  photoInput: document.querySelector("#photoInput"),
  kabukunButton: document.querySelector("#kabukunButton"),
  moodBubble: document.querySelector("#moodBubble"),
  modalLayer: document.querySelector("#modalLayer"),
  modalTitle: document.querySelector("#modalTitle"),
  modalBody: document.querySelector("#modalBody"),
  closeModal: document.querySelector("#closeModal"),
  toast: document.querySelector("#toast")
};

let toastTimer = 0;
let earnTimer = 0;
let miniGame = null;

function persist() {
  Store.save(state);
  renderHud();
}

function routeTo(name) {
  els.screens.forEach((screen) => screen.classList.remove("is-active"));
  document.querySelector(`#${name}Screen`).classList.add("is-active");
  closeModal();
}

function renderImages() {
  const kabuImage = state.customKabuImage || GAME_CONFIG.images.kabukun;
  els.titleKabuImage.src = kabuImage;
  els.kabukunImage.src = kabuImage;
  els.roomImage.src = GAME_CONFIG.images.room;

  document.querySelectorAll("[data-ui-image]").forEach((image) => {
    const key = image.dataset.uiImage;
    image.src = GAME_CONFIG.images[key];
  });
}

function renderHud() {
  els.coinCount.textContent = state.coins.toLocaleString("ja-JP");
  els.foodCount.textContent = state.food.toLocaleString("ja-JP");
  els.friendshipValue.textContent = state.friendship.toLocaleString("ja-JP");
  renderEarnButton();
}

function renderEarnButton() {
  const remaining = getEarnRemainingMs();
  if (remaining <= 0) {
    els.earnButton.disabled = false;
    els.earnButton.textContent = "おてつだいでコインをもらう";
    return;
  }

  els.earnButton.disabled = true;
  els.earnButton.textContent = `次のおてつだいまで ${Math.ceil(remaining / 1000)}秒`;
}

function getEarnRemainingMs() {
  const cooldown = GAME_CONFIG.earnCoins.cooldownMs;
  return Math.max(0, state.lastEarnedAt + cooldown - Date.now());
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 1900);
}

function feedKabukun() {
  if (state.food <= 0) {
    showToast("えさがありません。ショップで買えます。");
    openShop();
    return;
  }

  state.food -= 1;
  state.friendship += 1;
  state.fedCount += 1;
  els.moodBubble.textContent = "おいしい！";
  playHappyMotion();
  persist();
  showToast("かぶくんがよろこんでいます");
}

function earnCoins() {
  if (getEarnRemainingMs() > 0) return;

  const { rewardMin, rewardMax } = GAME_CONFIG.earnCoins;
  const reward = Math.floor(Math.random() * (rewardMax - rewardMin + 1)) + rewardMin;
  state.coins += reward;
  state.earnedCoins += reward;
  state.lastEarnedAt = Date.now();
  els.moodBubble.textContent = `+${reward}コイン！`;
  playHappyMotion();
  persist();
  showToast(`おてつだい成功！ ${reward}コイン獲得`);
}

function playHappyMotion() {
  els.kabukunButton.classList.remove("is-happy");
  void els.kabukunButton.offsetWidth;
  els.kabukunButton.classList.add("is-happy");
}

function choosePhoto(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("画像ファイルを選んでください");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    state.customKabuImage = reader.result;
    persist();
    renderImages();
    showToast("写真を設定しました");
  };
  reader.readAsDataURL(file);
}

function openModal(title, bodyHtml) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = bodyHtml;
  els.modalLayer.classList.add("is-open");
  els.modalLayer.setAttribute("aria-hidden", "false");
}

function closeModal() {
  stopMinigame();
  els.modalLayer.classList.remove("is-open");
  els.modalLayer.setAttribute("aria-hidden", "true");
}

function openShop(activeTab = "items") {
  openModal("ショップ", renderShop(activeTab));
}

function renderShop(activeTab) {
  const tabs = `
    <div class="tab-row">
      <button class="tab-btn ${activeTab === "items" ? "is-active" : ""}" data-shop-tab="items">えさ</button>
      <button class="tab-btn ${activeTab === "gift" ? "is-active" : ""}" data-shop-tab="gift">ギフトコード</button>
    </div>
  `;

  if (activeTab === "gift") {
    return `${tabs}
      <section class="gift-panel">
        <p class="gift-note">コードを入力すると特典を受け取れます。例: KABU100 / WELCOME</p>
        <input id="giftInput" class="gift-input" type="text" inputmode="latin" autocomplete="off" placeholder="コードを入力" />
        <button class="gift-submit" data-action="redeem-gift">受け取る</button>
      </section>`;
  }

  const items = GAME_CONFIG.shopItems
    .map(
      (item) => `
        <article class="shop-item">
          <img class="item-icon" src="${item.image}" alt="" />
          <div>
            <div class="item-name">${item.name}</div>
            <div class="item-desc">${item.description}</div>
          </div>
          <button class="buy-btn" data-buy-item="${item.id}" ${state.coins < item.price ? "disabled" : ""}>🪙${item.price}</button>
        </article>`
    )
    .join("");

  return `${tabs}<div class="shop-list">${items}</div>`;
}

function buyItem(itemId) {
  const item = GAME_CONFIG.shopItems.find((shopItem) => shopItem.id === itemId);
  if (!item) return;
  if (state.coins < item.price) {
    showToast("コインが足りません");
    return;
  }

  state.coins -= item.price;
  state.food += item.foodAmount;
  persist();
  openShop("items");
  showToast(`${item.name}を買いました`);
}

function redeemGift() {
  const input = document.querySelector("#giftInput");
  const code = input.value.trim().toUpperCase();
  const gift = GAME_CONFIG.giftCodes[code];

  if (!code) {
    showToast("コードを入力してください");
    return;
  }
  if (!gift) {
    showToast("コードが見つかりません");
    return;
  }
  if (state.redeemedGiftCodes.includes(code)) {
    showToast("このコードは受け取り済みです");
    return;
  }

  state.coins += gift.rewards.coins || 0;
  state.food += gift.rewards.food || 0;
  state.redeemedGiftCodes.push(code);
  persist();
  input.value = "";
  showToast(`${gift.label}を受け取りました`);
}

function openMissions() {
  openModal("ミッション", renderMissions());
}

function getMissionProgress(mission) {
  return Math.min(state[mission.metric] || 0, mission.target);
}

function renderMissions() {
  const missions = GAME_CONFIG.missions
    .map((mission) => {
      const progress = getMissionProgress(mission);
      const completed = progress >= mission.target;
      const claimed = state.claimedMissions.includes(mission.id);
      const rewardText = `報酬: 🪙${mission.reward.coins || 0}${mission.reward.food ? ` / えさ${mission.reward.food}こ` : ""}`;
      return `
        <article class="mission-card">
          <div class="mission-top">
            <div>
              <div class="mission-title">${mission.title}</div>
              <div class="mission-reward">${rewardText}</div>
            </div>
            <span class="mission-badge">${claimed ? "受取済み" : completed ? "達成" : "挑戦中"}</span>
          </div>
          <div class="progress-track" aria-label="${progress}/${mission.target}">
            <div class="progress-fill" style="width: ${(progress / mission.target) * 100}%"></div>
          </div>
          <div class="mission-bottom">
            <strong>${progress}/${mission.target}</strong>
            <button class="claim-btn" data-claim-mission="${mission.id}" ${!completed || claimed ? "disabled" : ""}>
              ${claimed ? "受取済み" : "受け取る"}
            </button>
          </div>
        </article>`;
    })
    .join("");

  return `<div class="mission-list">${missions}</div>`;
}

function claimMission(missionId) {
  const mission = GAME_CONFIG.missions.find((item) => item.id === missionId);
  if (!mission || state.claimedMissions.includes(missionId)) return;
  if (getMissionProgress(mission) < mission.target) {
    showToast("まだ達成していません");
    return;
  }

  state.coins += mission.reward.coins || 0;
  state.food += mission.reward.food || 0;
  state.claimedMissions.push(missionId);
  persist();
  openMissions();
  showToast("報酬を受け取りました");
}

function openMinigame() {
  openModal("かぶキャッチ", `
    <section class="minigame-panel">
      <div class="minigame-score">
        <span>残り <strong id="miniTime">12</strong>秒</span>
        <span>スコア <strong id="miniScore">0</strong></span>
      </div>
      <div id="miniField" class="mini-field">
        <div class="mini-player">🥬</div>
      </div>
      <button class="primary-btn" data-action="start-minigame">スタート</button>
      <p class="gift-note">落ちてくるコインをタップして集めよう。爆弾は減点です。</p>
    </section>
  `);
}

function startMinigame() {
  stopMinigame();
  const field = document.querySelector("#miniField");
  const scoreEl = document.querySelector("#miniScore");
  const timeEl = document.querySelector("#miniTime");
  if (!field || !scoreEl || !timeEl) return;

  miniGame = {
    score: 0,
    misses: 0,
    endsAt: Date.now() + GAME_CONFIG.minigame.durationMs,
    spawnTimer: 0,
    tickTimer: 0
  };

  field.innerHTML = `<div class="mini-player">🥬</div>`;
  scoreEl.textContent = "0";

  miniGame.spawnTimer = setInterval(spawnMiniItem, 620);
  miniGame.tickTimer = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((miniGame.endsAt - Date.now()) / 1000));
    timeEl.textContent = String(remaining);
    if (remaining <= 0) finishMinigame();
  }, 250);
  spawnMiniItem();
}

function spawnMiniItem() {
  const field = document.querySelector("#miniField");
  const scoreEl = document.querySelector("#miniScore");
  if (!miniGame || !field || !scoreEl) return;

  const item = document.createElement("button");
  const isBomb = Math.random() < 0.2;
  item.className = `mini-item ${isBomb ? "is-bomb" : ""}`;
  item.type = "button";
  item.textContent = isBomb ? "💣" : "🪙";
  item.style.left = `${Math.floor(Math.random() * 78) + 6}%`;
  item.style.animationDuration = `${Math.random() * 0.8 + 1.7}s`;
  item.addEventListener("click", () => {
    if (!miniGame) return;
    if (isBomb) {
      miniGame.score = Math.max(0, miniGame.score - GAME_CONFIG.minigame.missPenalty);
    } else {
      miniGame.score += 1;
    }
    scoreEl.textContent = String(miniGame.score);
    item.remove();
  });
  item.addEventListener("animationend", () => item.remove());
  field.appendChild(item);
}

function finishMinigame() {
  if (!miniGame) return;
  const reward = Math.min(miniGame.score * GAME_CONFIG.minigame.rewardPerCatch, GAME_CONFIG.minigame.maxReward);
  state.coins += reward;
  state.minigameCoins += reward;
  state.minigamePlays += 1;
  persist();
  stopMinigame();
  openModal("結果", `
    <section class="result-panel">
      <div class="result-coin">🪙 ${reward}</div>
      <p class="gift-note">かぶキャッチで ${reward} コイン獲得しました。</p>
      <button class="primary-btn" data-action="open-minigame">もう一度あそぶ</button>
    </section>
  `);
}

function stopMinigame() {
  if (!miniGame) return;
  clearInterval(miniGame.spawnTimer);
  clearInterval(miniGame.tickTimer);
  miniGame = null;
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    const modalButton = event.target.closest("[data-modal]");
    const actionButton = event.target.closest("[data-action]");
    const shopTabButton = event.target.closest("[data-shop-tab]");
    const buyButton = event.target.closest("[data-buy-item]");
    const claimButton = event.target.closest("[data-claim-mission]");

    if (routeButton) routeTo(routeButton.dataset.route);
    if (modalButton?.dataset.modal === "shop") openShop();
    if (modalButton?.dataset.modal === "missions") openMissions();
    if (actionButton?.dataset.action === "show-preparing") showToast("準備中です");
    if (actionButton?.dataset.action === "redeem-gift") redeemGift();
    if (actionButton?.dataset.action === "start-minigame") startMinigame();
    if (actionButton?.dataset.action === "open-minigame") openMinigame();
    if (shopTabButton) openShop(shopTabButton.dataset.shopTab);
    if (buyButton) buyItem(buyButton.dataset.buyItem);
    if (claimButton) claimMission(claimButton.dataset.claimMission);
  });

  els.closeModal.addEventListener("click", closeModal);
  els.modalLayer.addEventListener("click", (event) => {
    if (event.target === els.modalLayer) closeModal();
  });
  els.feedButton.addEventListener("click", feedKabukun);
  els.earnButton.addEventListener("click", earnCoins);
  els.minigameButton.addEventListener("click", openMinigame);
  els.photoButton.addEventListener("click", () => els.photoInput.click());
  els.photoInput.addEventListener("change", (event) => choosePhoto(event.target.files[0]));
  els.kabukunButton.addEventListener("click", feedKabukun);
}

function init() {
  // LIFF IDが決まったら、ここでliff.initを呼び出す構成にできます。
  bindEvents();
  renderImages();
  renderHud();
  earnTimer = setInterval(renderEarnButton, 1000);
  window.addEventListener("beforeunload", () => clearInterval(earnTimer));
}

init();
