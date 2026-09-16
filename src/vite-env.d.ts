/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_CHANNEL__: "dev" | "auto";

interface Window {
  env?: {
    platform: string;
  };
}
