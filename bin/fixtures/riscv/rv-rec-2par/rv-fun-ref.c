#include <stdint.h>

/* Per convertire (x % y) si usi: __umoddi3(x,y); */

uint64_t fRef(uint64_t x, uint64_t y) {
  if (y == 0)
    return x;
  else {
    return fRef(y, x % y);
  }
}
