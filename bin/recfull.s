
# Stack frame information for function 'g':
# - register $a0 contains p (4)
# - register $a1 contains n (4)
# - saved reg $ra at stack offset: 0

# function prologue
      .text
      .globl G
G:
      addiu $sp, $sp, -4
      sw    $ra, 0($sp)

# function body
      lw    $t0, ($a0)
      beq   $0, $t0, END
THEN:
      addiu $a0, $a0, 1
      addiu $a1, $a1, 1
      jal   G
      j     GEPI
ELSE:
      move  $v0, $a1
      j     GEPI


# function epilogue
GEPI:
      lw    $ra, 0($sp)
      addiu $sp, $sp, 4
      jr    $ra
