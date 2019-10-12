
int fRef(int a, int b, int c) {
  int array[4];
  int i;
  for (i = 0; i < 4; i++)
    array[i] = a + i * b;
  if (c < 4)
    return array[c];
  else
    return array[3] + fRef(1, 2, 3);
}
