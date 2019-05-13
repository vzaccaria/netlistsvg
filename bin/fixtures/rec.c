
int g(char *p, int n) {
  if (!*p)
    return n;
  else
    return g(p + 1, n + 1);
}
