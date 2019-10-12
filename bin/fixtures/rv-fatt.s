        mv s0, a0
        li t0, 1 
        blt s0, t0, exit1
        addi t0, s0, -1
        mv a0, t0
        j fatt
        mul a0, a0, s0
        j fattEPI

exit1: 
        li a0, 1
        j fattEPI
