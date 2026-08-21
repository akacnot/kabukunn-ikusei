const STORAGE_KEY = "kabukun-save-v1";

function createFriendCode() {
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
}

const Store = {
  load() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return this.normalize(structuredClone(GAME_CONFIG.initialState));

    try {
      return this.normalize({ ...structuredClone(GAME_CONFIG.initialState), ...JSON.parse(saved) });
    } catch {
      return this.normalize(structuredClone(GAME_CONFIG.initialState));
    }
  },

  normalize(state) {
    state.foodInventory = { ...GAME_CONFIG.initialState.foodInventory, ...(state.foodInventory || {}) };
    Object.keys(state.foodInventory).forEach((foodId) => {
      state.foodInventory[foodId] = Math.max(0, Number(state.foodInventory[foodId]) || 0);
    });
    state.friendRequests = Array.isArray(state.friendRequests) ? state.friendRequests : [];
    state.friends = Array.isArray(state.friends) ? state.friends : [];
    state.friendCode = state.friendCode || createFriendCode();
    state.helpCoins = state.helpCoins || 0;
    state.helperPlays = state.helperPlays || 0;
    state.battleWins = state.battleWins || 0;
    state.daily = state.daily || {};
    state.dailyClaimedMissions = state.dailyClaimedMissions || {};
    syncDailyState(state);
    return state;
  },

  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
};

window.Store = Store;

function getTodayKey() {
  return new Date().toLocaleDateString("sv-SE");
}

function syncDailyState(state) {
  const today = getTodayKey();
  if (state.daily.date === today) return;

  state.daily = {
    date: today,
    fedCount: 0,
    helpCoins: 0,
    minigameCoins: 0,
    battleWins: 0,
    loginDays: 1
  };
  state.dailyClaimedMissions[today] = state.dailyClaimedMissions[today] || [];
}
