#include <stdint.h>

uint64_t fattRef(uint64_t n) {
  if (n < 1)
    return 1;
  else
    return (n * fattRef(n - 1));
}
