---
status: "accepted"
date: 2026-08-29
---

# アプリは Workers Logs、LLM 本文は AI Gateway に残し、Langfuse と Traces は見送る

## Context and Problem Statement

本番にアプリケーションログも LLM の品質ログも無い。サーバ関数の失敗と、AI案内が「なぜその回答になったか」（質問・ツール結果・最終出力）を追いたい。遅延トレースは不要。影響は Worker のログ出力、Anthropic クライアントの宛先、AI案内のプライバシー方針。

## Considered Options

- Cloudflare 完結: 構造化 `console.log` を Workers Logs へ。LLM 本文は AI Gateway。1質問は `questionId` で Gateway の2本の HTTP ログを結ぶ
- Langfuse を主にする: 1質問を1本のトレース木にし、評価・データセットまで使う
- Workers Traces を足す: fetch / D1 の自動計装で遅延と依存関係を見る
- 本文も Workers Logs か D1 に残す

## Decision Outcome

採用: **Workers Logs のメタデータ＋AI Gateway の本文**。Langfuse は「より良い Gateway」ではなく品質を継続的に回す別レイヤーで、サブリクエスト・Workers 上の SDK・CPU 10ms・登録情報の社外保存が増える。今の規模（日80問上限、数名）では Gateway の turn 1/2 を手で読めば足りる。Traces は遅延が要件に無く、D1 スパンが SQL（検索キーワード）を持ちうる。本文を Worker ログや D1 に出すと、AI案内が禁じている質問・回答の保存になる。

Gateway のキャッシュと自動リトライは使わない。登録情報の鮮度とアプリの `maxRetries: 0` を壊すため。

### Consequences

- 良い: 無料枠と既存の Cloudflare アカウント内で完結する。サブリクエストが増えない。Claude 前の失敗はアプリログ、品質の本文は Gateway、という役割分担が明確
- 悪い: 1質問が1画面の木にならない。スコアやプロンプト版比較が要るようになったら Langfuse を次段として足す
- 悪い: 質問・ツール結果・回答が Cloudflare AI Gateway に残る。Worker ログ禁止の例外として設計に明記し、認証付き Gateway に限る
