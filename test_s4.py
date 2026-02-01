import S4
print("S4 module attributes:")
for attr in dir(S4):
    print(f"  {attr}")
print()
print("Testing S4.New:")
try:
    sim = S4.New(Lattice=((1, 0), (0, 1)), NumBasis=10)
    print(f"S4.New works! Type: {type(sim)}")
except Exception as e:
    print(f"S4.New failed: {e}")
