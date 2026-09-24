import { describe, expect, it } from "vitest";
import {
  buildConnectionString,
  detectEngineFromHost,
  isCloudHost,
  isLakebaseHost,
  parseConnectionString,
  stripSslMode,
} from "./connectionString";
import { getDefaultDatabase } from "./databaseEngines";

describe("connectionString Lakebase Autoscaling", () => {
  it("parses OAuth URIs where the role is an email (contains @)", () => {
    const parsed = parseConnectionString(
      "postgresql://you@company.com@ep-abc-123.databricks.com/databricks_postgres?sslmode=require"
    );
    expect(parsed).toMatchObject({
      engine: "databricks",
      host: "ep-abc-123.databricks.com",
      user: "you@company.com",
      password: "",
      database: "databricks_postgres",
      ssl: true,
      port: 5432,
    });
  });

  it("parses password auth against regional Autoscaling hosts", () => {
    const parsed = parseConnectionString(
      "postgresql://app_role:s3cret@ep-example-endpoint-a1b2c3d4.database.us-east-1.cloud.databricks.com/databricks_postgres?sslmode=require"
    );
    expect(parsed).toMatchObject({
      engine: "databricks",
      host: "ep-example-endpoint-a1b2c3d4.database.us-east-1.cloud.databricks.com",
      user: "app_role",
      password: "s3cret",
      database: "databricks_postgres",
      ssl: true,
    });
  });

  it("parses percent-encoded email roles and jdbc: prefixes", () => {
    const parsed = parseConnectionString(
      "jdbc:postgresql://user%40example.com:token@ep-abc-123.databricks.com/databricks_postgres?sslmode=require"
    );
    expect(parsed).toMatchObject({
      engine: "databricks",
      user: "user@example.com",
      password: "token",
      host: "ep-abc-123.databricks.com",
    });
  });

  it("parses libpq keyword/value connection strings from Databricks docs", () => {
    const parsed = parseConnectionString(
      "host=ep-abc-123.database.us-east-1.cloud.databricks.com port=5432 user=role_name password=oauth-token dbname=databricks_postgres sslmode=require"
    );
    expect(parsed).toMatchObject({
      engine: "databricks",
      host: "ep-abc-123.database.us-east-1.cloud.databricks.com",
      port: 5432,
      user: "role_name",
      password: "oauth-token",
      database: "databricks_postgres",
      ssl: true,
    });
  });

  it("detects Lakebase provisioned and autoscaling hostnames", () => {
    expect(
      isLakebaseHost(
        "ep-example-endpoint-a1b2c3d4.database.us-east-1.cloud.databricks.com"
      )
    ).toBe(true);
    expect(
      isLakebaseHost(
        "instance-a1b2c3d4-e5f6-7890-abcd-ef1234567890.database.cloud.databricks.com"
      )
    ).toBe(true);
    expect(isLakebaseHost("ep-abc-123.databricks.com")).toBe(true);
    expect(isCloudHost("ep-abc-123.databricks.com")).toBe(true);
    expect(detectEngineFromHost("ep-abc-123.databricks.com")).toBe("databricks");
    expect(detectEngineFromHost("db.example.com")).toBe("postgres");
  });

  it("rebuilds a URI with an encoded email role", () => {
    const uri = buildConnectionString({
      engine: "databricks",
      host: "ep-abc-123.databricks.com",
      port: 5432,
      database: "databricks_postgres",
      user: "you@company.com",
      password: "tok",
      ssl: true,
    });
    expect(uri).toBe(
      "postgresql://you%40company.com:tok@ep-abc-123.databricks.com:5432/databricks_postgres?sslmode=require"
    );
    expect(parseConnectionString(uri)?.user).toBe("you@company.com");
  });

  it("strips sslmode from URI and libpq strings for the driver", () => {
    expect(
      stripSslMode(
        "postgresql://u:p@ep-abc.databricks.com/databricks_postgres?sslmode=require"
      )
    ).toBe("postgresql://u:p@ep-abc.databricks.com/databricks_postgres");
    expect(
      stripSslMode(
        "host=ep-abc.databricks.com port=5432 dbname=databricks_postgres sslmode=require"
      )
    ).toBe("host=ep-abc.databricks.com port=5432 dbname=databricks_postgres");
  });
});

describe("connectionString general", () => {
  it("parses a standard postgres URI", () => {
    expect(
      parseConnectionString("postgresql://postgres:secret@localhost:5432/app")
    ).toMatchObject({
      engine: "postgres",
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: "secret",
      database: "app",
    });
  });

  it("returns null for empty or unknown schemes", () => {
    expect(parseConnectionString("")).toBeNull();
    expect(parseConnectionString("not-a-uri")).toBeNull();
    expect(parseConnectionString("foo://bar")).toBeNull();
  });

  it("uses Databricks Lakebase default database name", () => {
    expect(getDefaultDatabase("databricks")).toBe("databricks_postgres");
  });
});
