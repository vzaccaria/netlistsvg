        li t0, 0
        beq a1, t0, ramoThen
ramoElse: 
        mv s0, a1
        call __umoddi3
        mv a1, a0
        mv a0, s0
        call f
        j fEPI

ramoThen:
        j fEPI


