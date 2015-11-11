FROM experimentalplatform/ubuntu:latest

RUN curl -sL https://deb.nodesource.com/setup | sudo bash - && \
    apt-get update && \
    apt-get install -y build-essential curl nodejs python2.7 libudev-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 3000
ENV PYTHON "/usr/bin/python2.7"
COPY package.json /package.json
RUN npm install
# ENV NODE_ENV production
COPY app /app
CMD node /app/index.js
