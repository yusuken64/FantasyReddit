/// <reference types="node" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Polyfill for crypto.getRandomValues (needed for some dev environments)
import crypto from 'crypto'

if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = {
    getRandomValues: (typedArray: any) => crypto.randomFillSync(typedArray),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
