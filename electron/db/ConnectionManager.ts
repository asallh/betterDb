import { DatabaseAdapter } from "./DatabaseAdapter";
import { PostgresAdapter } from "./PostgresAdapter";
import type { ConnectionConfig } from "../../shared/types";

export class ConnectionManager {
  private activeAdapter: DatabaseAdapter | null = null;
  private activeConnectionId: string | null = null;

  createAdapter(config: ConnectionConfig): DatabaseAdapter {
    switch (config.engine) {
      case "postgres":
        return new PostgresAdapter(config);
      default:
        throw new Error(`Unsupported engine: ${config.engine}`);
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
