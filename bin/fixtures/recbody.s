      lb    $t0, ($a0)
      beq   $0, $t0, ELSE
THEN:
      addiu $a0, $a0, 1
      addiu $a1, $a1, 1
      jal   G
      j     GEPI
ELSE:
      move  $v0, $a1
      j     GEPI
