#include "rv-test-headers.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#ifndef RV_LOCAL_TEST
extern int f(int a, int b, int c);
#endif

#include "rv-stack-array-ref.c"

int main() {
  expectedInt(fRef(-1, 2, 10));
  expectedInt(fRef(1, 4, 20));
  expectedInt(fRef(8, 4, 20));
#ifndef RV_LOCAL_TEST
  assertEqual(f(-1, 2, 10), fRef(-1, 2, 10));
  assertEqual(f(1, 4, 20), fRef(1, 4, 20));
  assertEqual(f(8, 4, 20), fRef(8, 4, 20));
#endif
}
