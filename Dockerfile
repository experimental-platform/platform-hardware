FROM experimentalplatform/ubuntu:latest

RUN curl -sL https://deb.nodesource.com/setup | sudo bash - && \
    apt-get update && \
    apt-get install -y build-essential curl nodejs npm python2.7 libudev-dev iproute2 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# because ubuntu
RUN ln -s /usr/bin/nodejs /usr/bin/node

ENV PYTHON "/usr/bin/python2.7"
COPY package.json /package.json
RUN npm install
# ENV NODE_ENV production
COPY app /app
RUN mkdir /socketdir
CMD ["dumb-init", "node", "/app/index.js"]
