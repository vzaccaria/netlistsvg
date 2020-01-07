#include "rv-test-headers.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>

extern int g(char *p, int n);

#include "rv-recbody-ref.c"

int main() {
  char test1[] = "prova";
  assertEqual(g(test1, 0), gRef(test1, 0));
}
