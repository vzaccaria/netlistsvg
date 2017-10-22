

edit:
	watchman counter.v 'make counter.pdf'

counter.pdf: counter.v
	../bin/netlistsvg.js $< --verilog | ps2pdf - > $@

clean:
	rm -f *.json *.pdf *.ps *.svg
