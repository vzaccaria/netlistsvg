module alu(output o, input a, b, input [2:0] s);
  assign o = s ? a : ~a & b;
endmodule
