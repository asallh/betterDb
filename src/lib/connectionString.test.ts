import { describe, expect, it } from "vitest";
import {
  buildConnectionString,
  detectEngineFromHost,
  getExampleConnectionUri,
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
      uriScheme: "postgresql",
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

describe("connectionString multi-engine", () => {
  it("parses mysql, mariadb, and sqlserver URIs", () => {
    expect(
      parseConnectionString("mysql://root:secret@localhost:3306/app")
    ).toMatchObject({
      engine: "mysql",
      uriScheme: "mysql",
      host: "localhost",
      port: 3306,
      user: "root",
      password: "secret",
      database: "app",
    });
    expect(
      parseConnectionString("mariadb://root:secret@db.example.com:3306/app")
    ).toMatchObject({
      engine: "mariadb",
      uriScheme: "mariadb",
      host: "db.example.com",
    });
    expect(
      parseConnectionString(
        "sqlserver://sa:secret@localhost:1433/mydb?encrypt=true&trustServerCertificate=true"
      )
    ).toMatchObject({
      engine: "sqlserver",
      uriScheme: "sqlserver",
      host: "localhost",
      port: 1433,
      database: "mydb",
      ssl: true,
      trustServerCertificate: true,
    });
  });

  it("parses mongodb and mongodb+srv URIs", () => {
    expect(
      parseConnectionString("mongodb://user:pass@localhost:27017/mydb")
    ).toMatchObject({
      engine: "mongodb",
      uriScheme: "mongodb",
      host: "localhost",
      port: 27017,
      user: "user",
      password: "pass",
      database: "mydb",
    });
    expect(
      parseConnectionString("mongodb+srv://user:pass@cluster.example.com/mydb")
    ).toMatchObject({
      engine: "mongodb",
      uriScheme: "mongodb+srv",
      host: "cluster.example.com",
      database: "mydb",
      ssl: true,
    });
  });

  it("parses redis and rediss URIs", () => {
    expect(parseConnectionString("redis://:s3cret@localhost:6379/0")).toMatchObject({
      engine: "redis",
      uriScheme: "redis",
      host: "localhost",
      port: 6379,
      password: "s3cret",
      database: "0",
    });
    expect(parseConnectionString("rediss://localhost:6379/0")).toMatchObject({
      engine: "redis",
      uriScheme: "rediss",
      ssl: true,
    });
  });

  it("parses sqlite and cockroach URIs", () => {
    expect(parseConnectionString("sqlite:///tmp/app.db")).toMatchObject({
      engine: "sqlite",
      uriScheme: "sqlite",
      database: "/tmp/app.db",
      host: "",
    });
    expect(
      parseConnectionString("cockroach://root@localhost:26257/defaultdb")
    ).toMatchObject({
      engine: "cockroach",
      uriScheme: "cockroach",
      host: "localhost",
      port: 26257,
      database: "defaultdb",
    });
  });

  it("builds the correct scheme per engine", () => {
    expect(
      buildConnectionString({
        engine: "mysql",
        host: "localhost",
        port: 3306,
        database: "app",
        user: "root",
        password: "secret",
        ssl: false,
      })
    ).toBe("mysql://root:secret@localhost:3306/app");

    expect(
      buildConnectionString({
        engine: "mongodb",
        host: "localhost",
        port: 27017,
        database: "mydb",
        user: "user",
        password: "pass",
        ssl: false,
      })
    ).toBe("mongodb://user:pass@localhost:27017/mydb");

    expect(
      buildConnectionString({
        engine: "mongodb",
        host: "cluster.example.com",
        port: 27017,
        database: "mydb",
        user: "user",
        password: "pass",
        ssl: true,
        scheme: "mongodb+srv",
      })
    ).toBe("mongodb+srv://user:pass@cluster.example.com/mydb");

    expect(
      buildConnectionString({
        engine: "redis",
        host: "localhost",
        port: 6379,
        database: "0",
        user: "",
        password: "s3cret",
        ssl: false,
      })
    ).toBe("redis://:s3cret@localhost:6379/0");

    expect(
      buildConnectionString({
        engine: "redis",
        host: "localhost",
        port: 6379,
        database: "0",
        user: "",
        password: "",
        ssl: true,
      })
    ).toBe("rediss://localhost:6379/0");

    expect(
      buildConnectionString({
        engine: "sqlserver",
        host: "localhost",
        port: 1433,
        database: "mydb",
        user: "sa",
        password: "secret",
        ssl: true,
        trustServerCertificate: true,
      })
    ).toBe(
      "sqlserver://sa:secret@localhost:1433/mydb?encrypt=true&trustServerCertificate=true"
    );

    expect(
      buildConnectionString({
        engine: "sqlite",
        host: "",
        port: 0,
        database: "/tmp/app.db",
        user: "",
        password: "",
        ssl: false,
      })
    ).toBe("sqlite:///tmp/app.db");

    expect(
      buildConnectionString({
        engine: "cockroach",
        host: "localhost",
        port: 26257,
        database: "defaultdb",
        user: "root",
        password: "",
        ssl: false,
        scheme: "cockroach",
      })
    ).toBe("cockroach://root@localhost:26257/defaultdb");
  });

  it("never emits postgresql:// for non-Postgres-family engines", () => {
    const engines = [
      "mysql",
      "mariadb",
      "sqlserver",
      "mongodb",
      "redis",
      "oracle",
      "db2",
      "clickhouse",
      "sqlite",
    ] as const;

    for (const engine of engines) {
      const uri = buildConnectionString({
        engine,
        host: "localhost",
        port: 1,
        database: "db",
        user: "u",
        password: "p",
        ssl: false,
      });
      expect(uri.startsWith("postgresql://")).toBe(false);
      expect(uri.startsWith("postgres://")).toBe(false);
    }
  });

  it("returns engine-specific example URIs", () => {
    expect(getExampleConnectionUri("mysql")).toContain("mysql://");
    expect(getExampleConnectionUri("mongodb")).toContain("mongodb://");
    expect(getExampleConnectionUri("redis")).toContain("redis://");
    expect(getExampleConnectionUri("databricks")).toContain("databricks.com");
    expect(getExampleConnectionUri("sqlite")).toContain("sqlite://");
  });
});
