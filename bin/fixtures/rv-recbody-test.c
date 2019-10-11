#include <stdint.h>
#include <stdio.h>
#include <string.h>

extern int G(char *p, int n);

int main() {
  char test1[] = "prova";
  uint64_t res = G(test1, 0);
  if (res == strlen(test1))
    printf("\033[0;32m [ok] \033[0m - returned %lld\n", res);
  else
    printf("\033[0;31m [ko] \033[0m - returned %lld\n", res);
}
