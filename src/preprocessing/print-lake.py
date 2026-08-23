"""
Find missing lake IDs.

Compares the 494-lake final inventory against all downloaded
Sentinel-2 batch CSVs.

Purely local — ZERO GEE/EECU cost.
"""

import glob
from pathlib import Path
import pandas as pd


# ------------------------------------------------------------
# Paths
# ------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[1]

S2_DIR = PROJECT_ROOT / "data" / "processed" / "sentinel2"

INVENTORY_FILE = (
    PROJECT_ROOT
    / "data"
    / "inventory"
    / "final_glaciers_master.csv"
)


# ------------------------------------------------------------
# 1. Load 494-lake ground-truth inventory
# ------------------------------------------------------------

print("Loading inventory:")
print(INVENTORY_FILE)

inventory = pd.read_csv(INVENTORY_FILE)

id_col_candidates = ["Id", "ID", "id"]

id_col = next(
    (c for c in id_col_candidates if c in inventory.columns),
    None
)

if id_col is None:
    raise ValueError(
        f"No Id column found.\n"
        f"Available columns: {list(inventory.columns)}"
    )

expected_ids = set(
    pd.to_numeric(inventory[id_col], errors="raise")
    .astype(int)
    .unique()
)

print(f"\nInventory rows: {len(inventory)}")
print(f"Unique lake IDs: {len(expected_ids)}")

if len(expected_ids) != 494:
    raise ValueError(
        f"Expected exactly 494 unique lake IDs, "
        f"but found {len(expected_ids)}."
    )


# ------------------------------------------------------------
# 2. Load all Sentinel-2 batch CSVs
# ------------------------------------------------------------

batch_files = sorted(
    glob.glob(str(S2_DIR / "s2_batch_*.csv"))
)

if not batch_files:
    raise FileNotFoundError(
        f"No batch CSVs found in:\n{S2_DIR}"
    )

print(f"\nFound {len(batch_files)} batch files.")

present_ids = set()

for f in batch_files:

    df = pd.read_csv(f, usecols=["Id"])

    ids = set(
        pd.to_numeric(df["Id"], errors="raise")
        .astype(int)
        .unique()
    )

    present_ids |= ids

    print(
        f"{Path(f).stem}: "
        f"{len(ids)} unique lakes"
    )


# ------------------------------------------------------------
# 3. Calculate missing IDs
# ------------------------------------------------------------

missing_ids = sorted(expected_ids - present_ids)

extra_ids = sorted(present_ids - expected_ids)

print("\n----------------------------------------")
print("GAP ANALYSIS")
print("----------------------------------------")

print(f"Expected lakes:       {len(expected_ids)}")
print(f"Present in batches:   {len(present_ids)}")
print(f"Missing lakes:        {len(missing_ids)}")


# ------------------------------------------------------------
# 4. Print missing IDs
# ------------------------------------------------------------

print("\nMissing lake IDs:")

if missing_ids:
    print(missing_ids)
else:
    print("NONE — all 494 lakes are present.")


# ------------------------------------------------------------
# 5. Check unexpected IDs
# ------------------------------------------------------------

if extra_ids:

    print(
        "\nWARNING: IDs present in batches "
        "but NOT in final inventory:"
    )

    print(extra_ids)


# ------------------------------------------------------------
# 6. Ready-to-paste GEE JavaScript array
# ------------------------------------------------------------

js_array = "[" + ", ".join(
    str(i) for i in missing_ids
) + "]"

print(
    "\n--- Paste into GEE gap-fill script ---"
)

print("var MISSING_IDS = " + js_array + ";")