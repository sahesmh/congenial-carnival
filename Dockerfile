FROM node:18.7
#ENV NODE_ENV=production

WORKDIR /congenial-carnival

COPY ["package.json", "yarn.lock", "./"]
RUN corepack enable
RUN yarn install
COPY . .

CMD [ "yarn", "start" ]
