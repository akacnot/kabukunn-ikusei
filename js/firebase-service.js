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
  onSnapshot,
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

export async function initKabukunFirebase(localState) {
  const config = window.KABUKUN_FIREBASE_CONFIG;
  if (!config || config.apiKey === "YOUR_API_KEY" || config.appId === "YOUR_APP_ID") {
    return { available: false, reason: "missing_config" };
  }

  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);

  currentUser = await waitForAuthUser();
  const profileResult = await ensureProfile(localState);
  currentProfile = profileResult.profile;
  firebaseReady = true;
  return { available: true, user: currentUser, profile: currentProfile, createdProfile: profileResult.created };
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
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, "users", currentUser.uid), profilePatch, { merge: true });
  currentProfile = { ...currentProfile, ...profilePatch };
  return currentProfile;
}

export async function updateProfile({ nickname, iconId }) {
  if (!firebaseReady || !currentUser) throw new Error("firebase_not_ready");
  const cleanName = String(nickname || "").trim();
  if (cleanName.length < 1 || cleanName.length > 12) throw new Error("invalid_nickname");
  if (!/^[a-z0-9_]+$/i.test(iconId || "")) throw new Error("invalid_icon");

  await updateDoc(doc(db, "users", currentUser.uid), {
    nickname: cleanName,
    iconId,
    updatedAt: serverTimestamp()
  });
  currentProfile = { ...currentProfile, nickname: cleanName, iconId };
  return currentProfile;
}

export async function getFriendState() {
  if (!firebaseReady || !currentUser) return null;
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
      const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
        if (snapshot.exists()) {
          friendProfiles.set(uid, publicProfile(snapshot.data()));
        } else {
          friendProfiles.delete(uid);
        }
        emit();
      });
      friendUnsubscribers.set(uid, unsubscribe);
    });
  };

  unsubscribers.push(
    onSnapshot(doc(db, "users", currentUser.uid), (snapshot) => {
      if (!snapshot.exists()) return;
      profile = snapshot.data();
      currentProfile = profile;
      syncFriendProfileListeners(profile.friends || []);
      emit();
    })
  );

  unsubscribers.push(
    onSnapshot(
      query(collection(db, "friendRequests"), where("toUid", "==", currentUser.uid), where("status", "==", REQUEST_STATUS.pending)),
      (snapshot) => {
        incoming = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        emit();
      }
    )
  );

  unsubscribers.push(
    onSnapshot(
      query(collection(db, "friendRequests"), where("fromUid", "==", currentUser.uid), where("status", "==", REQUEST_STATUS.pending)),
      (snapshot) => {
        outgoing = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        emit();
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
      toUid: targetUid,
      toCode: target.playerCode,
      status: REQUEST_STATUS.pending,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  return true;
}

export async function approveFriendRequest(requestId) {
  if (!firebaseReady || !currentUser) throw new Error("firebase_not_ready");

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

  return true;
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

async function ensureProfile(localState) {
  const userRef = doc(db, "users", currentUser.uid);
  const userSnap = await getDoc(userRef);
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
    coins: Number(profile.coins || 0),
    friendship: Number(profile.friendship || 1),
    friendCount: Array.isArray(profile.friends) ? profile.friends.length : 0
  };
}
