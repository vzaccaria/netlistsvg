#include <stdint.h>

int64_t fRef(int64_t a, int64_t b, int64_t c) {
  int64_t array[4];
  int64_t i;
  for (i = 0; i < 4; i++)
    array[i] = a + i * b;
  if (c < 4)
    return array[c];
  else
    return array[3] + fRef(1, 2, 3);
}
