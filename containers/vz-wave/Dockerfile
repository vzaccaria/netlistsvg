FROM ubuntu:jammy

RUN apt-get update && apt-get install -y locales

RUN locale-gen en_US.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

RUN apt install -y python3
RUN apt install -y python3-pip
RUN echo "reinstall"
COPY * /root
WORKDIR /root

CMD ["/root/bibjson.py"]

