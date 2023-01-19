import './style.css'
import '../node_modules/xterm/css/xterm.css'

import { V86Starter, V8StarterOptions }from './libv86.mjs';

import { Terminal } from 'xterm';



const options: V8StarterOptions = {
        wasm_path: "../assets/v86.wasm",

        //screen_container: document.getElementById("screen_container") as HTMLElement,

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
        memory_size: 20<<20, 
        cmdline: "tsc=reliable mitigations=off random.trust_cpu=on console=tty0,115200 console=ttyS0 quiet",
        autostart: true,
}
const emulator = new V86Starter(options);


const term = new Terminal();
term.open(document.getElementById('terminal') as HTMLElement);
emulator.bus.register("serial0-output-char", (chr: string) => 
{
  term.write(chr);
});


term.onData((data) =>
{
  for(let i = 0; i < data.length; i++)
  {
    emulator.bus.send("serial0-input", data.charCodeAt(i));
  }
});


