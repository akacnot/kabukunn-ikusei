const state = Store.load();

const els = {
  screens: document.querySelectorAll(".screen"),
  titleKabuImage: document.querySelector("#titleKabuImage"),
  versionLabel: document.querySelector("#versionLabel"),
  currentTime: document.querySelector("#currentTime"),
  kabukunImage: document.querySelector("#kabukunImage"),
  roomImage: document.querySelector("#roomImage"),
  coinCount: document.querySelector("#coinCount"),
  foodCount: document.querySelector("#foodCount"),
  friendshipValue: document.querySelector("#friendshipValue"),
  feedButton: document.querySelector("#feedButton"),
  battleButton: document.querySelector("#battleButton"),
  earnButton: document.querySelector("#earnButton"),
  minigameButton: document.querySelector("#minigameButton"),
  friendButton: document.querySelector("#friendButton"),
  photoButton: document.querySelector("#photoButton"),
  photoInput: document.querySelector("#photoInput"),
  kabukunButton: document.querySelector("#kabukunButton"),
  moodBubble: document.querySelector("#moodBubble"),
  modalLayer: document.querySelector("#modalLayer"),
  modalTitle: document.querySelector("#modalTitle"),
  modalBody: document.querySelector("#modalBody"),
  missionNavButton: document.querySelector("#missionNavButton"),
  closeModal: document.querySelector("#closeModal"),
  toast: document.querySelector("#toast")
};

let toastTimer = 0;
let earnTimer = 0;
let clockTimer = 0;
let miniGame = null;
let helpGame = null;
let battle = null;

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
  els.foodCount.textContent = getTotalFoodCount().toLocaleString("ja-JP");
  els.friendshipValue.textContent = state.friendship.toLocaleString("ja-JP");
  els.versionLabel.textContent = `Ver. ${GAME_CONFIG.appVersion}`;
  renderEarnButton();
  renderMissionNotice();
}

function renderClock() {
  const now = new Date();
  els.currentTime.textContent = now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function renderEarnButton() {
  const remaining = getEarnRemainingMs();
  if (remaining <= 0) {
    els.earnButton.disabled = false;
    els.earnButton.textContent = "おてつだい";
    return;
  }

  els.earnButton.disabled = true;
  els.earnButton.textContent = `${Math.ceil(remaining / 1000)}秒`;
}

function getEarnRemainingMs() {
  const cooldown = GAME_CONFIG.earnCoins.cooldownMs;
  return Math.max(0, state.lastEarnedAt + cooldown - Date.now());
}

function getTotalFoodCount() {
  return Object.values(state.foodInventory || {}).reduce((sum, count) => sum + count, 0);
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 1900);
}

function feedKabukun(foodId = null) {
  const foods = GAME_CONFIG.shopItems.filter((item) => (state.foodInventory[item.id] || 0) > 0);
  const selectedFood = foodId ? GAME_CONFIG.shopItems.find((item) => item.id === foodId) : foods[0];

  if (!selectedFood || (state.foodInventory[selectedFood.id] || 0) <= 0) {
    showToast("えさがありません。ショップで買えます。");
    openShop();
    return;
  }

  state.foodInventory[selectedFood.id] = Math.max(0, (state.foodInventory[selectedFood.id] || 0) - 1);
  state.friendship += selectedFood.friendshipGain || 1;
  state.coins += selectedFood.coinBonus || 0;
  state.fedCount += 1;
  state.daily.fedCount += 1;
  els.moodBubble.textContent = `${selectedFood.name}おいしい！`;
  playHappyMotion();
  persist();
  showToast(`${selectedFood.name}: なかよし+${selectedFood.friendshipGain || 1}`);
}

function openFeedMenu() {
  const foods = GAME_CONFIG.shopItems
    .map((item) => {
      const count = state.foodInventory[item.id] || 0;
      return `
        <article class="shop-item">
          <img class="item-icon" src="${item.image}" alt="" />
          <div>
            <div class="item-name">${item.name} ×${count}</div>
            <div class="item-desc">なかよし+${item.friendshipGain || 1}${item.coinBonus ? ` / 🪙+${item.coinBonus}` : ""}</div>
          </div>
          <button class="buy-btn" data-feed-food="${item.id}" ${count <= 0 ? "disabled" : ""}>あげる</button>
        </article>`;
    })
    .join("");
  openModal("ごはんを選ぶ", `<div class="shop-list">${foods}</div>`);
}

function openHelpGame() {
  if (getEarnRemainingMs() > 0) {
    showToast("おてつだいは少し休憩中です");
    return;
  }

  openModal("おてつだい", `
    <section class="help-panel">
      <div class="minigame-score">
        <span>残り <strong id="helpTime">15</strong>秒</span>
        <span>完了 <strong id="helpDone">0</strong>/4</span>
      </div>
      <div id="helpTasks" class="help-tasks"></div>
      <button class="primary-btn" data-action="start-help">おてつだい開始</button>
      <p class="gift-note">光った作業を順番にタップして、かぶくんのお部屋を整えよう。</p>
    </section>
  `);
}

function startHelpGame() {
  stopHelpGame();
  helpGame = {
    done: 0,
    active: -1,
    endsAt: Date.now() + GAME_CONFIG.earnCoins.durationMs,
    tickTimer: 0
  };
  renderHelpTasks();
  helpGame.tickTimer = setInterval(tickHelpGame, 250);
  activateHelpTask();
}

function renderHelpTasks() {
  const tasks = [
    { icon: "🧹", label: "そうじ" },
    { icon: "💧", label: "水やり" },
    { icon: "📦", label: "片づけ" },
    { icon: "✨", label: "みがく" }
  ];
  const body = document.querySelector("#helpTasks");
  if (!body) return;
  body.innerHTML = tasks
    .map((task, index) => `<button class="help-task" data-help-task="${index}"><span>${task.icon}</span><strong>${task.label}</strong></button>`)
    .join("");
}

function activateHelpTask() {
  if (!helpGame) return;
  helpGame.active = Math.floor(Math.random() * 4);
  document.querySelectorAll(".help-task").forEach((button, index) => {
    button.classList.toggle("is-active", index === helpGame.active);
  });
}

function tapHelpTask(index) {
  if (!helpGame) return;
  if (index !== helpGame.active) {
    showToast("光っている作業をタップしてね");
    return;
  }
  helpGame.done += 1;
  document.querySelector("#helpDone").textContent = String(helpGame.done);
  if (helpGame.done >= GAME_CONFIG.earnCoins.taskCount) {
    finishHelpGame(true);
    return;
  }
  activateHelpTask();
}

function tickHelpGame() {
  if (!helpGame) return;
  const remaining = Math.max(0, Math.ceil((helpGame.endsAt - Date.now()) / 1000));
  const time = document.querySelector("#helpTime");
  if (time) time.textContent = String(remaining);
  if (remaining <= 0) finishHelpGame(false);
}

function finishHelpGame(completed) {
  if (!helpGame) return;
  const { rewardMin, rewardMax } = GAME_CONFIG.earnCoins;
  const base = completed ? rewardMax : Math.max(rewardMin, helpGame.done * 5);
  const reward = Math.min(rewardMax, base);
  state.coins += reward;
  state.earnedCoins += reward;
  state.helpCoins += reward;
  state.daily.helpCoins += reward;
  state.helperPlays += 1;
  state.lastEarnedAt = Date.now();
  persist();
  stopHelpGame();
  openModal(completed ? "おてつだい成功！" : "おてつだい終了", `
    <section class="result-panel">
      <div class="result-coin">🪙 ${reward}</div>
      <p class="gift-note">${completed ? "全部の作業が完了しました。" : "途中までの作業分を受け取りました。"}</p>
      <button class="primary-btn" data-action="open-help">またあとで</button>
    </section>
  `);
}

function stopHelpGame() {
  if (!helpGame) return;
  clearInterval(helpGame.tickTimer);
  helpGame = null;
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
  stopHelpGame();
  battle = null;
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
        <p class="gift-note">コードを入力すると特典を受け取れます。例:WELCOME</p>
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
  state.foodInventory[item.id] = (state.foodInventory[item.id] || 0) + item.foodAmount;
  persist();
  openShop("items");
  showToast(`${item.name}を買いました`);
}

function redeemGift() {
  const input = document.querySelector("#giftInput");
  const code = input.value.trim().toUpperCase();
  const gift = getGiftCode(code);

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
  if (gift.rewards.food) {
    state.foodInventory.fresh_leaf = (state.foodInventory.fresh_leaf || 0) + gift.rewards.food;
  }
  state.redeemedGiftCodes.push(code);
  persist();
  input.value = "";
  showToast(`${gift.label}を受け取りました`);
}

function getGiftCode(code) {
  const adminGifts = JSON.parse(localStorage.getItem("kabukun-admin-gifts") || "{}");
  return GAME_CONFIG.giftCodes[code] || adminGifts[code];
}

function openFriends() {
  const requests = state.friendRequests.length
    ? state.friendRequests
        .map(
          (request) => `
            <article class="friend-row">
              <div><strong>${request.code}</strong><small>申請中</small></div>
              <button class="claim-btn" data-approve-friend="${request.code}">承認</button>
            </article>`
        )
        .join("")
    : `<p class="gift-note">申請はまだありません。</p>`;

  const friends = state.friends.length
    ? state.friends.map((friend) => `<span class="friend-chip">${friend.code}</span>`).join("")
    : `<p class="gift-note">フレンドはまだいません。</p>`;

  openModal("フレンド", `
    <section class="friend-panel">
      <div class="friend-code-box">
        <span>自分のコード</span>
        <strong>${state.friendCode}</strong>
      </div>
      <input id="friendCodeInput" class="gift-input" type="text" inputmode="numeric" maxlength="12" placeholder="12桁のフレンドコード" />
      <button class="gift-submit" data-action="send-friend-request">申請する</button>
      <h3>申請</h3>
      <div class="friend-list">${requests}</div>
      <h3>フレンド</h3>
      <div class="friend-chips">${friends}</div>
    </section>
  `);
}

function sendFriendRequest() {
  const input = document.querySelector("#friendCodeInput");
  const code = (input?.value || "").replace(/\D/g, "");
  if (code.length !== 12) {
    showToast("12桁のコードを入力してください");
    return;
  }
  if (code === state.friendCode) {
    showToast("自分のコードには申請できません");
    return;
  }
  if (state.friends.some((friend) => friend.code === code) || state.friendRequests.some((request) => request.code === code)) {
    showToast("すでに登録済みです");
    return;
  }
  state.friendRequests.push({ code, createdAt: Date.now() });
  persist();
  openFriends();
  showToast("フレンド申請を送りました");
}

function approveFriend(code) {
  state.friendRequests = state.friendRequests.filter((request) => request.code !== code);
  state.friends.push({ code, approvedAt: Date.now() });
  persist();
  openFriends();
  showToast("フレンドになりました");
}

function openMissions() {
  openModal("ミッション", renderMissions());
}

function getMissionProgress(mission) {
  if (mission.reset === "daily") {
    return Math.min(state.daily?.[mission.metric] || 0, mission.target);
  }
  return Math.min(state[mission.metric] || 0, mission.target);
}

function getAllMissions() {
  const adminMissions = JSON.parse(localStorage.getItem("kabukun-admin-missions") || "[]");
  return [...GAME_CONFIG.missions, ...adminMissions];
}

function getClaimedMissions(mission) {
  if (mission.reset !== "daily") return state.claimedMissions;
  const today = state.daily.date;
  state.dailyClaimedMissions[today] = state.dailyClaimedMissions[today] || [];
  return state.dailyClaimedMissions[today];
}

function hasClaimableMission() {
  return getAllMissions().some((mission) => getMissionProgress(mission) >= mission.target && !getClaimedMissions(mission).includes(mission.id));
}

function renderMissionNotice() {
  els.missionNavButton?.classList.toggle("has-notice", hasClaimableMission());
}

function renderMissions() {
  const missions = getAllMissions()
    .map((mission) => {
      const progress = getMissionProgress(mission);
      const completed = progress >= mission.target;
      const claimed = getClaimedMissions(mission).includes(mission.id);
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
  const mission = getAllMissions().find((item) => item.id === missionId);
  const claimedMissions = getClaimedMissions(mission || {});
  if (!mission || claimedMissions.includes(missionId)) return;
  if (getMissionProgress(mission) < mission.target) {
    showToast("まだ達成していません");
    return;
  }

  state.coins += mission.reward.coins || 0;
  if (mission.reward.food) {
    state.foodInventory.fresh_leaf = (state.foodInventory.fresh_leaf || 0) + mission.reward.food;
  }
  claimedMissions.push(missionId);
  persist();
  openMissions();
  showToast("報酬を受け取りました");
}

function openBattle() {
  openModal("かぶくんバトル", `
    <section class="battle-menu">
      <button class="battle-mode-card" data-action="start-solo-battle">
        <span class="battle-mode-icon">⚔️</span>
        <span>
          <strong>ひとりでバトル</strong>
          <small>技とエネルギーを選んで戦う</small>
        </span>
      </button>
      <button class="battle-mode-card is-disabled" disabled aria-disabled="true">
        <span class="battle-mode-icon">🌐</span>
        <span>
          <strong>オンラインバトル</strong>
          <small>現在は利用できません</small>
        </span>
      </button>
      <p class="gift-note">オンライン実装予定はありません。枠だけ先に用意しています。</p>
    </section>
  `);
}

function startSoloBattle() {
  battle = {
    playerHp: GAME_CONFIG.battle.playerMaxHp,
    rivalHp: GAME_CONFIG.battle.rivalMaxHp,
    energy: 2,
    guard: 0,
    cooldowns: {},
    lastSkillId: "",
    turn: 1,
    log: "ライバルかぶがあらわれた！ 技を選ぼう。"
  };
  renderBattle();
}

function renderBattle() {
  if (!battle) return;
  const playerPercent = Math.max(0, (battle.playerHp / GAME_CONFIG.battle.playerMaxHp) * 100);
  const rivalPercent = Math.max(0, (battle.rivalHp / GAME_CONFIG.battle.rivalMaxHp) * 100);
  const skills = GAME_CONFIG.battle.skills
    .map(
      (skill) => `
        <button class="skill-btn" data-battle-skill="${skill.id}" ${battle.energy < skill.cost || battle.cooldowns[skill.id] > 0 ? "disabled" : ""}>
          <strong>${skill.name}</strong>
          <small>${skill.text} / EN ${skill.cost}${battle.cooldowns[skill.id] > 0 ? ` / あと${battle.cooldowns[skill.id]}ターン` : ""}</small>
        </button>`
    )
    .join("");

  openModal("ひとりでバトル", `
    <section class="battle-panel">
      <div class="battle-field">
        <div class="fighter">
          <img src="${state.customKabuImage || GAME_CONFIG.images.kabukun}" alt="かぶくん" />
          <strong>かぶくん</strong>
          <div class="hp-track"><span style="width: ${playerPercent}%"></span></div>
          <small>HP ${battle.playerHp}/${GAME_CONFIG.battle.playerMaxHp}</small>
        </div>
        <div class="versus">EN ${battle.energy}</div>
        <div class="fighter rival">
          <img src="${GAME_CONFIG.images.kabukun}" alt="ライバルかぶ" />
          <strong>ライバル</strong>
          <div class="hp-track"><span style="width: ${rivalPercent}%"></span></div>
          <small>HP ${battle.rivalHp}/${GAME_CONFIG.battle.rivalMaxHp}</small>
        </div>
      </div>
      <p class="battle-log">${battle.log}</p>
      <div class="skill-grid">${skills}</div>
      <button class="ghost-btn" data-action="open-battle">モード選択へ</button>
    </section>
  `);
}

function useBattleSkill(skillId) {
  if (!battle) return;
  const skill = GAME_CONFIG.battle.skills.find((item) => item.id === skillId);
  if (!skill || battle.energy < skill.cost) {
    showToast("エネルギーが足りません");
    return;
  }
  if (battle.cooldowns[skill.id] > 0) {
    showToast("その技はまだ使えません");
    return;
  }
  if (battle.lastSkillId === skill.id && skill.cost > 0) {
    showToast("同じ技の連続使用はできません");
    return;
  }

  battle.energy -= skill.cost;
  battle.guard = 0;
  battle.lastSkillId = skill.id;
  battle.cooldowns[skill.id] = skill.cooldown || 1;
  let log = `${skill.name}！`;
  if (skill.power) {
    const damage = randomRange(skill.power[0], skill.power[1]);
    battle.rivalHp = Math.max(0, battle.rivalHp - damage);
    log += ` ${damage}ダメージ`;
  }
  if (skill.guard) {
    battle.guard = skill.guard;
    log += ` 守りを固めた`;
  }
  if (skill.heal) {
    battle.playerHp = Math.min(GAME_CONFIG.battle.playerMaxHp, battle.playerHp + skill.heal);
    log += ` HP+${skill.heal}`;
  }
  if (skill.energy) {
    battle.energy = Math.min(GAME_CONFIG.battle.maxEnergy, battle.energy + skill.energy);
    log += ` EN+${skill.energy}`;
  }

  battle.log = log;
  if (battle.rivalHp <= 0) {
    finishBattle(true);
    return;
  }
  rivalTurn();
}

function rivalTurn() {
  const damage = Math.max(1, randomRange(5, 10) - battle.guard);
  battle.playerHp = Math.max(0, battle.playerHp - damage);
  battle.energy = Math.min(GAME_CONFIG.battle.maxEnergy, battle.energy + 1);
  Object.keys(battle.cooldowns).forEach((skillId) => {
    battle.cooldowns[skillId] = Math.max(0, battle.cooldowns[skillId] - 1);
  });
  battle.turn += 1;
  battle.log += ` / ライバルの反撃 ${damage}ダメージ`;
  if (battle.playerHp <= 0) {
    finishBattle(false);
    return;
  }
  renderBattle();
}

function finishBattle(won) {
  const reward = won ? GAME_CONFIG.battle.winRewardCoins : GAME_CONFIG.battle.loseRewardCoins;
  state.coins += reward;
  if (won) {
    state.battleWins += 1;
    state.daily.battleWins += 1;
  }
  persist();
  battle = null;
  openModal(won ? "勝利！" : "もう少し！", `
    <section class="result-panel">
      <div class="result-coin">🪙 ${reward}</div>
      <p class="gift-note">${won ? "技を使いこなして勝ちました。" : "負けても少しだけコインを受け取りました。"}</p>
      <button class="primary-btn" data-action="start-solo-battle">もう一度バトル</button>
      <button class="secondary-btn" data-action="open-battle">モード選択へ</button>
    </section>
  `);
}

function randomRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
    miniGame.score = isBomb ? Math.max(0, miniGame.score - GAME_CONFIG.minigame.missPenalty) : miniGame.score + 1;
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
  state.daily.minigameCoins += reward;
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
    const feedButton = event.target.closest("[data-feed-food]");
    const claimButton = event.target.closest("[data-claim-mission]");
    const helpTask = event.target.closest("[data-help-task]");
    const approveButton = event.target.closest("[data-approve-friend]");
    const battleSkill = event.target.closest("[data-battle-skill]");

    if (routeButton) routeTo(routeButton.dataset.route);
    if (modalButton?.dataset.modal === "shop") openShop();
    if (modalButton?.dataset.modal === "missions") openMissions();
    if (actionButton?.dataset.action === "show-preparing") showToast("準備中です");
    if (actionButton?.dataset.action === "redeem-gift") redeemGift();
    if (actionButton?.dataset.action === "start-minigame") startMinigame();
    if (actionButton?.dataset.action === "open-minigame") openMinigame();
    if (actionButton?.dataset.action === "open-help") openHelpGame();
    if (actionButton?.dataset.action === "start-help") startHelpGame();
    if (actionButton?.dataset.action === "send-friend-request") sendFriendRequest();
    if (actionButton?.dataset.action === "open-battle") openBattle();
    if (actionButton?.dataset.action === "start-solo-battle") startSoloBattle();
    if (shopTabButton) openShop(shopTabButton.dataset.shopTab);
    if (buyButton) buyItem(buyButton.dataset.buyItem);
    if (feedButton) feedKabukun(feedButton.dataset.feedFood);
    if (claimButton) claimMission(claimButton.dataset.claimMission);
    if (helpTask) tapHelpTask(Number(helpTask.dataset.helpTask));
    if (approveButton) approveFriend(approveButton.dataset.approveFriend);
    if (battleSkill) useBattleSkill(battleSkill.dataset.battleSkill);
  });

  els.closeModal.addEventListener("click", closeModal);
  els.modalLayer.addEventListener("click", (event) => {
    if (event.target === els.modalLayer) closeModal();
  });
  els.feedButton.addEventListener("click", openFeedMenu);
  els.battleButton.addEventListener("click", openBattle);
  els.earnButton.addEventListener("click", openHelpGame);
  els.minigameButton.addEventListener("click", openMinigame);
  els.friendButton.addEventListener("click", openFriends);
  els.photoButton.addEventListener("click", () => els.photoInput.click());
  els.photoInput.addEventListener("change", (event) => choosePhoto(event.target.files[0]));
  els.kabukunButton.addEventListener("click", openFeedMenu);
}

function init() {
  bindEvents();
  renderImages();
  renderHud();
  renderClock();
  earnTimer = setInterval(renderEarnButton, 1000);
  clockTimer = setInterval(renderClock, 1000);
  window.addEventListener("beforeunload", () => {
    clearInterval(earnTimer);
    clearInterval(clockTimer);
  });
}

init();
