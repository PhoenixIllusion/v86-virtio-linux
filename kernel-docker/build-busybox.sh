rm -fr filesystem
cd busybox && make ARCH=x86 -j12 && make install