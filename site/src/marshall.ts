// -------------------------------------------------
// ------------------ Marshall ---------------------
// -------------------------------------------------
// helper functions for virtio and 9p.
// Modified from https://github.com/copy/v86/tree/master/lib
// qid supports 8bytes path, and must change after removal and recreation, so updated to [ctime]][crc32]

"use strict";

export type MarshallType = 'w' | 'd' | 'h' | 'b' | 's' | 'Q';

function UnicodeToUTF8Stream(key: number): number[]|undefined {
  if (key < 0x80) return [key];
  if (key < 0x800) return [0xC0 | ((key >> 6) & 0x1F), 0x80 | (key & 0x3F)];
  return undefined;
}
class UTF8StreamToUnicode {
  stream: Uint8Array;
  ofs: number;
  constructor() {
    this.stream = new Uint8Array(5);
    this.ofs = 0;
  }

  Put(key: number) {
    this.stream[this.ofs] = key;
    this.ofs++;
    switch (this.ofs) {
      case 1:
        if (this.stream[0] < 128) {
          this.ofs = 0;
          return this.stream[0];
        }
        break;

      case 2:
        if ((this.stream[0] & 0xE0) == 0xC0)
          if ((this.stream[1] & 0xC0) == 0x80) {
            this.ofs = 0;
            return ((this.stream[0] & 0x1F) << 6) | (this.stream[1] & 0x3F);
          }
        break;

      case 3:
        break;

      case 4:
        break;

      default:
        return -1;
      //this.ofs = 0;
      //break;
    }
    return -1;
  };
}

export class Marshall {

  // Inserts data from an array to a byte aligned struct in memory
  static Marshall(typeList: MarshallType[], input: (number | number[] | string)[], struct: Uint8Array, offset: number): number {
    var size = 0;
    for (var i = 0; i < typeList.length; i++) {
      const item = input[i] as number;
      const vItem = input[i] as number[];
      const sItem = input[i] as string;
      switch (typeList[i]) {
        case "w":
          struct[offset++] = item & 0xFF;
          struct[offset++] = (item >> 8) & 0xFF;
          struct[offset++] = (item >> 16) & 0xFF;
          struct[offset++] = (item >> 24) & 0xFF;
          size += 4;
          break;
        case "d": // double word
          this.Marshall(["w", "w"], vItem, struct, offset);
          offset += 8;
          size += 8;
          break;
        case "h":
          struct[offset++] = item & 0xFF;
          struct[offset++] = item >> 8;
          size += 2;
          break;
        case "b":
          struct[offset++] = item;
          size += 1;
          break;
        case "s":
          var lengthOffset = offset;
          var length = 0;
          struct[offset++] = 0; // set the length later
          struct[offset++] = 0;
          size += 2;
          for (var j of sItem) {
            var utf8 = UnicodeToUTF8Stream(j.charCodeAt(0));
            utf8 && utf8.forEach(function (c) {
              struct[offset++] = c;
              size += 1;
              length++;
            });
          }
          struct[lengthOffset + 0] = length & 0xFF;
          struct[lengthOffset + 1] = (length >> 8) & 0xFF;
          break;
        case "Q":
          this.Marshall(["b", "w", "w", "w"], vItem, struct, offset);
          offset += 13;
          size += 13;
          break;
        default:
          console.error("Marshall: Unknown type=" + typeList[i]);
          break;
      }
    }
    return size;
  }


  // Extracts data from a byte aligned struct in memory to an array
  static Unmarshall(typeList: MarshallType[], struct: Uint8Array, state: { offset: number }) {
    let offset = state.offset;
    var output: (number | number[] | string)[] = [];
    for (var i = 0; i < typeList.length; i++) {
      switch (typeList[i]) {
        case "w":
          var val = struct[offset++];
          val += struct[offset++] << 8;
          val += struct[offset++] << 16;
          val += (struct[offset++] << 24) >>> 0;
          output.push(val);
          break;
        case "d":
          var val = struct[offset++];
          val += struct[offset++] << 8;
          val += struct[offset++] << 16;
          val += (struct[offset++] << 24) >>> 0;
          output.push(val);

          val = struct[offset++];
          val += struct[offset++] << 8;
          val += struct[offset++] << 16;
          val += (struct[offset++] << 24) >>> 0;
          output.push(val);
          break;
        case "h":
          var val = struct[offset++];
          output.push(val + (struct[offset++] << 8));
          break;
        case "b":
          output.push(struct[offset++]);
          break;
        case "s":
          var len = struct[offset++];
          len += struct[offset++] << 8;
          var str = '';
          var utf8converter = new UTF8StreamToUnicode();
          for (var j = 0; j < len; j++) {
            var c = utf8converter.Put(struct[offset++]);
            if (c == -1) continue;
            str += String.fromCharCode(c);
          }
          output.push(str);
          break;
        case "Q":
          state.offset = offset;
          const qid = this.Unmarshall(["b", "w", "w", "w"], struct, state) as number[];
          offset = state.offset;
          output.push(qid);
          break;
        default:
          console.error("Error in Unmarshall: Unknown type=" + typeList[i]);
          break;
      }
    }
    state.offset = offset;
    return output;
  }
}