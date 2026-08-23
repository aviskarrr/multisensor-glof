"""
Check for lake ID overlaps across all S2 batch CSVs — fully automatic,
no GEE calls, no manual row-by-row checking. Run this before deciding
whether batches 1-4 need re-export.
"""

import glob
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[1]  # GLOF/
BATCH_DIR = PROJECT_ROOT / "data" / "processed" / "sentinel2"

batch_files = sorted(glob.glob(str(BATCH_DIR / "s2_batch_*.csv")))
print(f"Found {len(batch_files)} batch files.\n")

# load just the Id column from each — fast, small memory footprint
id_sets = {}
for f in batch_files:
    df = pd.read_csv(f, usecols=["Id"])
    name = Path(f).stem
    id_sets[name] = set(df["Id"].unique())
    print(f"{name}: {len(id_sets[name])} unique lakes")

print("\n--- Pairwise overlap check ---")

names = list(id_sets.keys())
any_overlap = False

for i in range(len(names)):
    for j in range(i + 1, len(names)):
        a, b = names[i], names[j]
        overlap = id_sets[a] & id_sets[b]
        if overlap:
            any_overlap = True
            print(f"⚠️  {a} <-> {b}: {len(overlap)} overlapping IDs: {sorted(overlap)}")

if not any_overlap:
    print("✅ No overlaps between any batch pair.")

# ------------------------------------------------------------
# Coverage check — union of all batches vs expected total
# ------------------------------------------------------------

all_ids = set()
for s in id_sets.values():
    all_ids |= s

print(f"\nTotal unique lakes across all batches: {len(all_ids)}")
print("(Compare this to your expected total, e.g. 494)")