"""Dump every <a:t> text run of selected slides (exact strings, repr-quoted)."""
import re
import sys

BASE = r"C:\Users\HANMANTH\projectsforge\pitch\unpacked\ppt\slides"

slides = [int(a) for a in sys.argv[1:]] or [7, 8, 9, 12, 13]

for n in slides:
    xml = open(f"{BASE}\\slide{n}.xml", encoding="utf-8").read()
    runs = re.findall(r"<a:t>(.*?)</a:t>", xml, re.S)
    print(f"--- slide{n} ({len(runs)} runs) ---")
    for i, r in enumerate(runs):
        print(f"  [{i}] {r!r}")
