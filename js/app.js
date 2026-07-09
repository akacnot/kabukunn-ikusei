const state = Store.load();

const els = {
  screens: document.querySelectorAll(".screen"),
  coinCount: document.querySelector("#coinCount"),
  foodCount: document.querySelector("#foodCount"),
  friendshipValue: document.querySelector("#friendshipValue"),
  feedButton: document.querySelector("#feedButton"),
  kabukunButton: document.querySelector("#kabukunButton"),
  moodBubble: document.querySelector("#moodBubble"),
  modalLayer: document.querySelector("#modalLayer"),
  modalTitle: document.querySelector("#modalTitle"),
  modalBody: document.querySelector("#modalBody"),
  closeModal: document.querySelector("#closeModal"),
  toast: document.querySelector("#toast")
};

let toastTimer = 0;

function persist() {
  Store.save(state);
  renderHud();
}

function routeTo(name) {
  els.screens.forEach((screen) => screen.classList.remove("is-active"));
  document.querySelector(`#${name}Screen`).classList.add("is-active");
  closeModal();
}

function renderHud() {
  els.coinCount.textContent = state.coins.toLocaleString("ja-JP");
  els.foodCount.textContent = state.food.toLocaleString("ja-JP");
  els.friendshipValue.textContent = state.friendship.toLocaleString("ja-JP");
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
  els.kabukunButton.classList.remove("is-happy");
  void els.kabukunButton.offsetWidth;
  els.kabukunButton.classList.add("is-happy");
  persist();
  showToast("かぶくんがよろこんでいます");
}

function openModal(title, bodyHtml) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = bodyHtml;
  els.modalLayer.classList.add("is-open");
  els.modalLayer.setAttribute("aria-hidden", "false");
}

function closeModal() {
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
    if (shopTabButton) openShop(shopTabButton.dataset.shopTab);
    if (buyButton) buyItem(buyButton.dataset.buyItem);
    if (claimButton) claimMission(claimButton.dataset.claimMission);
  });

  els.closeModal.addEventListener("click", closeModal);
  els.modalLayer.addEventListener("click", (event) => {
    if (event.target === els.modalLayer) closeModal();
  });
  els.feedButton.addEventListener("click", feedKabukun);
  els.kabukunButton.addEventListener("click", feedKabukun);
}

function init() {
  // LIFF IDが決まったら、ここでliff.initを呼び出す構成にできます。
  bindEvents();
  renderHud();
}

init();
