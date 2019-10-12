#include "rv-test-headers.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#ifndef RV_LOCAL_TEST
extern int fatt(int n);
#endif

#include "rv-fatt-ref.c"

int main() {
  expectedInt(fattRef(4));
#ifndef RV_LOCAL_TEST
  assertEqual(fattRef(4), fatt(4));
#endif
}
