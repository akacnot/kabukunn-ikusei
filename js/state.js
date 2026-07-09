const STORAGE_KEY = "kabukun-save-v1";

const Store = {
  load() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(GAME_CONFIG.initialState);

    try {
      return { ...structuredClone(GAME_CONFIG.initialState), ...JSON.parse(saved) };
    } catch {
      return structuredClone(GAME_CONFIG.initialState);
    }
  },

  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
};
