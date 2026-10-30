test: 
	../node_modules/.bin/mocha -b -t 5000 ./test.js

testartifacts:
	./testartifacts.js

test-domains:
	../node_modules/.bin/mocha lib/vz-cache/sim.test.js lib/vz-cache/exercises.test.js lib/vz-mmu/sim.test.js lib/vz-mmu/exercises.test.js lib/vz-pipe/lib.test.js lib/vz-pipe/model.test.js lib/vz-pipe/exercises.test.js lib/vz-sched/lib.test.js lib/vz-sched/model.test.js lib/vz-sched/exercises.test.js lib/vz-memory/model.test.js lib/vz-memory/exercises.test.js lib/vz-logic/model.test.js lib/vz-logic/exercises.test.js lib/vz-seq/model.test.js lib/vz-seq/exercises.test.js

clean:
	rm -rf tmp*

.PHONY: test testartifacts test-domains clean
