cd filesystem
mkdir dev
mkdir proc
mkdir -p etc/init.d
mkdir sys
mkdir tmp
mknod dev/console c 5 1
mknod dev/null c 1 3

cat >> etc/init.d/rc << EOF
#!/bin/sh
mount -t proc none /proc
mount -t sysfs none /sys
clear
cat welcome
/bin/sh
EOF
chmod +x etc/init.d/rc
ln -s etc/init.d/rc init

cat >> etc/inittab << EOF
::sysinit:/etc/init.d/rc
::askfirst:/bin/sh
::restart:/sbin/init
::ctrlaltdel:/sbin/reboot
::shutdown:/bin/umount -a -r
EOF

cat >> welcome << EOF
Some welcome text...
EOF

chown -R root:root .
find . | cpio -H newc -o | xz --check=crc32 > ../rootfs.cpio.xz