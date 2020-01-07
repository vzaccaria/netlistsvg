#include <stdint.h>
#include <stdio.h>

typedef struct {
  char nome[16];
  uint64_t voti[4];
} studente;

void fRef(studente s) {
  printf("Nome: %s\nVoti: ", s.nome);
  for (int i = 0; i < 4; i++) {
    printf("%lld", s.voti[i]);
  }
}
