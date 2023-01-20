docker build -t phoenixillusion/v86-linux .
mkdir -p build
docker run \
  --rm \
  --platform linux/386 \
  --name build-v86-image \
  --mount type=bind,source="$(pwd)/build",target=/output \
  phoenixillusion/v86-linux cp bzImage output/.