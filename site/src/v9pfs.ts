/*
Virtio 9P work

Deriving from:

Kernel Headers: https://github.com/torvalds/linux/tree/master/include/net/9p

https://github.com/ozaki-r/arm-js/blob/master/js/9p.js
https://github.com/copy/v86/blob/master/lib/9p.js
https://github.com/Xilinx/qemu/blob/master/hw/9pfs
https://github.com/chaos/diod/tree/master/libnpfs

http://9p.io/sources/plan9/sys/src/lib9p/srv.c

Documentation:
github: https://github.com/ericvh/9p-rfc

P2000  : http://ericvh.github.io/9p-rfc/rfc9p2000.html
P2000.u: http://ericvh.github.io/9p-rfc/rfc9p2000.u.html


*/

import { BusConnector, CPU, VirtIO, VirtQueue, v86util, VirtQueueBufferChain, VirtIO_CapabilityStruct } from './libv86.mjs';
import { Marshall, MarshallType } from './marshall.js';
import { FileSystem, FileSystemEntry } from './filesystem'
import { P9Command, P9QidTypes } from './p9.js';
import { ErrorCodes } from './errors.js';

// Feature bit (bit position) for mount tag.
const VIRTIO_9P_F_MOUNT_TAG = 0;
// Assumed max tag length in bytes.
const VIRTIO_9P_MAX_TAGLEN = 254;

// TODO

interface P9FileSystemEntry extends FileSystemEntry {
  type: number;
  crc32: number;
  isOpen: boolean;
  mode: number;
}


// Feature bits (bit positions).

const VIRTIO_F_RING_INDIRECT_DESC = 28;
const VIRTIO_F_RING_EVENT_IDX = 29;
const VIRTIO_F_VERSION_1 = 32;


const dbg_assert = (test: boolean, ...message: string[]) => {
  if (!test) {
    console.error(...message);
    throw Error(message[0]);
  }
}
const message = {
  Debug: (msg: string) => {
    console.warn(msg);
  }
}

export class Virtio9p {

  configspace_tagname = [0x68, 0x6F, 0x73, 0x74, 0x39, 0x70]; // "host9p" string
  configspace_taglen = this.configspace_tagname.length; // num bytes
  VERSION = "9P2000.u";
  BLOCKSIZE = 8192; // Let's define one page.
  msize = 8192; // maximum message size
  replybuffer = new Uint8Array(this.msize * 2); // Twice the msize to stay on the safe site
  replybuffersize = 0;

  virtio: VirtIO;
  virtqueue: VirtQueue;


  fid2qid: {[fid: number]: P9FileSystemEntry} = {};
  path2qid: {[path: string]: P9FileSystemEntry} = {};

  constructor(cpu: CPU, private fs: FileSystem) {
    this.virtio = new VirtIO(cpu,
      {
        name: "virtio-9p",
        pci_id: 0x06 << 3,
        device_id: 0x1049,
        subsystem_device_id: 9,
        common:
        {
          initial_port: 0xA800,
          queues:
            [
              {
                size_supported: 32,
                notify_offset: 0,
              },
            ],
          features:
            [
              VIRTIO_9P_F_MOUNT_TAG,
              VIRTIO_F_VERSION_1,
              VIRTIO_F_RING_EVENT_IDX,
              VIRTIO_F_RING_INDIRECT_DESC,
            ],
          on_driver_ok: () => { },
        },
        notification:
        {
          initial_port: 0xA900,
          single_handler: false,
          handlers:
            [
              (queue_id) => {
                if (queue_id !== 0) {
                  console.error("Virtio9P Notified for non-existent queue: " + queue_id +
                    " (expected queue_id of 0)");
                  return;
                }
                while (this.virtqueue.has_request()) {
                  const bufchain = this.virtqueue.pop_request();
                  this.ReceiveRequest(bufchain);
                }
                this.virtqueue.notify_me_after(0);
                // Don't flush replies here: async replies are not completed yet.
              },
            ],
        },
        isr_status:
        {
          initial_port: 0xA700,
        },
        device_specific:
        {
          initial_port: 0xA600,
          struct:
            [
              {
                bytes: 2,
                name: "mount tag length",
                read: () => this.configspace_taglen,
                write: data => { /* read only */ },
              } as VirtIO_CapabilityStruct,
            ].concat(v86util.range(VIRTIO_9P_MAX_TAGLEN).map(index =>
              ({
                bytes: 1,
                name: "mount tag name " + index,
                // Note: configspace_tagname may have changed after set_state
                read: () => this.configspace_tagname[index] || 0,
                write: data => { /* read only */ },
              }) as VirtIO_CapabilityStruct
            )),
        },
      });
    this.virtqueue = this.virtio.queues[0];
  }
  ReceiveRequest(bufchain: VirtQueueBufferChain) {
    // TODO: split into header + data blobs to avoid unnecessary copying.
    const buffer = new Uint8Array(bufchain.length_readable);
    bufchain.get_next_blob(buffer);

    const state = { offset : 0 };
    const header = Marshall.Unmarshall(["w", "b", "h"], buffer, state);
    const size = header[0] as number;
    const id = header[1] as P9Command;
    const tag = header[2] as number;
    //message.Debug("size:" + size + " id:" + id + " tag:" + tag);

    switch(id)
    {
      case P9Command.P9_TVERSION: {  //VERSION 
        this.onVersion(bufchain, id, tag, buffer, state);
        break;
      }
      case P9Command.P9_TATTACH: { // attach
        this.onAttach(bufchain, id, tag, buffer, state);
        break;
      }
      case P9Command.P9_TWALK: { // walk
        this.onWalk(bufchain, id, tag, buffer, state);
        break;
      }
      default:
        this.SendError(tag, `${this.lookupP9Command(id)} (0x${id.toString(16)}/${id}) not supported`, ErrorCodes.EOPNOTSUPP_P9);
        this.SendReply(bufchain);
    }
  }
  lookupP9Command(id: P9Command): string {
    switch(id) {
      case P9Command.P9_TLERROR: return 'P9_TLERROR';
      case P9Command.P9_RLERROR: return 'P9_RLERROR';
      case P9Command.P9_TSTATFS: return 'P9_TSTATFS';
      case P9Command.P9_RSTATFS: return 'P9_RSTATFS';
      case P9Command.P9_TLOPEN: return 'P9_TLOPEN';
      case P9Command.P9_RLOPEN: return 'P9_RLOPEN';
      case P9Command.P9_TLCREATE: return 'P9_TLCREATE';
      case P9Command.P9_RLCREATE: return 'P9_RLCREATE';
      case P9Command.P9_TSYMLINK: return 'P9_TSYMLINK';
      case P9Command.P9_RSYMLINK: return 'P9_RSYMLINK';
      case P9Command.P9_TMKNOD: return 'P9_TMKNOD';
      case P9Command.P9_RMKNOD: return 'P9_RMKNOD';
      case P9Command.P9_TRENAME: return 'P9_TRENAME';
      case P9Command.P9_RRENAME: return 'P9_RRENAME';
      case P9Command.P9_TREADLINK: return 'P9_TREADLINK';
      case P9Command.P9_RREADLINK: return 'P9_RREADLINK';
      case P9Command.P9_TGETATTR: return 'P9_TGETATTR';
      case P9Command.P9_RGETATTR: return 'P9_RGETATTR';
      case P9Command.P9_TSETATTR: return 'P9_TSETATTR';
      case P9Command.P9_RSETATTR: return 'P9_RSETATTR';
      case P9Command.P9_TXATTRWALK: return 'P9_TXATTRWALK';
      case P9Command.P9_RXATTRWALK: return 'P9_RXATTRWALK';
      case P9Command.P9_TXATTRCREATE: return 'P9_TXATTRCREATE';
      case P9Command.P9_RXATTRCREATE: return 'P9_RXATTRCREATE';
      case P9Command.P9_TREADDIR: return 'P9_TREADDIR';
      case P9Command.P9_RREADDIR: return 'P9_RREADDIR';
      case P9Command.P9_TFSYNC: return 'P9_TFSYNC';
      case P9Command.P9_RFSYNC: return 'P9_RFSYNC';
      case P9Command.P9_TLOCK: return 'P9_TLOCK';
      case P9Command.P9_RLOCK: return 'P9_RLOCK';
      case P9Command.P9_TGETLOCK: return 'P9_TGETLOCK';
      case P9Command.P9_RGETLOCK: return 'P9_RGETLOCK';
      case P9Command.P9_TLINK: return 'P9_TLINK';
      case P9Command.P9_RLINK: return 'P9_RLINK';
      case P9Command.P9_TMKDIR: return 'P9_TMKDIR';
      case P9Command.P9_RMKDIR: return 'P9_RMKDIR';
      case P9Command.P9_TRENAMEAT: return 'P9_TRENAMEAT';
      case P9Command.P9_RRENAMEAT: return 'P9_RRENAMEAT';
      case P9Command.P9_TUNLINKAT: return 'P9_TUNLINKAT';
      case P9Command.P9_RUNLINKAT: return 'P9_RUNLINKAT';
      case P9Command.P9_TVERSION: return 'P9_TVERSION';
      case P9Command.P9_RVERSION: return 'P9_RVERSION';
      case P9Command.P9_TAUTH: return 'P9_TAUTH';
      case P9Command.P9_RAUTH: return 'P9_RAUTH';
      case P9Command.P9_TATTACH: return 'P9_TATTACH';
      case P9Command.P9_RATTACH: return 'P9_RATTACH';
      case P9Command.P9_TERROR: return 'P9_TERROR';
      case P9Command.P9_RERROR: return 'P9_RERROR';
      case P9Command.P9_TFLUSH: return 'P9_TFLUSH';
      case P9Command.P9_RFLUSH: return 'P9_RFLUSH';
      case P9Command.P9_TWALK: return 'P9_TWALK';
      case P9Command.P9_RWALK: return 'P9_RWALK';
      case P9Command.P9_TOPEN: return 'P9_TOPEN';
      case P9Command.P9_ROPEN: return 'P9_ROPEN';
      case P9Command.P9_TCREATE: return 'P9_TCREATE';
      case P9Command.P9_RCREATE: return 'P9_RCREATE';
      case P9Command.P9_TREAD: return 'P9_TREAD';
      case P9Command.P9_RREAD: return 'P9_RREAD';
      case P9Command.P9_TWRITE: return 'P9_TWRITE';
      case P9Command.P9_RWRITE: return 'P9_RWRITE';
      case P9Command.P9_TCLUNK: return 'P9_TCLUNK';
      case P9Command.P9_RCLUNK: return 'P9_RCLUNK';
      case P9Command.P9_TREMOVE: return 'P9_TREMOVE';
      case P9Command.P9_RREMOVE: return 'P9_RREMOVE';
      case P9Command.P9_TSTAT: return 'P9_TSTAT';
      case P9Command.P9_RSTAT: return 'P9_RSTAT';
      case P9Command.P9_TWSTAT: return 'P9_TWSTAT';
      case P9Command.P9_RWSTAT: return 'P9_RWSTAT';
      default:
        return 'Unknown';
    }
  }

  onVersion(bufchain: VirtQueueBufferChain, id: P9Command, tag: number, buffer: Uint8Array, state: {offset: number}) {
    var version = Marshall.Unmarshall(["w", "s"], buffer, state);
    message.Debug("[version]: msize=" + version[0] + " version=" + version[1]);
    this.msize = version[0] as number;
    this.replyMarshalledData(bufchain, id, tag, ["w", "s"], [this.msize, this.VERSION]);
  }

  async onAttach(bufchain: VirtQueueBufferChain, id: P9Command, tag: number, buffer: Uint8Array, state: {offset: number}) {
    const req = Marshall.Unmarshall(["w", "w", "s", "s", "w"], buffer, state);
    const fid = req[0] as number;
    const afid = req[1] as number;  // For auth. Ignored.
    const uname = req[2] as string;  // Username. Ignored.
    const aname = req[3] as string;  // Mount point. Ignored.
    const n_uname = req[4] as number; // numeric user_name

    const root = this.wrapFileEntry(await this.fs.getRoot());
    root.type = P9QidTypes.P9_QTDIR | P9QidTypes.P9_QTMOUNT; // 0x10 | 0x80
    this.add_qid(fid, root);
    this.replyMarshalledData(bufchain, id, tag, ["Q"], this.qidFromFileEntry(root));
  }
  async onWalk(bufchain: VirtQueueBufferChain, id: number, tag: number, buffer: Uint8Array, state: {offset: number}) {
    const req = Marshall.Unmarshall(["w", "w", "h"], buffer, state);
    const fid = req[0] as number; // original FID
    const nwfid = req[1] as number; // New FID upon successful walk
    const nwname = req[2] as number; // number of dir-names to follow

    var qid = this.get_qid(fid);
    if(qid === undefined) {
      message.Debug("No such QID found for fid=" + fid);
      this.SendError(tag, "Walk: Invalid FID", ErrorCodes.ENOENT);
      return;
    }
    if (nwname === 0) {
        this.add_qid(nwfid, qid);
        this.replyMarshalledData(bufchain, id, tag, ["h"], [0]);
        return;
    }
    if(!qid.isDir) {
      message.Debug(`Walk: FID not a Directory, fid=${fid} = qid=${qid.fullPath}`);
      this.SendError(tag, "Walk: FID not a Directory", ErrorCodes.ENOTDIR);
      return;
    }
    if(qid.isOpen) {
      message.Debug(`Walk: FID currently open, fid=${fid} = qid=${qid.fullPath}`);
      this.SendError(tag, "Walk: FID currently open", ErrorCodes.EIO);
      return;
    }
    const wnames: MarshallType[] = [];
    for(var i=0; i<nwname; i++) {
        wnames.push("s");
    }
    const dirToWalk = Marshall.Unmarshall(wnames, buffer, state) as string[]; // dir names (strings)
    const resp = (await this.fs.walk(qid, dirToWalk)).map(entry => this.wrapFileEntry(entry));
    
  }

  replyMarshalledData(bufchain: VirtQueueBufferChain, id: P9Command, tag: number, types: MarshallType[], input: (number | number[] | string)[]) {
    const size = Marshall.Marshall(types, input, this.replybuffer, 7);
    this.BuildReply(id, tag, size);
    this.SendReply(bufchain);
  }

  BuildReply(id: P9Command, tag: number, payloadsize: number) {
    dbg_assert(payloadsize >= 0, "9P: Negative payload size");
    Marshall.Marshall(["w", "b", "h"], [payloadsize + 7, id + 1, tag], this.replybuffer, 0);
    if ((payloadsize + 7) >= this.replybuffer.length) {
      message.Debug("Error in 9p: payloadsize exceeds maximum length");
    }
    this.replybuffersize = payloadsize + 7;
    return;
  }
  SendReply(bufchain: VirtQueueBufferChain) {
    dbg_assert(this.replybuffersize >= 0, "9P: Negative replybuffersize");
    bufchain.set_next_blob(this.replybuffer.subarray(0, this.replybuffersize));
    this.virtqueue.push_reply(bufchain);
    this.virtqueue.flush_replies();
}
  SendError(tag: number, errormsg: string, errorcode: ErrorCodes) {
    const size = Marshall.Marshall(["s", "w"], [errormsg, errorcode], this.replybuffer, 7);
    //var size = Marshall.Marshall(["w"], [errorcode], this.replybuffer, 7);
    this.BuildReply(P9Command.P9_RERROR, tag, size);
  }

  qidFromFileEntry(entry: P9FileSystemEntry): number[] {
    return [entry.type, entry.mtime, entry.ctime, entry.crc32];
  }

  hashCode32(str: string) {
    var hash = 0;
    if (str.length === 0)
        return hash;
    for (var i=0; i < str.length; i++) {
        hash = 31 * hash + str.charCodeAt(i);
        hash = hash & hash;
        if (hash < 0)
            hash += 0x100000000;
    }
    return hash;
  }

  wrapFileEntry(entry: FileSystemEntry): P9FileSystemEntry {
    const ret: P9FileSystemEntry = {} as any as P9FileSystemEntry;
    Object.assign(ret, entry);
    ret.type = entry.isDir? P9QidTypes.P9_QTFILE : P9QidTypes.P9_QTDIR;
    ret.isOpen = false;
    ret.crc32 = this.hashCode32(entry.fullPath);
    return ret;
  }

  add_qid(fid: number, entry: P9FileSystemEntry) {
      //display.log("Adding fid=" + fid + ", name=" + qid.name + ", fullPath=" + qid.entry.fullPath);
      this.fid2qid[fid] = entry;
      this.path2qid[entry.fullPath] = entry;
  }
  del_qid(fid: number) {
    var qid = this.fid2qid[fid];
    delete this.fid2qid[fid];
    delete this.path2qid[qid.fullPath];
  }
  get_qid(fid_or_path: number|string): P9FileSystemEntry|undefined {
      if (typeof fid_or_path == "number")
          return this.fid2qid[fid_or_path];
      else if (typeof fid_or_path == "string")
          return this.path2qid[fid_or_path];
      else
          message.Debug("get_qid: unknown key type: " + (typeof fid_or_path));
      return undefined;
  }
}