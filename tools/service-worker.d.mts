import type { Plugin } from 'vite';

export function offlineLists(files: string[]): { files: string[]; audio: string[] };
export function serviceWorker(): Plugin;
