
export interface FileSystemEntry {
  isDir: boolean;
  isFile: boolean;
  mtime: number;
  ctime: number;
  atime: number;
  name: string;
  fullPath: string;
}

export interface FileSystem {
  walk(qid: FileSystemEntry, dirToWalk: string[]): Promise<FileSystemEntry[]>;
  getRoot(): Promise<FileSystemEntry>;
}