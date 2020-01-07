#include "rv-test-headers.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "rv-fun-ref.c"

studente s = {"Vittorio", {18, 21, 23, 19}};

#ifndef RV_LOCAL_TEST
extern void f(studente);
#endif

int main() {
#ifndef RV_LOCAL_TEST
  f(s);
#endif
}
