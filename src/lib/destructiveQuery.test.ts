import { describe, expect, it } from "vitest";
import {
  isDestructiveQuery,
  isDestructiveStatement,
  summarizeDestructiveQuery,
} from "./destructiveQuery";

describe("isDestructiveStatement", () => {
  it.each([
    "DROP TABLE users",
    "drop view if exists v",
    "DELETE FROM users WHERE id = 1",
    "delete from users",
    "TRUNCATE TABLE users",
    "TRUNCATE users",
    "-- comment\nDROP TABLE foo",
    "/* block */\nDELETE FROM t",
  ])("detects SQL destructive: %s", (sql) => {
    expect(isDestructiveStatement(sql)).toBe(true);
  });

  it.each([
    "SELECT * FROM users",
    "INSERT INTO users VALUES (1)",
    "UPDATE users SET name = 'a'",
    "CREATE TABLE users (id int)",
    "ALTER TABLE users ADD COLUMN name text",
    "EXPLAIN SELECT 1",
    "",
    "   ",
    "-- only a comment",
  ])("ignores non-destructive: %s", (sql) => {
    expect(isDestructiveStatement(sql)).toBe(false);
  });

  it.each([
    "db.users.drop()",
    "db.dropDatabase()",
    '{ "drop": "orders" }',
    '{"dropDatabase":1}',
  ])("detects Mongo drops: %s", (sql) => {
    expect(isDestructiveStatement(sql)).toBe(true);
  });

  it.each([
    '{"find":"users","filter":{}}',
    "db.users.find({})",
    '{"delete":"users","deletes":[]}',
    "db.createCollection(\"orders\")",
  ])("ignores Mongo non-drop ops: %s", (sql) => {
    expect(isDestructiveStatement(sql)).toBe(false);
  });

  it.each(["FLUSHDB", "FLUSHALL", "DEL key", "UNLINK a b"])(
    "detects Redis destructive: %s",
    (sql) => {
      expect(isDestructiveStatement(sql)).toBe(true);
    }
  );

  it.each(["GET foo", "SET foo bar", "HSET h f v", "SELECT * FROM t"])(
    "ignores Redis data cmds and SQL SELECT: %s",
    (sql) => {
      expect(isDestructiveStatement(sql)).toBe(false);
    }
  );
});

describe("isDestructiveQuery", () => {
  it("returns true when any statement is destructive", () => {
    expect(
      isDestructiveQuery("SELECT 1; DELETE FROM users; SELECT 2")
    ).toBe(true);
  });

  it("returns false when no statement is destructive", () => {
    expect(isDestructiveQuery("SELECT 1; UPDATE t SET a = 1")).toBe(false);
  });
});

describe("summarizeDestructiveQuery", () => {
  it("summarizes a single DROP TABLE", () => {
    expect(summarizeDestructiveQuery("DROP TABLE users")).toBe("DROP TABLE");
  });

  it("summarizes DELETE", () => {
    expect(summarizeDestructiveQuery("DELETE FROM users WHERE id = 1")).toBe(
      "DELETE"
    );
  });

  it("notes additional destructive statements", () => {
    expect(
      summarizeDestructiveQuery("DELETE FROM a; DROP TABLE b")
    ).toBe("DELETE (+1 more)");
  });
});
