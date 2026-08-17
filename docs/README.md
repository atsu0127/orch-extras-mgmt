# ドキュメント案内

## 正の読み方

| 種類 | 場所 |
| --- | --- |
| 横断基盤（技術・認証・無料枠・CI・ADR 索引） | [platform/design.md](./platform/design.md) |
| 機能の仕様 | `docs/<feature>/design.md` |
| 機能のタスク・進捗 | `docs/<feature>/tasks.md` |
| 設計判断の記録 | [adr/](./adr/) |
| 初期案（凍結参照・編集しない） | [archive/initial/](./archive/initial/) |

新しい機能を始めるときは `docs/<feature>/` を作り、そこに `design.md` と `tasks.md` を置く。`docs/superpowers/` へ新規の仕様書・計画書は作らない（履歴として残っているものはそのままでよい）。

未切り出しの画面・データモデルは、触るまで [archive/initial/design.md](./archive/initial/design.md) を**凍結参照**する（編集しない。内容を変える必要が出たら機能ディレクトリか platform へ移してから更新する）。切り出すときは機能ディレクトリへ移し、platform や本 README の索引を更新する。

**「正」の見分け方**

- 生きている正: `docs/platform/design.md` と各 `docs/<feature>/`
- 凍結参照: `docs/archive/initial/`（履歴。索引やタスク進捗の更新先にしない）
- ADR の新規索引行は platform の決定記録へだけ足す

## 機能一覧

| 機能 | 設計 | タスク | 状態 |
| --- | --- | --- | --- |
| AI案内 | [design.md](./ai-assistant/design.md) | [tasks.md](./ai-assistant/tasks.md) | 実装中 |
| 練習の一括作成 | [design.md](./practice-bulk-create/design.md) | [tasks.md](./practice-bulk-create/tasks.md) | 完了 |
| 曲の楽譜リンク（あり／なし） | [design.md](./piece-score-links/design.md) | [tasks.md](./piece-score-links/tasks.md) | 完了 |

お知らせ・会場 CRUD・ダッシュボード等の既存機能は、まだ個別ディレクトリ未作成。仕様は [archive/initial/design.md](./archive/initial/design.md) を凍結参照する。

## その他

- [受け入れ確認ガイド](./acceptance-guide.md)
- [セキュリティ点検（T8-1）](./security-review-t8.md)
- [improve-react 計画](./improve-react/README.md)（React 監査の実行用計画。機能の正ではない）
