#include "rv-test-headers.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "rv-fun-ref.c"

#ifndef RV_LOCAL_TEST
extern uint64_t f(uint64_t, uint64_t);
#endif

int main() {
#ifndef RV_LOCAL_TEST
  assertEqualLL(fRef(1, 3), f(1, 3));
  assertEqualLL(fRef(3, 12), f(3, 12));
  assertEqualLL(fRef(20, 5), f(20, 5));
  assertEqualLL(fRef(660, 222), f(660, 222));
#endif
}
