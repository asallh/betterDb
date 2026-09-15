import { BigQueryAdapter } from "./BigQueryAdapter";
import { ClickHouseAdapter } from "./ClickHouseAdapter";
import { DatabaseAdapter } from "./DatabaseAdapter";
import { MariaDbAdapter } from "./MariaDbAdapter";
import { MongoAdapter } from "./MongoAdapter";
import { MySqlAdapter } from "./MySqlAdapter";
import { OracleAdapter } from "./OracleAdapter";
import { PostgresAdapter } from "./PostgresAdapter";
import { RedisAdapter } from "./RedisAdapter";
import { SnowflakeAdapter } from "./SnowflakeAdapter";
import { SqlServerAdapter } from "./SqlServerAdapter";
import { SqliteAdapter } from "./SqliteAdapter";
import type { ConnectionConfig } from "../../shared/types";

export class ConnectionManager {
  private activeAdapter: DatabaseAdapter | null = null;
  private activeConnectionId: string | null = null;

  createAdapter(config: ConnectionConfig): DatabaseAdapter {
    switch (config.engine) {
      case "sqlserver":
        return new SqlServerAdapter(config);
      case "mysql":
        return new MySqlAdapter(config);
      case "mariadb":
        return new MariaDbAdapter(config);
      case "oracle":
        return new OracleAdapter(config);
      case "sqlite":
        return new SqliteAdapter(config);
      case "snowflake":
        return new SnowflakeAdapter(config);
      case "clickhouse":
        return new ClickHouseAdapter(config);
      case "bigquery":
        return new BigQueryAdapter(config);
      case "mongodb":
        return new MongoAdapter(config);
      case "redis":
        return new RedisAdapter(config);
      case "postgres":
      case "supabase":
      case "aws":
      case "databricks":
      default:
        // Supabase, AWS RDS, and Databricks continue through the PostgreSQL-compatible path.
        return new PostgresAdapter(config);
    }
  }

  async connect(config: ConnectionConfig): Promise<void> {
    // Disconnect existing connection first
    if (this.activeAdapter) {
      await this.disconnect();
    }
    const adapter = this.createAdapter(config);
    await adapter.connect();
    this.activeAdapter = adapter;
    this.activeConnectionId = config.id;
  }

  async disconnect(): Promise<void> {
    if (this.activeAdapter) {
      await this.activeAdapter.disconnect();
      this.activeAdapter = null;
      this.activeConnectionId = null;
    }
  }

  getActive(): DatabaseAdapter | null {
    return this.activeAdapter;
  }

  getActiveConnectionId(): string | null {
    return this.activeConnectionId;
  }

  async testConnection(
    config: ConnectionConfig
  ): Promise<{ success: boolean; error?: string }> {
    const adapter = this.createAdapter(config);
    return adapter.testConnection();
  }
}
