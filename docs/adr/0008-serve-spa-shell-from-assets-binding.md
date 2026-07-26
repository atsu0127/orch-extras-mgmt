---
status: "accepted"
date: 2026-07-26
---

# SPA シェルは assets binding から返し、Worker はサーバ関数だけを受ける

## Context and Problem Statement

設計書5.2は「ビルド時にアプリのシェルだけを事前生成し、Worker の仕事をサーバ関数の実行と静的資産の配信に絞る」と定めている。しかし T2-7 のビルド出力を調べたところ、**そうなっていなかった**。

`vite.config.ts` で `spa.enabled` を有効にしているのでシェル（`dist/client/_shell.html`）自体は生成されていた。ところがビルド後の Worker にはシェルを配信するコードが無く、`wrangler.jsonc` の `assets` にも取り出す設定が無かった。結果、静的ファイルに該当しない URL はすべて Worker に流れ、Worker が毎回サーバでレンダリングしていた。本番でも同じ状態だった。

```bash
curl https://orch-extras-mgmt.atsu-dq9.workers.dev/nonexistent   # → 404。サーバがルートを解決していた
```

Phase 1 まではこれでも実害が薄かったが、Phase 2 でルートガードを入れたことで代償が発生した。`beforeLoad` がサーバ側で走るため、ログイン済みなら document を1枚開くたびに D1 クエリが1回増える。設計書5.3が CPU 10ms とサブリクエスト50件を理由に SSR を避けているのと真っ向から食い違う。

## Considered Options

- そのまま（Worker が document ごとにレンダリングする）
- `assets` に `not_found_handling` と `run_worker_first` を設定し、Cloudflare にシェルを配信させる
- `src/server.ts` で自前に振り分け、document は `env.ASSETS.fetch()` でシェルを返す

## Decision Outcome

採用: **`assets` の設定で Cloudflare に配信させる**。

```jsonc
"assets": {
  "not_found_handling": "single-page-application",
  "run_worker_first": ["/_serverFn/*"]
}
```

`not_found_handling` が返すのは `index.html` なので、シェルの出力先を既定の `/_shell` からそこへ移した（`vite.config.ts` の `spa.prerender.outputPath`）。`run_worker_first` を付けないとサーバ関数の URL までシェルに吸われる。

自前の振り分け案は落とした。同じ結果を得るのに Worker のコードが増え、静的ファイルの判定を自分で持つことになる。設定で済むならその方が壊れにくい。

これで document は Worker を通らなくなり、`beforeLoad` はブラウザでだけ走る。設計書5.2の「ルートの `beforeLoad` と `loader` がサーバで実行されない」という前提が、記述どおりに成立するようになった。

### シェルの中身についての既知の制約

シェルにはログイン画面の HTML が焼き付く。事前生成は `spa.maskPath`（既定は `/`）へリクエストして得た結果を保存する仕組みで、`/` は未ログインなので `/login` へリダイレクトされるためである。

本来は `TSS_SHELL` ヘッダによって「シェル用の描画」に切り替わり、中身が空になるはずである。しかし Start がそれを判定する `IS_PRERENDERING` は `process.env.TSS_PRERENDERING` を実行時に読む実装で、事前生成が workerd の中で走る Cloudflare アダプタでは値が届かない。設定では回避できなかった。

害は小さいと判断した。全画面が認証必須なので、初回訪問はほぼ必ずログイン画面であり、その場合はむしろ最初の描画が速くなる。ログイン済みの利用者が `/admin` を直接開いたときだけ、セッション照会1回分のあいだログインフォームが見える。

備えとして、`src/routes/__root.tsx` の描画を `component` から `shellComponent` へ移してある。アダプタ側が直れば、こちらは変更なしでシェルの中身が空になる。

### Consequences

- 良い: document のレスポンスに Worker の CPU も D1 クエリも使わない。手元の計測では応答が 1.1 秒から 0.2 秒になった
- 良い: 設計書5.2・5.3の前提が実態と一致する
- 悪い: シェルにログイン画面が焼き付く（上記のとおり）
- 悪い: サーバ関数の URL を変えるときは `run_worker_first` も一緒に直す必要がある。忘れるとサーバ関数がシェルを返すようになる
- 悪い: 存在しない URL が 200 でシェルを返すようになった。404 の表示はクライアント側の責務になる
