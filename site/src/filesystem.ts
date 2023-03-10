
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

export interface CreationParams {
  name: string,
  perm: number,
  mode: number,
  extension: string
}

export interface FileSystem {
  walk(qid: FileSystemEntry, dirToWalk: string[]): Promise<FileSystemEntry[]>;
  readDir(qid: FileSystemEntry): Promise<FileSystemEntry[]>;
  readFile(qid: FileSystemEntry, offset: number, len: number): Promise<Uint8Array>;
  getRoot(): Promise<FileSystemEntry>;
  createDir(parent: FileSystemEntry, params: CreationParams): Promise<FileSystemEntry>;
  createFile(parent: FileSystemEntry, params: CreationParams): Promise<FileSystemEntry>;
  writeFile(qid: FileSystemEntry, offset: number, buffer: Uint8Array): Promise<number>;
  rename(qid: FileSystemEntry, newName: string): Promise<void>;
  resize(qid: FileSystemEntry, size0: number, size1: number): Promise<void>;
  remove(qid: FileSystemEntry): Promise<void>;
  onOpen(qid: FileSystemEntry): Promise<void>;
  onClose(qid: FileSystemEntry): Promise<void>;
}