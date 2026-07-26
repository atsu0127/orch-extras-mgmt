/**
 * `cloudflare:workers` は Workers ランタイムだけが持つモジュールで、Vitest の
 * node 環境では解決できない。ルートツリーを読み込むと画面からサーバ関数まで
 * 芋づるに解決されるため、その道中で困らないだけの空の実装を置く。
 *
 * binding を実際に使うロジックはここではなく、`Db` を引数で受け取る形にして
 * `src/test/db.ts` のインメモリ DB でテストする。
 */
export const env = {} as Env
