# ドキュメント案内

## 正の読み方

| 種類 | 場所 |
| --- | --- |
| 横断基盤（技術・認証・無料枠・CI・ADR 索引） | [platform/design.md](./platform/design.md) |
| 機能の仕様 | `docs/<feature>/design.md` |
| 機能のタスク・進捗 | `docs/<feature>/tasks.md` |
| 設計判断の記録 | [adr/](./adr/) |
| 初期案（参照用・正ではない） | [archive/initial/](./archive/initial/) |

新しい機能を始めるときは `docs/<feature>/` を作り、そこに `design.md` と `tasks.md` を置く。`docs/superpowers/` へ新規の仕様書・計画書は作らない（履歴として残っているものはそのままでよい）。

未切り出しの画面・データモデルは、触るまで [archive/initial/design.md](./archive/initial/design.md) を参照してよい。切り出すときは機能ディレクトリへ移し、platform や README の索引を更新する。

## 機能一覧

| 機能 | 設計 | タスク | 状態 |
| --- | --- | --- | --- |
| サークルスクエア同期 | [design.md](./circle-square-sync/design.md) | [tasks.md](./circle-square-sync/tasks.md) | 設計済み・調査待ち（T1） |

お知らせ・会場 CRUD・ダッシュボード等の既存機能は、まだ個別ディレクトリ未作成。仕様は [archive/initial/design.md](./archive/initial/design.md) を参照。

## その他

- [受け入れ確認ガイド](./acceptance-guide.md)
- [セキュリティ点検（T8-1）](./security-review-t8.md)
