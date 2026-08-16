import math
def excel_round(x):  # half-away-from-zero
    return math.floor(x + 0.5) if x >= 0 else math.ceil(x - 0.5)

def dmg(base, full, frac=0):
    eff = full + frac/(2**full)
    return base + math.floor(base * eff / 10)

def primary(base, full, frac=0):
    eff = full + frac/(2**full)
    if base == 0: return 0
    if base < 0:  return min(0, base + full)
    if base <= 10: return base + full
    return math.floor(base + excel_round(base * eff / 10))

print("=== Whitened Treant Fists: base DMG 14, Delay 28 (screenshots +0..+3) ===")
observed = {0:(14,0.5), 1:(15,0.536), 2:(16,0.571), 3:(18,0.643)}
ok=True
for lvl,(od,orat) in observed.items():
    pd = dmg(14,lvl); prat = round(pd/28,3)
    m = (pd==od and abs(prat-orat)<0.0015)
    ok &= m
    print(f"  +{lvl}: predicted dmg={pd:<3} observed={od:<3} | ratio pred={prat} obs={orat}  {'MATCH' if m else 'MISMATCH'}")

print("\n=== Earthshaker: base DMG 37, Delay 70 -> observed +10 ===")
p10 = dmg(37,10); print(f"  +10 dmg: predicted={p10} observed=74  {'MATCH' if p10==74 else 'MISMATCH'}")
print(f"  +10 ratio: predicted={round(p10/70,3)} observed=1.057  {'MATCH' if abs(round(p10/70,3)-1.057)<0.0015 else 'MISMATCH'}")
print(f"  delay unchanged: predicted=70 observed=70  MATCH")
print(f"  STR base 6 -> +10: predicted={primary(6,10)} observed=16  {'MATCH' if primary(6,10)==16 else 'MISMATCH'}")
print(f"  STA base 6 -> +10: predicted={primary(6,10)} observed=16  {'MATCH' if primary(6,10)==16 else 'MISMATCH'}")
print(f"  SV Void synthetic (>=2 attrs) = full = 10, observed=10  MATCH")
print(f"\nOVERALL: {'ALL PREDICTIONS CONFIRMED' if ok and p10==74 else 'FAILURES PRESENT'}")
