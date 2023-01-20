
export interface FileSystemEntry {
  isDir: boolean;
  isFile: boolean;
  mtime: number;
  ctime: number;
  atime: number;
  name: string;
  size: number;
  fullPath: string;
}

export interface FileSystem {
  walk(qid: FileSystemEntry, dirToWalk: string[]): Promise<FileSystemEntry[]>;
  readDir(qid: FileSystemEntry): Promise<FileSystemEntry[]>;
  readFile(qid: FileSystemEntry): Promise<Uint8Array>;
  getRoot(): Promise<FileSystemEntry>;
}