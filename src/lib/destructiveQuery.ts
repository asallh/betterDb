/**
 * Detects queries that permanently delete data or objects so the UI can
 * confirm before running. Intentionally simple — not a full SQL parser.
 */

import { splitStatements, stripLeadingNoise } from "./schemaMutatingQuery";

/** SQL that removes rows or drops objects. */
const SQL_DESTRUCTIVE = /^\s*(DROP|DELETE|TRUNCATE)\b/i;

/** MongoDB shell / JSON that drops collections or databases. */
const MONGO_DROP_SHELL = /\bdropDatabase\s*\(/i;
const MONGO_DROP_JSON = /^\s*\{\s*"drop(?:Database)?"\s*:/i;
const MONGO_COLL_DROP = /\.drop\s*\(\s*\)/;

/** Redis commands that destroy keys or flush databases. */
const REDIS_DESTRUCTIVE = /^\s*(FLUSHDB|FLUSHALL|DEL|UNLINK)\b/i;

export function isDestructiveStatement(statement: string): boolean {
  const s = stripLeadingNoise(statement);
  if (!s) return false;

  if (SQL_DESTRUCTIVE.test(s)) return true;
  if (MONGO_DROP_SHELL.test(s)) return true;
  if (MONGO_DROP_JSON.test(s)) return true;
  if (MONGO_COLL_DROP.test(s)) return true;
  if (REDIS_DESTRUCTIVE.test(s)) return true;

  return false;
}

/** True if any statement in the query text looks destructive. */
export function isDestructiveQuery(sql: string): boolean {
  return splitStatements(sql).some(isDestructiveStatement);
}

function summarizeStatement(statement: string): string {
  const s = stripLeadingNoise(statement);
  const sqlMatch = s.match(/^\s*(DROP|DELETE|TRUNCATE)\b(?:\s+(\w+))?/i);
  if (sqlMatch) {
    const verb = sqlMatch[1].toUpperCase();
    const object = sqlMatch[2]?.toUpperCase();
    if (object && /^(TABLE|VIEW|SCHEMA|INDEX|DATABASE|COLLECTION)$/i.test(object)) {
      return `${verb} ${object}`;
    }
    return verb;
  }
  if (MONGO_COLL_DROP.test(s)) return "drop()";
  if (MONGO_DROP_SHELL.test(s) || /dropDatabase/i.test(s)) return "dropDatabase";
  if (MONGO_DROP_JSON.test(s)) return "drop";
  const redisMatch = s.match(/^\s*(FLUSHDB|FLUSHALL|DEL|UNLINK)\b/i);
  if (redisMatch) return redisMatch[1].toUpperCase();
  return "destructive statement";
}

/** Short human-readable summary for confirm dialogs. */
export function summarizeDestructiveQuery(sql: string): string {
  const destructive = splitStatements(sql).filter(isDestructiveStatement);
  if (destructive.length === 0) return "Destructive query";
  if (destructive.length === 1) {
    return summarizeStatement(destructive[0]);
  }
  const first = summarizeStatement(destructive[0]);
  return `${first} (+${destructive.length - 1} more)`;
}
