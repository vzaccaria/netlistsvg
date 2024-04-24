DOCK=docker run -ti -v `pwd`:/local --rm -w /local wavedrom

build: makefile Dockerfile
	docker build . -t wavedrom

c:
	$(DOCK) /bin/bash


