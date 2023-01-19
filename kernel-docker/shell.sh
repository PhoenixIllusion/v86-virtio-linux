docker run \
  --rm -it \
  --platform linux/386 \
  --name build-v86-image \
  --mount type=bind,source="$(pwd)/build",target=/output \
  redshade/v86-linux /bin/sh