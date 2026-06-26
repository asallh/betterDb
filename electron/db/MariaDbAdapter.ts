import type { ConnectionConfig } from "../../shared/types";
import { MySqlAdapter } from "./MySqlAdapter";

export class MariaDbAdapter extends MySqlAdapter {
  constructor(config: ConnectionConfig) {
    super(config);
  }
}
