Browser Linux Tests and Extensions

Goal
- VSCode Web Extension terminal, running VM of linux and supporting extra extensions
- Implement v9pfs against VSCode Extension async filesystem interface
- Support generic filesystem interface
  - Optionally support currently unavailable HTML5/VSCode-FS features, if available
    - symbolic links
    - attributes
- Implement virtio-scsi against collections of squashFS blocks (Blobs) in an overlay filesystem to load support modules
  - possibly extract DEB files to allow bundling squashes of APT packages?
  - possibly at least allow specifying APK collections and recompiling to squashFS images?
- Change to virtio-console for resizing ability (vs busybox resize or setting of ENV properties)
- Look into VirtioFS with DAX for reading host files vs v9pFS

- Look into how host can execute WASM/JS processes so that extensions can execute
  - Host - WASM
  - Host - JS
  - Guest - JS
  - Guest - QuickJS x86
  - Guest - x86 custom
  - Guest - linux-x86 existing packages

- Look into QuickJS or other methods for tools
  - requiring sync file access
  - to support currently inaccessible CLI's
  - doing livereload - route server behavior like NoHost

v86
- Implement minimal patch system to allow pulling upstream builds that support MJS module exports of required inner classes
- Continue implementing libv86.d.mts as needed for virtio & any future hardware

Site
- Used to test the Virtio components in a shell

Site Goal
- Implement virtio interfaces in separate individually packages with minimal to no interdependencies

Kernel Docker
- Based on Floppinux https://github.com/w84death/floppinux
- Builds a minimal kernel with embedded busybox
- Currently using kernel tinyconfig with p9fs, squashfs, and virtio interfaces

Kernel Goals:
- Minimal Kernel, < 2MB bzImage embedded rootfs.cpio.xz 
- No module loading
- Support primarily Virtio interfaces

