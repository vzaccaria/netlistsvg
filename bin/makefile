# all: test.json
# 	cat $<

# test.json: ./vz-quine.js
# 	./vz-quine.js quinett "001000000x000111" | jq . > $@

# test-%.tex: test.json
# 	cat $< | jq .latex.implicantsCharts[$*] -r > $@

# test-%.pdf: test-%.tex
# 	tikz2pdf compile $< -p



test: 
	../node_modules/.bin/mocha -b -t 5000 ./test.js
