

edit:
	watchman counter.v 'make counter.pdf'

counter.pdf: counter.v
	../bin/vz-netlist.js netlist $< --verilog | ps2pdf - > $@

clean:
	rm -f *.json *.pdf *.ps *.svg
