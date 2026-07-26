---
status: "accepted"
date: 2026-07-26
---

# CSRF 対策は更新系に限らず全サーバ関数に掛ける

## Context and Problem Statement

設計書8.5は「更新系サーバ関数では `Origin` ヘッダが自サイトと一致することを確認する」と定めている。T2-7 でこれを実装するにあたり、TanStack Start に `createCsrfMiddleware` が用意されていることが分かった。

この middleware は `Sec-Fetch-Site` を優先して見て、無ければ `Origin`、それも無ければ `Referer` を見る。一致しなければ 403 を返す。

厄介なのは既定の挙動である。Start は `src/start.ts` が無ければこの middleware を自分で入れるが、`start.ts` を作って `requestMiddleware` を指定した時点で、その既定は外れる。つまり「何もしない」と「自分で並べる」の間に、**黙って防御が消える中間状態**がある。

## Considered Options

- `start.ts` を作らず、Start の既定に任せる
- `start.ts` で `createCsrfMiddleware` を明示的に並べ、全サーバ関数に掛ける
- 更新系サーバ関数にだけ、自前の `Origin` 検証 middleware を付ける

## Decision Outcome

採用: **`start.ts` で明示的に並べ、全サーバ関数に掛ける**。

「更新系だけ」を人手で維持する案は落とした。設計書8.4が読み取り系も含めて全サーバ関数に認可 middleware を要求しているのと同じ理由で、付け忘れが起きたときに気づけない。読み取り系も同一オリジンからしか呼ばれないので、全部に掛けて困らない。

既定に任せる案も落とした。今は同じ結果になるが、後から `requestMiddleware` を1つ足したい場面が来たときに、防御が外れたことに気づける保証がない。明示しておけば、少なくとも消すには書いたものを消す必要がある。

`Sec-Fetch-Site` を見る点は設計書の記述より広い。`Origin` は同一オリジンの GET では送られないことがあるのに対し、`Sec-Fetch-Site` は主要なブラウザが常に送るため、判定できる範囲が広がる。

あわせて設計書8.5のレスポンスヘッダも同じ `start.ts` の request middleware で付けることにした。ただし静的ファイルは assets binding が Worker を通さずに返すため、そちらには `public/_headers` で同じものを書いている。

### Consequences

- 良い: サーバ関数を追加しても CSRF 対策の付け忘れが起きない
- 良い: `Sec-Fetch-Site` を送るブラウザでは、`Origin` が無い読み取り要求も判定できる
- 悪い: ヘッダの指定が `src/start.ts` と `public/_headers` の2か所に分かれる。片方だけ直すと経路によって挙動が食い違う
- 悪い: サーバ関数を curl などから叩く場合、`Origin` か `Sec-Fetch-Site` を自分で付ける必要がある
