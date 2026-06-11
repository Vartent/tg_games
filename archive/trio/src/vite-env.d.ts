/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADSGRAM_BLOCK_ID?: string;
  readonly VITE_BOT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
