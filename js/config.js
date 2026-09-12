window.GAME_CONFIG = {
  appVersion: "1.20",

  initialState: {
    coins: 120,
    food: 0,
    friendship: 1,
    fedCount: 0,
    loginDays: 1,
    earnedCoins: 0,
    helpCoins: 0,
    helperPlays: 0,
    minigameCoins: 0,
    minigamePlays: 0,
    battleWins: 0,
    daily: {},
    dailyClaimedMissions: {},
    lastEarnedAt: 0,
    foodInventory: {
      fresh_leaf: 1
    },
    friendCode: "",
    friendRequests: [],
    friends: [],
    customKabuImage: "",
    claimedMissions: [],
    redeemedGiftCodes: []
  },

  images: {
    kabukun: "./assets/images/kabukun-placeholder.svg",
    room: "./assets/images/room-placeholder.svg",
    shopIcon: "./assets/images/shop-icon.png",
    missionIcon: "./assets/images/mission-icon.png",
    coinIcon: "./assets/images/coin-icon.svg",
    foodIcon: "./assets/images/food-leaf-placeholder.svg"
  },

  earnCoins: {
    rewardMin: 12,
    rewardMax: 28,
    cooldownMs: 45000,
    taskCount: 4,
    durationMs: 15000
  },

  minigame: {
    durationMs: 12000,
    rewardPerCatch: 3,
    missPenalty: 1,
    maxReward: 60
  },

  battle: {
    winRewardCoins: 35,
    loseRewardCoins: 4,
    playerMaxHp: 42,
    rivalMaxHp: 52,
    maxEnergy: 4,
    skills: [
      { id: "leaf_cut", name: "はっぱ斬り", requiredFriendship: 1, comboGroup: "attack", cost: 1, cooldown: 1, power: [5, 8], text: "基本の攻撃" },
      { id: "root_guard", name: "ねっこガード", requiredFriendship: 1, comboGroup: "guard", cost: 1, cooldown: 2, guard: 8, heal: 2, text: "守りを固める" },
      { id: "sun_charge", name: "太陽チャージ", requiredFriendship: 2, comboGroup: "charge", cost: 0, cooldown: 3, energy: 2, heal: 2, text: "次の技に備える" },
      { id: "leaf_storm", name: "リーフストーム", requiredFriendship: 4, comboGroup: "attack", cost: 2, cooldown: 2, power: [9, 13], text: "強めの連続攻撃" },
      { id: "kabu_spin", name: "かぶスピン", requiredFriendship: 7, comboGroup: "special", cost: 3, cooldown: 3, power: [14, 19], text: "大ダメージの必殺技" },
      { id: "friend_bloom", name: "なかよし開花", requiredFriendship: 10, comboGroup: "special", cost: 4, cooldown: 4, power: [18, 24], heal: 4, text: "攻撃しながら回復" }
    ]
  },

  shopItems: [
    {
      id: "fresh_leaf",
      name: "みずみずしい葉っぱ",
      description: "なかよし+1。定番のごはんです。",
      price: 30,
      foodAmount: 1,
      friendshipGain: 1,
      coinBonus: 0,
      image: "./assets/images/food-leaf-placeholder.svg"
    },
    {
      id: "golden_snack",
      name: "金色おやつ",
      description: "なかよし+2。さらに10コインのおまけ付き。",
      price: 80,
      foodAmount: 1,
      friendshipGain: 2,
      coinBonus: 10,
      image: "./assets/images/food-leaf-placeholder.svg"
    },
    {
      id: "power_salad",
      name: "パワーサラダ",
      description: "なかよし+3。バトル前に食べたい特別ごはん。",
      price: 140,
      foodAmount: 1,
      friendshipGain: 3,
      coinBonus: 0,
      image: "./assets/images/food-leaf-placeholder.svg"
    }
  ],

  missions: [
    {
      id: "feed_once",
      title: "ごはんを1回あげる",
      target: 1,
      metric: "fedCount",
      reset: "daily",
      reward: { coins: 50, food: 0 }
    },
    {
      id: "collect_100_coins",
      title: "コインを100枚集める",
      target: 100,
      metric: "coins",
      reward: { coins: 30, food: 1 }
    },
    {
      id: "help_40_coins",
      title: "おてつだいで40コイン稼ぐ",
      target: 40,
      metric: "helpCoins",
      reset: "daily",
      reward: { coins: 35, food: 1 }
    },
    {
      id: "minigame_30_coins",
      title: "かぶキャッチで30コイン稼ぐ",
      target: 30,
      metric: "minigameCoins",
      reset: "daily",
      reward: { coins: 40, food: 1 }
    },
    {
      id: "battle_win_once",
      title: "バトルで1回勝つ",
      target: 1,
      metric: "battleWins",
      reset: "daily",
      reward: { coins: 50, food: 1 }
    },
    {
      id: "login_day_1",
      title: "1日ログインする",
      target: 1,
      metric: "loginDays",
      reset: "daily",
      reward: { coins: 20, food: 1 }
    }
  ],

  giftCodes: {
    KABU100: {
      label: "リリース記念",
      rewards: { coins: 100, food: 1 }
    },
    SUMMER2026: {
      label: "夏限定ギフト",
      rewards: { coins: 300, food: 5 }
    }
  }
};

const GAME_CONFIG = window.GAME_CONFIG;
