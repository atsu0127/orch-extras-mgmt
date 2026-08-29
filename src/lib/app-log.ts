/**
 * Workers Logs がフィールドで索引できるよう、文字列連結せずオブジェクトを渡す
 * （docs/observability/design.md 4章）。
 */
export function emitAppLog(entry: object): void {
  console.log(entry)
}
