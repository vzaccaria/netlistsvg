
OUTPUTS=

artifacts: 
	mkdir -p artifacts
	cat fsm-expected-output-moore.json | ../vz-compile-artifacts.js -p artifacts/moore
	cat fsm-expected-output-mealy.json | ../vz-compile-artifacts.js -p artifacts/mealy
	cat quine-expected-output-with-dont-cares.json | ../vz-compile-artifacts.js -p artifacts/quine-4-dc

clean: 
	rm -rf tmp-* artifacts
