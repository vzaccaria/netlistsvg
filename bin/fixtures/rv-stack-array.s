
        li t0, 0
        sd t0, 0(sp)
for:    li t1, 4 
        bge t0, t1, exitFor
        slli t2, t0, 3
        addi t2, t2, 8    
        ld t0, 0(sp)     
        mul t1, t0, a1    # i * b 
        add t1, t1, a0    # a + i * b
        add t2, t2, sp    # &array[c]
        sd t1, 0(t2)
        addi t0, t0, 1    # i++
        sd t0, 0(sp)
        j for

exitFor: 
        li t1, 4
        bge a2, t1, recCall
        slli a2, a2, 3
        addi a2, a2, 8     
        add a2, a2, sp
        ld a0, 0(a2)
        j fEPI

recCall: 
        li a2, 3
        li a1, 2
        li a0, 1
        call f
        ld t0, 32(sp)
        add a0, a0, t0
        j fEPI


