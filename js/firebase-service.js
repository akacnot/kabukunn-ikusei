import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const REQUEST_STATUS = {
  pending: "pending",
  approved: "approved"
};

let app = null;
let auth = null;
let db = null;
let currentUser = null;
let currentProfile = null;
let firebaseReady = false;
let firestoreConnectedLogged = false;

export async function initKabukunFirebase(localState) {
  const config = window.KABUKUN_FIREBASE_CONFIG;
  if (!isUsableFirebaseConfig(config)) {
    console.error("[Firebase] config missing or incomplete", config);
    return { available: false, reason: "missing_config" };
  }

  try {
    console.info("[Firebase] initializing");
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);

    currentUser = await waitForAuthUser();
    console.info("[Firebase] auth signed in");
    console.info("[Firebase] migration start");
    const profileResult = await ensureProfile(localState);
    currentProfile = profileResult.profile;
    firebaseReady = true;
    console.info("[Firebase] migration completed");
    return { available: true, user: currentUser, profile: currentProfile, createdProfile: profileResult.created };
  } catch (error) {
    console.error("[Firebase] initialization failed", error);
    throw error;
  }
}

export function isFirebaseReady() {
  return firebaseReady;
}

export function getCurrentProfile() {
  return currentProfile;
}

export function getCurrentUid() {
  return currentUser?.uid || null;
}

export async function syncProfile(localState) {
  if (!firebaseReady || !currentUser) return null;
  const profilePatch = {
    coins: Number(localState.coins || 0),
    friendship: Number(localState.friendship || 1),
    playerCode: localState.friendCode,
    nickname: localState.nickname || currentProfile?.nickname || "かぶくん",
    iconId: localState.iconId || currentProfile?.iconId || "kabukun_01",
    profilePhotoDataUrl: localState.profilePhotoDataUrl || currentProfile?.profilePhotoDataUrl || "",
    updatedAt: serverTimestamp()
  };
  try {
    await setDoc(doc(db, "users", currentUser.uid), profilePatch, { merge: true });
  } catch (error) {
    console.error("[Firebase] profile sync failed", error);
    throw error;
  }
  currentProfile = { ...currentProfile, ...profilePatch };
  return currentProfile;
}

export async function updateProfile({ nickname, iconId, profilePhotoDataUrl = "" }) {
  if (!firebaseReady || !currentUser) throw new Error("firebase_not_ready");
  const cleanName = String(nickname || "").trim();
  if (cleanName.length < 1 || cleanName.length > 12) throw new Error("invalid_nickname");
  if (!/^[a-z0-9_]+$/i.test(iconId || "")) throw new Error("invalid_icon");
  if (profilePhotoDataUrl && !/^data:image\/(png|jpeg|webp);base64,/.test(profilePhotoDataUrl)) {
    throw new Error("invalid_profile_photo");
  }

  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      nickname: cleanName,
      iconId,
      profilePhotoDataUrl,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("[Firebase] profile update failed", error);
    throw error;
  }
  currentProfile = { ...currentProfile, nickname: cleanName, iconId, profilePhotoDataUrl };
  return currentProfile;
}

export async function getFriendState() {
  if (!firebaseReady || !currentUser) return null;
  try {
    const profileSnap = await getDoc(doc(db, "users", currentUser.uid));
    const profile = profileSnap.data();
    const friendUids = profile?.friends || [];
    const friends = [];

    for (const uid of friendUids) {
      const friendSnap = await getDoc(doc(db, "users", uid));
      if (friendSnap.exists()) friends.push(publicProfile(friendSnap.data()));
    }

    const incomingSnap = await getDocs(
      query(
        collection(db, "friendRequests"),
        where("toUid", "==", currentUser.uid),
        where("status", "==", REQUEST_STATUS.pending)
      )
    );
    const outgoingSnap = await getDocs(
      query(
        collection(db, "friendRequests"),
        where("fromUid", "==", currentUser.uid),
        where("status", "==", REQUEST_STATUS.pending)
      )
    );

    return {
      profile: publicProfile(profile),
      friends,
      incoming: incomingSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
      outgoing: outgoingSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
    };
  } catch (error) {
    console.error("[Firebase] friend state load failed", error);
    throw error;
  }
}

export async function getLeaderboard(maxCount = 100) {
  if (!firebaseReady || !currentUser) return [];
  try {
    const leaderboardSnap = await getDocs(
      query(collection(db, "users"), orderBy("friendship", "desc"), limit(Math.min(100, Math.max(1, Number(maxCount) || 100))))
    );
    return leaderboardSnap.docs.map((item, index) => ({
      rank: index + 1,
      ...publicProfile(item.data())
    }));
  } catch (error) {
    console.error("[Firebase] leaderboard load failed", error);
    throw error;
  }
}

export function listenFriendState(onChange) {
  if (!firebaseReady || !currentUser) return () => {};

  const unsubscribers = [];
  const friendUnsubscribers = new Map();
  const friendProfiles = new Map();
  let profile = currentProfile;
  let incoming = [];
  let outgoing = [];

  const emit = () => {
    onChange({
      profile: publicProfile(profile),
      friends: [...friendProfiles.values()],
      incoming,
      outgoing
    });
  };

  const syncFriendProfileListeners = (friendUids) => {
    const nextUids = new Set(friendUids || []);

    friendUnsubscribers.forEach((unsubscribe, uid) => {
      if (!nextUids.has(uid)) {
        unsubscribe();
        friendUnsubscribers.delete(uid);
        friendProfiles.delete(uid);
      }
    });

    nextUids.forEach((uid) => {
      if (uid === currentUser.uid || friendUnsubscribers.has(uid)) return;
      const unsubscribe = onSnapshot(
        doc(db, "users", uid),
        (snapshot) => {
          if (snapshot.exists()) {
            friendProfiles.set(uid, publicProfile(snapshot.data()));
          } else {
            friendProfiles.delete(uid);
          }
          emit();
        },
        (error) => {
          console.error("[Firebase] friend profile listener failed", error);
        }
      );
      friendUnsubscribers.set(uid, unsubscribe);
    });
  };

  unsubscribers.push(
    onSnapshot(
      doc(db, "users", currentUser.uid),
      (snapshot) => {
        if (!snapshot.exists()) return;
        profile = snapshot.data();
        currentProfile = profile;
        syncFriendProfileListeners(profile.friends || []);
        emit();
      },
      (error) => {
        console.error("[Firebase] own profile listener failed", error);
      }
    )
  );

  unsubscribers.push(
    onSnapshot(
      query(collection(db, "friendRequests"), where("toUid", "==", currentUser.uid), where("status", "==", REQUEST_STATUS.pending)),
      (snapshot) => {
        incoming = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        emit();
      },
      (error) => {
        console.error("[Firebase] incoming request listener failed", error);
      }
    )
  );

  unsubscribers.push(
    onSnapshot(
      query(collection(db, "friendRequests"), where("fromUid", "==", currentUser.uid), where("status", "==", REQUEST_STATUS.pending)),
      (snapshot) => {
        outgoing = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        emit();
      },
      (error) => {
        console.error("[Firebase] outgoing request listener failed", error);
      }
    )
  );

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    friendUnsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

export async function sendFriendRequestByCode(targetCode) {
  if (!firebaseReady || !currentUser) throw new Error("firebase_not_ready");
  if (!/^\d{12}$/.test(targetCode)) throw new Error("invalid_code");
  if (targetCode === currentProfile.playerCode) throw new Error("same_code");

  const targetCodeSnap = await getDoc(doc(db, "playerCodes", targetCode));
  if (!targetCodeSnap.exists()) throw new Error("not_found");
  const targetUid = targetCodeSnap.data().uid;
  const requestId = `${currentUser.uid}_${targetUid}`;
  const reverseRequestId = `${targetUid}_${currentUser.uid}`;

  try {
    await runTransaction(db, async (transaction) => {
      const meRef = doc(db, "users", currentUser.uid);
      const targetRef = doc(db, "users", targetUid);
      const requestRef = doc(db, "friendRequests", requestId);
      const reverseRequestRef = doc(db, "friendRequests", reverseRequestId);
      const [meSnap, targetSnap, requestSnap, reverseRequestSnap] = await Promise.all([
        transaction.get(meRef),
        transaction.get(targetRef),
        transaction.get(requestRef),
        transaction.get(reverseRequestRef)
      ]);
      const me = meSnap.data();
      const target = targetSnap.data();
      if (!me || !target) throw new Error("profile_missing");
      if ((me.friends || []).includes(targetUid) || (target.friends || []).includes(currentUser.uid)) {
        throw new Error("already_friend");
      }
      if (requestSnap.exists() && requestSnap.data().status === REQUEST_STATUS.pending) {
        throw new Error("duplicate_request");
      }
      if (reverseRequestSnap.exists() && reverseRequestSnap.data().status === REQUEST_STATUS.pending) {
        throw new Error("duplicate_request");
      }
      transaction.set(requestRef, {
        fromUid: currentUser.uid,
        fromCode: me.playerCode,
        fromNickname: me.nickname || "かぶくん",
        fromIconId: me.iconId || "kabukun_01",
        fromProfilePhotoDataUrl: me.profilePhotoDataUrl || "",
        toUid: targetUid,
        toCode: target.playerCode,
        status: REQUEST_STATUS.pending,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error("[Firebase] friend request failed", error);
    throw error;
  }

  return true;
}

export async function approveFriendRequest(requestId) {
  if (!firebaseReady || !currentUser) throw new Error("firebase_not_ready");

  try {
    await runTransaction(db, async (transaction) => {
      const requestRef = doc(db, "friendRequests", requestId);
      const requestSnap = await transaction.get(requestRef);
      if (!requestSnap.exists()) throw new Error("request_missing");
      const request = requestSnap.data();
      if (request.toUid !== currentUser.uid) throw new Error("not_owner");
      if (request.fromUid === currentUser.uid) throw new Error("invalid_request");
      if (request.status !== REQUEST_STATUS.pending) throw new Error("not_pending");

      transaction.update(doc(db, "users", currentUser.uid), {
        friends: arrayUnion(request.fromUid),
        updatedAt: serverTimestamp()
      });
      transaction.update(doc(db, "users", request.fromUid), {
        friends: arrayUnion(currentUser.uid),
        updatedAt: serverTimestamp()
      });
      transaction.update(requestRef, {
        status: REQUEST_STATUS.approved,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error("[Firebase] friend request approve failed", error);
    throw error;
  }

  return true;
}

export async function redeemPromoCode(rawCode) {
  if (!firebaseReady || !currentUser) throw new Error("firebase_not_ready");
  const code = String(rawCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new Error("invalid_promo_code");

  const promoRef = doc(db, "promoCodes", code);
  const redemptionRef = doc(db, "promoCodeRedemptions", `${code}_${currentUser.uid}`);
  let redeemedGift = null;

  try {
    await runTransaction(db, async (transaction) => {
      const [promoSnap, redemptionSnap] = await Promise.all([
        transaction.get(promoRef),
        transaction.get(redemptionRef)
      ]);
      if (!promoSnap.exists()) throw new Error("promo_not_found");
      if (redemptionSnap.exists()) throw new Error("promo_used");

      const promo = promoSnap.data();
      const now = Date.now();
      const expiresAtMs = promo.expiresAt?.toMillis ? promo.expiresAt.toMillis() : null;
      if (promo.enabled === false) throw new Error("promo_disabled");
      if (expiresAtMs && expiresAtMs < now) throw new Error("promo_expired");

      const usageLimit = Number(promo.usageLimit || 1);
      const usedCount = Number(promo.usedCount || 0);
      if (usedCount >= usageLimit) throw new Error("promo_used");

      redeemedGift = {
        label: promo.label || "運営配布",
        rewards: {
          coins: Number(promo.rewards?.coins || 0),
          food: Number(promo.rewards?.food || 0)
        }
      };

      transaction.update(promoRef, {
        usedCount: usedCount + 1,
        redeemedBy: arrayUnion(currentUser.uid),
        updatedAt: serverTimestamp()
      });
      transaction.set(redemptionRef, {
        code,
        uid: currentUser.uid,
        rewards: redeemedGift.rewards,
        redeemedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error("[Firebase] promo redeem failed", error);
    throw error;
  }

  return redeemedGift;
}

async function waitForAuthUser() {
  const existingUser = await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
  if (existingUser) return existingUser;
  try {
    const credential = await signInAnonymously(auth);
    return credential.user;
  } catch (error) {
    console.error("[Firebase] anonymous sign in failed", error);
    throw error;
  }
}

async function ensureProfile(localState) {
  const userRef = doc(db, "users", currentUser.uid);
  const userSnap = await getDoc(userRef);
  logFirestoreConnected();
  if (userSnap.exists()) {
    const profile = userSnap.data();
    if (profile.playerCode && profile.playerCode !== localState.friendCode) {
      localState.friendCode = profile.playerCode;
      window.Store?.save(localState);
    }
    return { profile, created: false };
  }

  return { profile: await createProfile(localState), created: true };
}

function isUsableFirebaseConfig(config) {
  return Boolean(
    config &&
      typeof config.apiKey === "string" &&
      config.apiKey.trim() &&
      config.apiKey !== "YOUR_API_KEY" &&
      typeof config.projectId === "string" &&
      config.projectId.trim() &&
      typeof config.appId === "string" &&
      config.appId.trim() &&
      config.appId !== "YOUR_APP_ID" &&
      typeof config.authDomain === "string" &&
      config.authDomain.trim()
  );
}

function logFirestoreConnected() {
  if (firestoreConnectedLogged) return;
  firestoreConnectedLogged = true;
  console.info("[Firebase] firestore connected");
}

async function createProfile(localState) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const playerCode = attempt === 0 && /^\d{12}$/.test(localState.friendCode) ? localState.friendCode : createPlayerCode();
    const codeRef = doc(db, "playerCodes", playerCode);
    const userRef = doc(db, "users", currentUser.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const codeSnap = await transaction.get(codeRef);
        if (codeSnap.exists()) throw new Error("code_taken");

        const profile = {
          uid: currentUser.uid,
          playerCode,
          nickname: localState.nickname || "かぶくん",
          iconId: localState.iconId || "kabukun_01",
          profilePhotoDataUrl: localState.profilePhotoDataUrl || "",
          coins: Number(localState.coins || 0),
          friendship: Number(localState.friendship || 1),
          friends: [],
          migrationSource: "localStorage",
          migratedFromLocalAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        transaction.set(userRef, profile);
        transaction.set(codeRef, {
          uid: currentUser.uid,
          createdAt: serverTimestamp()
        });
      });
      localState.friendCode = playerCode;
      window.Store?.save(localState);
      const createdSnap = await getDoc(userRef);
      return createdSnap.data();
    } catch (error) {
      if (error.message !== "code_taken") throw error;
    }
  }
  throw new Error("could_not_create_code");
}

function createPlayerCode() {
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
}

function publicProfile(profile) {
  return {
    uid: profile.uid,
    code: profile.playerCode,
    playerCode: profile.playerCode,
    nickname: profile.nickname || "かぶくん",
    iconId: profile.iconId || "kabukun_01",
    profilePhotoDataUrl: profile.profilePhotoDataUrl || "",
    coins: Number(profile.coins || 0),
    friendship: Number(profile.friendship || 1),
    friendCount: Array.isArray(profile.friends) ? profile.friends.length : 0
  };
}
