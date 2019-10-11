
# Stack frame information for function 'g':
# - register $a0 contains p (8)
# - register $a1 contains n (8)
# - saved reg ra at stack offset: 0


# function prologue
      .text
      .globl G
G:
      addi sp, sp, -8
      sd   ra, 0(sp)

# function body
      lb   t0, (a0)
      beqz t0, ELSE
THEN:
      addi a0, a0, 1
      addi a1, a1, 1
      jal  G
      j    GEPI
ELSE:
      mv   a0, a1
      j    GEPI


# function epilogue
GEPI:
      ld   ra, 0(sp)
      addi sp, sp, 8
      ret