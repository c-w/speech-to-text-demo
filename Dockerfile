FROM node:10

RUN curl -fsSLo terraform.zip https://releases.hashicorp.com/terraform/0.12.16/terraform_0.12.16_linux_amd64.zip \
 && unzip terraform.zip \
 && mv terraform /usr/local/bin \
 && chmod +x /usr/local/bin/terraform \
 && rm terraform.zip

RUN apt-get update \
 && apt-get install -y ffmpeg sox \
 && curl -sL https://aka.ms/InstallAzureCLIDeb | bash

WORKDIR /app
COPY package*.json ./
RUN npm install

WORKDIR /app/functions
COPY functions/package*.json ./
RUN npm install

WORKDIR /app/infrastructure
COPY infrastructure/providers.tf ./
RUN terraform init

COPY infrastructure/* ./
RUN terraform fmt -check
RUN terraform validate

WORKDIR /app
COPY . ./
RUN npm run lint
RUN npm run typecheck

CMD ["bash"]
