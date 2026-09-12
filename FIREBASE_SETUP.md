# かぶくん Firebase 移行メモ

## Firebase側でやること

1. Firebase Consoleで `kabukunnikusei` を開く
2. Authentication > Sign-in method で「匿名」を有効化
3. Firestore Database を作成
4. `firestore.rules` の内容を Firestore Rules に反映
5. Project settings > Web app の設定値を `js/firebase-config.js` に貼り付け
6. GitHub Pagesの公開ドメインを Authentication の承認済みドメインに追加
7. 管理者ページを使う場合は、管理者として使うUIDの `users/{uid}` に `role: "admin"` をFirebase Consoleで追加

## コード側でやること

- `js/firebase-config.js` の `YOUR_API_KEY`、`YOUR_APP_ID`、`YOUR_MESSAGING_SENDER_ID` を実値に変更
- GitHub Pagesでは `index.html` をそのまま公開
- Node.jsの `server.js` は互換確認用として残していますが、ゲーム本体からは参照していません
- `admin.html` はFirebaseに接続して `promoCodes` を作成できます。admin権限がない場合はローカルJSON作成だけ動きます

## Firestore構造

- `users/{uid}`: プロフィール、コイン、friendship、フレンドUID一覧
- `playerCodes/{12桁コード}`: プレイヤーコードからUIDを引くための索引
- `friendRequests/{fromUid_toUid}`: フレンド申請
- `promoCodes/{code}`: 運営プロモコード。`usageLimit: 1` で1回だけ使用
- `promoCodeRedemptions/{code_uid}`: ユーザーごとの受け取り記録

## 注意

GitHub Pagesだけで動くように、Firebase Web SDKをCDNのES Moduleとして読み込んでいます。
ゲームで増えるコインはクライアントからFirestoreへ同期されます。Rulesで1回あたりの増加量を制限していますが、完全な不正対策にはCloud Functionsなどのサーバー側検証が必要です。
