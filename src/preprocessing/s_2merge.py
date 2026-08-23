"""
GLOF Project — Sentinel-2 Batch Merge

src/preprocessing/s_2merge.py

Merges the 5 exported S2 batch CSVs (data/processed/sentinel2/) into
one master file. Self-contained — no dependency on lake_master.csv.

Primary project key: GL_ID

Run from anywhere inside the repo:

    python src/preprocessing/s_2merge.py
"""

import glob
from pathlib import Path
import pandas as pd


# ------------------------------------------------------------
# 0. Paths — resolved relative to this file, not the cwd
# ------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[1]  # GLOF/

S2_DIR = PROJECT_ROOT / "data" / "processed" / "sentinel2"

OUTPUT_FILE = S2_DIR / "s2_master_merged.csv"

EXPECTED_MONTHS = 132


# ------------------------------------------------------------
# 1. Load and concatenate all S2 batch files
# ------------------------------------------------------------

batch_files = sorted(
    glob.glob(str(S2_DIR / "s2_batch_*.csv"))
)

print("=" * 60)
print("SENTINEL-2 BATCH MERGE")
print("=" * 60)

print(f"\nFound {len(batch_files)} batch files:")

for f in batch_files:
    print(" -", Path(f).name)

if len(batch_files) == 0:
    raise FileNotFoundError(
        f"No s2_batch_*.csv files found in {S2_DIR}"
    )


dfs = []

for f in batch_files:

    print(f"\nReading {Path(f).name}...")

    df = pd.read_csv(f)

    print(f"Rows: {len(df):,}")
    print(f"Columns: {list(df.columns)}")

    # GL_ID must remain a string
    df["GL_ID"] = df["GL_ID"].astype(str).str.strip()

    df["source_file"] = Path(f).name

    dfs.append(df)


merged = pd.concat(
    dfs,
    ignore_index=True
)

print(f"\nTotal rows after concat: {len(merged):,}")


# ------------------------------------------------------------
# 2. Basic lake count
# ------------------------------------------------------------

n_lakes = merged["GL_ID"].nunique()

print(f"Unique GL_IDs: {n_lakes}")

print(
    f"Expected rows "
    f"(lakes x {EXPECTED_MONTHS} months): "
    f"{n_lakes * EXPECTED_MONTHS:,}"
)


# ------------------------------------------------------------
# 3. Duplicate check — catches overlapping START_INDEX
#    ranges between GEE batch runs
# ------------------------------------------------------------

dupes = merged[
    merged.duplicated(
        subset=["GL_ID", "date"],
        keep=False
    )
]


if len(dupes) > 0:

    print(
        f"\nWARNING: {len(dupes):,} duplicate "
        f"(GL_ID, date) rows found!"
    )

    print(
        "This usually means two batches "
        "overlapped in START_INDEX."
    )

    print(
        dupes
        .sort_values(["GL_ID", "date"])[
            ["GL_ID", "date", "source_file"]
        ]
        .head(20)
    )

else:

    print(
        "\nNo duplicate (GL_ID, date) pairs found."
    )


# ------------------------------------------------------------
# 4. Row-count-per-lake check — every lake should have
#    exactly 132 monthly rows
# ------------------------------------------------------------

row_counts = merged.groupby("GL_ID").size()

bad_counts = row_counts[
    row_counts != EXPECTED_MONTHS
]


if len(bad_counts) > 0:

    print(
        f"\nWARNING: {len(bad_counts)} lakes do NOT "
        f"have exactly {EXPECTED_MONTHS} rows:"
    )

    print(bad_counts)

else:

    print(
        f"\nEvery lake has exactly "
        f"{EXPECTED_MONTHS} monthly rows."
    )


# ------------------------------------------------------------
# 5. Null-rate sanity check — pre-2017 nulls are expected
#    S2 SR coverage begins in mid-2017
# ------------------------------------------------------------

pre_launch = merged[
    merged["year"] < 2017
]

post_launch = merged[
    merged["year"] >= 2017
]


print(
    f"\nPre-2017 rows: {len(pre_launch):,} "
    f"(S2_water_area_km2 null rate: "
    f"{pre_launch['S2_water_area_km2'].isna().mean():.1%} "
    f"— expect ~100%)"
)


print(
    f"2017+ rows: {len(post_launch):,} "
    f"(S2_water_area_km2 null rate: "
    f"{post_launch['S2_water_area_km2'].isna().mean():.1%} "
    f"— expect low)"
)


# ------------------------------------------------------------
# 6. Save merged file
# ------------------------------------------------------------

merged = merged.drop(
    columns=["source_file"]
)

merged = merged.sort_values(
    ["GL_ID", "date"]
).reset_index(
    drop=True
)


OUTPUT_FILE.parent.mkdir(
    parents=True,
    exist_ok=True
)


merged.to_csv(
    OUTPUT_FILE,
    index=False
)


# ------------------------------------------------------------
# 7. Final summary
# ------------------------------------------------------------

print(
    f"\nSaved merged file: {OUTPUT_FILE}"
)

print(
    f"Final shape: {merged.shape}"
)

print("\nPreview:")

print(
    merged.head(10)
)