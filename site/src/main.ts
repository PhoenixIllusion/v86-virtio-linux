import './style.css'
import '../node_modules/xterm/css/xterm.css'

import { type V8StarterOptions }from './libv86.mjs';
import { FileSystem, FileSystemEntry } from './filesystem';
import { Virtio9p } from './v9pfs';



const options: V8StarterOptions = {
        wasm_path: "../assets/v86.wasm",

        screen_container: document.getElementById("screen_container") as HTMLElement,

        bios: {
            url: "assets/seabios.bin",
        },
        //*
        vga_bios: {
            url: "assets/vgabios.bin", //not needed unless using screen_container
        },
        bzimage: {
            url: "assets/bzImage"
        },
        //min-size due to Kernel min-location set to 0x1000000 (16mb), but rebuilding kernel with lower can decrease this
        //limited to ~14MB as long as also using XZ compression, due to room needed to decompress
        //can lower further if disabling XZ compression on kernel/rootfs.cpio
        memory_size: 22<<20, 
        cmdline: "tsc=reliable mitigations=off random.trust_cpu=on console=tty0,115200 console=ttyS0 quiet",
        autostart: false,
}

const encoder = new TextEncoder();
const fakeFile = (name: string, fullPath: string, content: Uint8Array) => ({
  isDir: false,
  isFile: true,
  mtime: 0,
  ctime: 0,
  atime: 0,
  name,
  size: content.byteLength,
  content,
  fullPath
})
const fakeDir = (name: string, fullPath: string) => ({
    isDir: true,
    isFile: false,
    mtime: 0,
    ctime: 0,
    atime: 0,
    size: 0,
    name,
    fullPath
})

const root = fakeDir('/','/');
const test1 = fakeFile('test.txt','/test.txt', encoder.encode('Hello World...'))
const test2 = fakeFile('test2.txt','/test2.txt', encoder.encode('...Goodbye world'))

const testFileSystem: FileSystem = {
  async walk(qid: FileSystemEntry, dirToWalk: string[]): Promise<FileSystemEntry[]> {
    switch(dirToWalk[0]) {
      case 'test.txt':
        return [test1];
      case 'test2.txt':
        return [test2];
    }
    return [];
  },
  async getRoot(): Promise<FileSystemEntry> {
    return root;
  },
  async readDir(qid: FileSystemEntry): Promise<FileSystemEntry[]> {
    return [test1,test2]
  },
  async readFile(qid: FileSystemEntry): Promise<Uint8Array> {
    switch(qid.name) {
      case 'test.txt':
        return test1.content;
      case 'test2.txt':
        return test2.content;
    }
    return new Uint8Array([]);
  }
}
const run = async() =>{
    const V86Starter = (await import('./libv86.mjs')).V86Starter;
    const emulator = new V86Starter(options);
    emulator.bus.register('emulator-loaded', () => {
      const vp9fs = new Virtio9p(emulator.v86.cpu, testFileSystem);
      emulator.run();
      setTimeout(() => {
        const data = '    mkdir -p v9 && mount -t 9p -o trans=virtio -o version=9p2000.u -o msize=8192 -o debug=100 host9p /v9';
        for(let i = 0; i < data.length; i++)
        {
          emulator.bus.send("serial0-input", data.charCodeAt(i));
        }
      },0);
    }, emulator)

    const Terminal = (await import('xterm')).default.Terminal;
    const term = new Terminal();
    term.open(document.getElementById('terminal') as HTMLElement);
    emulator.bus.register("serial0-output-char", (chr: string) => 
    {
      term.write(chr);
    }, emulator);


    term.onData((data) =>
    {
      for(let i = 0; i < data.length; i++)
      {
        emulator.bus.send("serial0-input", data.charCodeAt(i));
      }
    });
}
run();

