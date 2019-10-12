
int fattRef(int n) {
  if (n < 1)
    return 1;
  else
    return (n * fattRef(n - 1));
}
