# youtube-dl-webui

## Start from docker image

```
docker run -d -p 8100:8100 \
  -v "$PWD/downloads":/root/downloads \
  -e AUTH_USER='demo' \
  -e AUTH_PASS='demo@321' \
  --name youtube-dl-webui hillwong/youtube-dl-webui:latest
```

## Visit to webui

`http://$IP:8100/`

## Screenshot

webui

![preview](./images/preview.png)

play online

![online](./images/play.png)

