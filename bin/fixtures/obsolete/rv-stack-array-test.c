#include "rv-test-headers.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#ifndef RV_LOCAL_TEST
extern int64_t f(int64_t a, int64_t b, int64_t c);
#endif

#include "rv-stack-array-ref.c"

int main() {
#ifndef RV_LOCAL_TEST
  assertEqualLL(f(8, 2, 1), fRef(8, 2, 1));
  assertEqualLL(f(-1, 2, 3), fRef(-1, 2, 3));
  assertEqualLL(f(-1, 2, 10), fRef(-1, 2, 10));
  assertEqualLL(f(1, 4, 20), fRef(1, 4, 20));
  assertEqualLL(f(8, 4, 20), fRef(8, 4, 20));
#endif
}
