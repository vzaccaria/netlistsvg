
#define assertEqual(a, b)                                                      \
  if ((a) == (b)) {                                                            \
    printf("\033[0;32m [ok] \033[0m\n");                                       \
  } else {                                                                     \
    printf("\033[0;31m [ko] \033[0m\n");                                         \
  }

#define expectedInt(a) printf("Expecting integer: \033[0;34m %d \033[0m\n", a);

