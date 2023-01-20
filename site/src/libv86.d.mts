interface WasmExportsTable {
  exports: WebAssembly.Exports;
  wasm_table: WebAssembly.Table
}

type AnyFunc = (... args: any[]) => void;

export class BusConnector {
  listeners: {[name: string]: {fn: AnyFunc , this_value: any}};
  register(name: string, fn: AnyFunc, this_value: any);
  unregister(name: string, fn: AnyFunc);
  send(name: string, value: any);
  send_async(name: string, value: any)
}
export type Bus = {0: BusConnector, 1: BusConnector}

interface ImagesUrl {
  url: string;
  async?: boolean;
  size?: number;
} 
interface ImageBuffer {
  buffer: ArrayBuffer;
}
type ImageObject = ImagesUrl|ImageBuffer;


export class CPU {
  emulator_bus: BusConnector;
  constructor(public bus: BusConnector, wm: WasmExportsTable, next_tick_immediately: () => void);
  clear_opstats();
  create_jit_imports();
  wasm_patch();
  jit_force_generate();
  jit_clear_func();
  jit_clear_all_funcs();
  get_state(): any[];
  set_state(state: any[]): void;
  pack_memory(): { bitmap: any, packed_memory: any };
  unpack_memory(pack: { bitmap: any, packed_memory: any });
  main_run(): number;
  reboot_internal(): void;
  reset_memory(): void;
  create_memory(size: number);
  init(settings: any, device_bus: any);
  load_multiboot(buffer: ArrayBuffer);
  fill_cmos (rtc, settings);
  load_bios():void;
}

export interface V8StarterOptions {
  wasm_path?: string,
  memory_size?: number;
  vga_memory_size?: number;
  autostart?: boolean;
  disable_keyboard?: boolean;
  disable_mouse?: boolean;
  network_relay_url?: string;

  bios?: ImageObject;
  vga_bios?: ImageObject;
  hda?: ImageObject;
  fda?: ImageObject;
  cdrom?: ImageObject;

  bzimage?: ImageObject;
  initrd?: ImageObject;
  bzimage_initrd_from_filesystem?: boolean;

  initial_state?: any;

  filesystem?: any;
  cmdline?: string;
  serial_container?: HTMLTextAreaElement;
  screen_container?: HTMLElement;
}

export class v86 {
  cpu: CPU;
  constructor(public bus: BusConnector, wasm: WasmExportsTable);
  run(): void;
  do_tick(): void;
  stop(): void;
  init(settings: any);

}

export class V86Starter {
  v86: v86;
  bus: BusConnector;
  emulator_bus: BusConnector;
  constructor(options: V8StarterOptions);
  run(): void;
  stop(): void;
  destroy(): void;
  restart(): void;
  add_listener(event: string, listener: AnyFunc);
  remove_listener(event: string, listener: AnyFunc);
  is_running(): boolean;
}

export interface VirtQueue_Options {
  size_supported: number,
  notify_offset: number,
}

interface VirtIO_CapabilityStruct {
  bytes: number,
  name: string,
  read: ()=>number,
  write: (arg: number) => void
}

export interface VirtIOConfig {
  name: string;
  pci_id: number;
  device_id: number;
  subsystem_device_id: number;
  common: {
    initial_port: number;
    queues: VirtQueue_Options[];
    features: number[];
    on_driver_ok: () => void;
  }
  notification: {
    initial_port: number,
    single_handler: boolean,
    handlers: ((queue_id: number) => void)[]
  }
  isr_status: {
    initial_port: number;
  }
  device_specific: {
    initial_port: number;
    struct: VirtIO_CapabilityStruct[]
  }
}

class VirtQueueBufferChain {
  length_readable: number;
  constructor(virtqueue: VirtQueue, head_idx: number);
  get_next_blob(dest_buffer: Uint8Array): number;
  set_next_blob(src_buffer: Uint8Array): number;
}

export class VirtQueue {
  cpu: CPU;
  virtio: VirtIO;

  get_state(): any[];
  set_state(state: any[]): void;
  reset(): void;

  has_request(): boolean;
  pop_request(): VirtQueueBufferChain;
  push_reply(bufchain: VirtQueueBufferChain);
  notify_me_after(number): void;
  flush_replies(): void;
}

export class VirtIO {
  cpu: CPU;
  name: string;
  device_id: number;
  queues: VirtQueue[];
  constructor(cpu: CPU, config: VirtIOConfig);

  get_state(): any[];
  set_state(state: any[]): void;
  reset(): void;

}

interface V86Util {
  pads(str: string, len: number): string;
  pad0(str: string, len: number): string;
  zeros(size: number): number[];
  range(size: number): number[];
}

export const v86util: V86Util;
