/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface Window {
  env?: {
    platform: string;
  };
}
