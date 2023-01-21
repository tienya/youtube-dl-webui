FROM hillwong/node16:latest

WORKDIR /root/

COPY . .

EXPOSE 8100

ENV NODE_ENV='production'

CMD ["npm", "run", "start"]