module alu(output o, input a, b,input [1:0]  s);
  assign o = s[0] ? (s[1] ? a & b : a | b) : a;
endmodule
