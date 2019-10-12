
int gRef(char *p, int n) {
  if (!*p)
    return n;
  else
    return gRef(p + 1, n + 1);
}
