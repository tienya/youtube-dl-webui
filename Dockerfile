FROM node:16-alpine3.17

RUN apk add curl python3 && \
  npm install pm2 -g && pm2 install pm2-logrotate

WORKDIR /root/

COPY . .

EXPOSE 8100

ENV NODE_ENV='production'

CMD ["npm", "run", "start"]