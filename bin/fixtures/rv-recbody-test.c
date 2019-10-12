#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define assertEqual(a, b)                                                      \
  if ((a) == (b)) {                                                            \
    printf("\033[0;32m [ok] \033[0m\n");                                       \
  } else {                                                                     \
    printf("\033[0;31m [ko] \033[0m");                                         \
  }

extern int g(char *p, int n);

#include "rv-recbody-ref.c"

int main() {
  char test1[] = "prova";
  assertEqual(g(test1, 0), gRef(test1, 0));
}
