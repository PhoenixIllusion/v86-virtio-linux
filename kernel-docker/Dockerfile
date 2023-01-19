FROM i386/alpine:3.17.1 as builder
RUN apk update && apk add alpine-sdk xz ncurses-dev bison flex bc linux-headers

FROM builder as busybox-clone
RUN git clone --depth=1 --branch 1_36_0 --single-branch https://github.com/mirror/busybox.git busybox

FROM busybox-clone as busybox-builder
COPY busybox.config busybox/.config
COPY build-busybox.sh build-busybox.sh
RUN sh ./build-busybox.sh
COPY gen-filesystem.sh gen-filesystem.sh
RUN sh ./gen-filesystem.sh

FROM builder as kernel-clone
RUN git clone --depth=1 --branch v6.2-rc4 --single-branch  https://github.com/torvalds/linux.git linux

FROM kernel-clone as kernel-builder
COPY --from=busybox-builder rootfs.cpio.xz rootfs.cpio.xz
COPY linux.config linux/.config
COPY build-linux.sh build-linux.sh
RUN sh ./build-linux.sh
