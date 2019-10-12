        mv s0, a0           # savedN = n
        li t0, 1            
        blt s0, t0, exit1   # savedN < 1 goto exit1
        addi t0, s0, -1     # tmp = savedN - 1
        mv a0, t0            
        call fatt           # fatt(tmp)
        mul a0, a0, s0      # a0 = savedN * fatt(tmp)
        j fattEPI

exit1: 
        li a0, 1
        j fattEPI
