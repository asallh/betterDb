import { describe, expect, it } from "vitest";
import {
  isSchemaMutatingQuery,
  isSchemaMutatingStatement,
  splitStatements,
} from "./schemaMutatingQuery";

describe("isSchemaMutatingStatement", () => {
  it.each([
    "CREATE TABLE users (id int)",
    "create or replace view v as select 1",
    "ALTER TABLE users ADD COLUMN name text",
    "DROP TABLE users",
    "DROP INDEX IF EXISTS idx_users_email",
    "RENAME TABLE old TO new",
    "TRUNCATE TABLE users",
    "  \n  CREATE SCHEMA analytics",
    "-- comment\nCREATE TABLE foo (id int)",
    "/* block */\nALTER VIEW v RENAME TO w",
  ])("detects SQL DDL: %s", (sql) => {
    expect(isSchemaMutatingStatement(sql)).toBe(true);
  });

  it.each([
    "SELECT * FROM users",
    "INSERT INTO users VALUES (1)",
    "UPDATE users SET name = 'a'",
    "DELETE FROM users WHERE id = 1",
    "EXPLAIN SELECT 1",
    "WITH cte AS (SELECT 1) SELECT * FROM cte",
    "",
    "   ",
    "-- only a comment",
  ])("ignores non-DDL: %s", (sql) => {
    expect(isSchemaMutatingStatement(sql)).toBe(false);
  });

  it.each([
    'db.createCollection("orders")',
    "orders.createIndex({ email: 1 })",
    "db.users.drop()",
    "db.dropDatabase()",
    '{"create":"orders"}',
    '{ "drop": "orders" }',
    '{"createIndexes":"users","indexes":[]}',
    '{"renameCollection":"a.to.b"}',
  ])("detects Mongo mutations: %s", (sql) => {
    expect(isSchemaMutatingStatement(sql)).toBe(true);
  });

  it.each([
    '{"find":"users","filter":{}}',
    "db.users.find({})",
    '{"insert":"users","documents":[{}]}',
    '{"update":"users","updates":[]}',
    '{"delete":"users","deletes":[]}',
  ])("ignores Mongo data ops: %s", (sql) => {
    expect(isSchemaMutatingStatement(sql)).toBe(false);
  });

  it.each(["FLUSHDB", "FLUSHALL", "SWAPDB 0 1", "SELECT 2"])(
    "detects Redis schema cmds: %s",
    (sql) => {
      expect(isSchemaMutatingStatement(sql)).toBe(true);
    }
  );

  it.each(["GET foo", "SET foo bar", "DEL key", "HSET h f v", "SELECT * FROM t"])(
    "ignores Redis data cmds and SQL SELECT: %s",
    (sql) => {
      expect(isSchemaMutatingStatement(sql)).toBe(false);
    }
  );
});

describe("isSchemaMutatingQuery", () => {
  it("returns true when any statement in a multi-statement script is DDL", () => {
    expect(
      isSchemaMutatingQuery("SELECT 1; CREATE TABLE t (id int); SELECT 2")
    ).toBe(true);
  });

  it("returns false when all statements are non-DDL", () => {
    expect(
      isSchemaMutatingQuery("INSERT INTO t VALUES (1); UPDATE t SET x = 2")
    ).toBe(false);
  });
});

describe("splitStatements", () => {
  it("splits on semicolons and drops empties", () => {
    expect(splitStatements("SELECT 1; ; CREATE TABLE t (id int);")).toEqual([
      "SELECT 1",
      "CREATE TABLE t (id int)",
    ]);
  });
});
