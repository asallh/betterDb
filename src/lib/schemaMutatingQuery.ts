/**
 * Detects whether a query is likely to have changed schema metadata
 * (tables, views, indexes, collections, etc.) so the sidebar can refresh.
 *
 * Intentionally simple — not a full SQL parser. False positives are cheap
 * (an extra refresh); false negatives mean a stale sidebar until manual refresh.
 */

const SQL_DDL =
  /^\s*(CREATE|ALTER|DROP|RENAME|TRUNCATE)\b/i;

/** MongoDB shell sugar that mutates collections / indexes / databases. */
const MONGO_SHELL =
  /\b(?:createCollection|dropDatabase|createIndex|createIndexes|dropIndex|dropIndexes|renameCollection)\s*\(/i;

/** MongoDB JSON commands that mutate schema (wire-protocol style). */
const MONGO_JSON_KEYS =
  /^\s*\{\s*"(?:create|drop|createIndexes|dropIndexes|renameCollection|collMod|createView)"\s*:/i;

/** Redis commands that change which databases/keyspaces matter in the tree. */
const REDIS_SCHEMA = /^\s*(FLUSHDB|FLUSHALL|SWAPDB)\b/i;
/** Redis SELECT db-index — must not match SQL SELECT. */
const REDIS_SELECT_DB = /^\s*SELECT\s+\d+\s*$/i;

/** Strip leading line/block comments so DDL after a comment still matches. */
function stripLeadingNoise(statement: string): string {
  let s = statement.trim();
  for (;;) {
    if (s.startsWith("--")) {
      const nl = s.indexOf("\n");
      if (nl === -1) return "";
      s = s.slice(nl + 1).trim();
      continue;
    }
    if (s.startsWith("/*")) {
      const end = s.indexOf("*/");
      if (end === -1) return "";
      s = s.slice(end + 2).trim();
      continue;
    }
    break;
  }
  return s;
}

/** Split on `;` for multi-statement scripts. Strings with `;` are an accepted limitation. */
export function splitStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((part) => stripLeadingNoise(part))
    .filter(Boolean);
}

export function isSchemaMutatingStatement(statement: string): boolean {
  const s = stripLeadingNoise(statement);
  if (!s) return false;

  if (SQL_DDL.test(s)) return true;
  if (MONGO_SHELL.test(s)) return true;
  if (MONGO_JSON_KEYS.test(s)) return true;
  if (REDIS_SCHEMA.test(s) || REDIS_SELECT_DB.test(s)) return true;

  // Mongo shell: db.foo.drop() / collection.drop()
  if (/\.drop\s*\(\s*\)/.test(s)) return true;

  return false;
}

/** True if any statement in the query text looks schema-mutating. */
export function isSchemaMutatingQuery(sql: string): boolean {
  return splitStatements(sql).some(isSchemaMutatingStatement);
}
