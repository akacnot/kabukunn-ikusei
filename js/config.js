const GAME_CONFIG = {
  initialState: {
    coins: 120,
    food: 1,
    friendship: 1,
    fedCount: 0,
    loginDays: 1,
    earnedCoins: 0,
    minigameCoins: 0,
    minigamePlays: 0,
    lastEarnedAt: 0,
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
    rewardMin: 10,
    rewardMax: 25,
    cooldownMs: 30000
  },

  minigame: {
    durationMs: 12000,
    rewardPerCatch: 3,
    missPenalty: 1,
    maxReward: 60
  },

  shopItems: [
    {
      id: "fresh_leaf",
      name: "みずみずしい葉っぱ",
      description: "かぶくんの定番ごはん。なかよしが少し上がります。",
      price: 30,
      foodAmount: 1,
      image: "./assets/images/food-leaf-placeholder.svg"
    },
    {
      id: "golden_snack",
      name: "金色おやつ",
      description: "ちょっと特別なおやつ。えさを3こ補充します。",
      price: 80,
      foodAmount: 3,
      image: "./assets/images/food-leaf-placeholder.svg"
    }
  ],

  missions: [
    {
      id: "feed_once",
      title: "ごはんを1回あげる",
      target: 1,
      metric: "fedCount",
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
      id: "minigame_30_coins",
      title: "かぶキャッチで30コイン稼ぐ",
      target: 30,
      metric: "minigameCoins",
      reward: { coins: 40, food: 1 }
    },
    {
      id: "login_day_1",
      title: "1日ログインする",
      target: 1,
      metric: "loginDays",
      reward: { coins: 20, food: 1 }
    }
  ],

  // 新しいコードはここに追加します。キーは大文字で管理すると入力ゆれに強くなります。
  giftCodes: {
    KABU100: {
      label: "リリース記念",
      rewards: { coins: 100, food: 1 }
    },
    WELCOME: {
      label: "ようこそギフト",
      rewards: { coins: 50, food: 2 }
    }
  }
};
