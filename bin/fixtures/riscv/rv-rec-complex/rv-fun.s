        .equiv I, 8
        .equiv STUDENTE_VOTI_OFF, 16
        .equiv STUDENTE_NOME_OFF, 0

        mv s0, a0
        mv a1, a0
        la a0, LC0
        call printf
        sd zero, I(sp)
for:    ld t0, I(sp)
        li t2, 4
        bge t0, t2, endFor
        slli t0, t0, 3
        add t0, t0, STUDENTE_VOTI_OFF
        add t0, s0, t0    
        ld a1, 0(t0)         # a1 = s.voti[i]
        la a0, LC1
        call printf

        ld t0, I(sp)         # incrementa i
        add t0,t0,1
        sd t0, I(sp)
        j for
endFor:

