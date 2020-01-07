
#define assertEqual(a, b)                                                      \
  if ((a) == (b)) {                                                            \
    printf("\033[0;32m [ok] \033[0m\n");                                       \
  } else {                                                                     \
    printf("\033[0;31m [ko] \033[0m\n");                                         \
  }


#define assertEqualCC(a, b)                                                      \
  if ((a) == (b)) {                                                            \
    printf("\033[0;32m [ok] \033[0m %c = %c\n", a, b);                                       \
  } else {                                                                     \
    printf("\033[0;31m [ko] \033[0m %c != %c \n", a, b);                                         \
  }

#define assertEqualLL(a, b)                                                      \
  if ((a) == (b)) {                                                            \
    printf("\033[0;32m [ok] \033[0m %lld = %lld\n", a, b);                                       \
  } else {                                                                     \
    printf("\033[0;31m [ko] \033[0m %lld != %lld \n", a, b);                                         \
  }

#define expectedInt(a) printf("Expecting integer: \033[0;34m %d \033[0m\n", a);
#define expectedLLInt(a) printf("Expecting LL integer: \033[0;34m %lld \033[0m\n", a);

