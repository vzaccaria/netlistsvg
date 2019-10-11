      lb    t0, (a0) 
      beqz   t0, ELSE
THEN:
      addi a0, a0, 1
      addi a1, a1, 1
      jal   G
      j     GEPI
ELSE:
      mv  a0, a1
      j   GEPI
