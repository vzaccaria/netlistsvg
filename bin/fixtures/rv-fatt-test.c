#include "rv-test-headers.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#ifndef RV_LOCAL_TEST
extern uint64_t fatt(uint64_t n);
#endif

#include "rv-fatt-ref.c"

int main() {
#ifndef RV_LOCAL_TEST
  assertEqualLL(fattRef(3), fatt(3));
  assertEqualLL(fattRef(6), fatt(6));
#endif
}
