declare module 'node:fs' {
  interface ReadableFile extends Uint8Array {
    toString(encoding: string, start?: number, end?: number): string;
    readUInt32LE(offset: number): number;
  }
  export function readFileSync(path: URL): ReadableFile;
}
