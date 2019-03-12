module test(output o, input a, b,c);
  assign o = ~a & ( c | b );
endmodule
