/// <reference types="vite/client" />

declare module 'jschardet' {
  export interface DetectionResult {
    encoding: string;
    confidence: number;
  }
  export function detect(input: string): DetectionResult;
}
