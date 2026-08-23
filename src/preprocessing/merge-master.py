"""
GLOF Project — Master Multisensor Dataset Merge

src/preprocessing/merge_master.py

Merges the already-processed master datasets:

    data/processed/
        era5_master_merged.csv
        gpm_master_merged.csv
        lst_master_merged.csv
        s1_master_merged.csv
        s2_master_merged.csv

COMMON KEY:
    GL_ID + date + year + month

The files are NOT concatenated vertically.
They are merged horizontally so that each
GL_ID-month receives attributes from every sensor.

OUTPUT:
    data/processed/master_multisensor_merged.csv

Run from anywhere inside the repository:

    python src/preprocessing/merge_master.py
"""

from pathlib import Path

import pandas as pd


# ============================================================
# 0. PATHS
# ============================================================

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[1]

PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

OUTPUT_FILE = PROCESSED_DIR / "master_multisensor_merged.csv"


# ============================================================
# 1. COMMON PRIMARY / TEMPORAL KEY
# ============================================================

KEY_COLUMNS = [
    "GL_ID",
    "date",
    "year",
    "month"
]


# ============================================================
# 2. INPUT FILES
# ============================================================

FILES = {
    "ERA5": PROCESSED_DIR / "era5_master_merged.csv",
    "GPM": PROCESSED_DIR / "gpm_master_merged.csv",
    "LST": PROCESSED_DIR / "lst_master_merged.csv",
    "S1": PROCESSED_DIR / "s1_master_merged.csv",
    "S2": PROCESSED_DIR / "s2_master_merged.csv",
}


# ============================================================
# 3. HEADER
# ============================================================

print("=" * 70)
print("GLOF MULTISENSOR MASTER DATASET MERGE")
print("=" * 70)

print(f"\nProject root:")
print(PROJECT_ROOT)

print(f"\nProcessed directory:")
print(PROCESSED_DIR)

print("\nInput files:")

for name, path in FILES.items():
    print(f"  {name:5s}: {path.name}")


# ============================================================
# 4. CHECK THAT ALL FILES EXIST
# ============================================================

print("\n" + "=" * 70)
print("CHECKING INPUT FILES")
print("=" * 70)

for name, path in FILES.items():

    if not path.exists():
        raise FileNotFoundError(
            f"\nERROR: {name} file not found:\n{path}"
        )

    print(f"OK: {path.name}")


# ============================================================
# 5. READ FIRST DATASET
# ============================================================

print("\n" + "=" * 70)
print("READING DATASETS")
print("=" * 70)

first_name = "ERA5"

master = pd.read_csv(
    FILES[first_name]
)

print(
    f"\n{first_name}: "
    f"{len(master):,} rows x {len(master.columns)} columns"
)

print("Columns:")
print(list(master.columns))


# ============================================================
# 6. VALIDATE COMMON KEY
# ============================================================

def validate_key_columns(df, name):

    missing = [
        col for col in KEY_COLUMNS
        if col not in df.columns
    ]

    if missing:
        raise ValueError(
            f"\n{name} is missing required key columns: "
            f"{missing}"
        )


validate_key_columns(master, first_name)


# ============================================================
# 7. CHECK DUPLICATE KEYS IN FIRST DATASET
# ============================================================

duplicates = master.duplicated(
    subset=KEY_COLUMNS,
    keep=False
)

if duplicates.any():

    duplicate_count = duplicates.sum()

    print(
        f"\nWARNING: {first_name} contains "
        f"{duplicate_count:,} duplicate key rows."
    )

    print(
        master.loc[
            duplicates,
            KEY_COLUMNS
        ].head(20)
    )

    raise ValueError(
        f"\nDuplicate {KEY_COLUMNS} detected in {first_name}. "
        "Fix this before creating the master dataset."
    )

else:

    print(
        f"\nOK: {first_name} has no duplicate "
        f"{KEY_COLUMNS} combinations."
    )


# ============================================================
# 8. MERGE REMAINING DATASETS
# ============================================================

for name in [
    "GPM",
    "LST",
    "S1",
    "S2"
]:

    path = FILES[name]

    print("\n" + "-" * 70)
    print(f"Processing {name}")
    print("-" * 70)

    df = pd.read_csv(path)

    print(
        f"Rows: {len(df):,}"
    )

    print(
        f"Columns: {len(df.columns)}"
    )

    validate_key_columns(df, name)


    # --------------------------------------------------------
    # Duplicate key check
    # --------------------------------------------------------

    duplicates = df.duplicated(
        subset=KEY_COLUMNS,
        keep=False
    )

    if duplicates.any():

        duplicate_count = duplicates.sum()

        print(
            f"\nWARNING: {name} contains "
            f"{duplicate_count:,} duplicate key rows."
        )

        print(
            df.loc[
                duplicates,
                KEY_COLUMNS
            ].head(20)
        )

        raise ValueError(
            f"\nDuplicate {KEY_COLUMNS} detected in {name}. "
            "Fix this before merging."
        )

    else:

        print(
            f"OK: no duplicate {KEY_COLUMNS} "
            f"pairs in {name}."
        )


    # --------------------------------------------------------
    # Check for non-key column collisions
    # --------------------------------------------------------

    non_key_columns = [
        col for col in df.columns
        if col not in KEY_COLUMNS
    ]

    master_non_key = [
        col for col in master.columns
        if col not in KEY_COLUMNS
    ]

    collisions = sorted(
        set(non_key_columns)
        .intersection(master_non_key)
    )

    if collisions:

        raise ValueError(
            f"\nColumn name collision while merging {name}:\n"
            f"{collisions}\n\n"
            "Sensor-specific columns must have unique names."
        )


    # --------------------------------------------------------
    # Merge horizontally
    # --------------------------------------------------------

    before_rows = len(master)

    master = master.merge(
        df,
        on=KEY_COLUMNS,
        how="outer",
        validate="one_to_one"
    )

    after_rows = len(master)

    print(
        f"Rows before merge: {before_rows:,}"
    )

    print(
        f"Rows after merge:  {after_rows:,}"
    )

    print(
        f"Columns now:       {len(master.columns)}"
    )


# ============================================================
# 9. SORT MASTER DATASET
# ============================================================

print("\n" + "=" * 70)
print("SORTING MASTER DATASET")
print("=" * 70)

master = master.sort_values(
    ["GL_ID", "date"]
).reset_index(drop=True)


# ============================================================
# 10. FINAL KEY DUPLICATE CHECK
# ============================================================

print("\n" + "=" * 70)
print("FINAL KEY VALIDATION")
print("=" * 70)

duplicates = master.duplicated(
    subset=KEY_COLUMNS,
    keep=False
)

if duplicates.any():

    duplicate_count = duplicates.sum()

    print(
        f"\nERROR: {duplicate_count:,} duplicate "
        f"key rows exist in final dataset."
    )

    print(
        master.loc[
            duplicates,
            KEY_COLUMNS
        ].head(20)
    )

    raise ValueError(
        "\nFinal master dataset contains duplicate "
        "GL_ID + date + year + month keys."
    )

else:

    print(
        "\nOK: No duplicate "
        "GL_ID + date + year + month combinations."
    )


# ============================================================
# 11. DATASET SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("FINAL DATASET SUMMARY")
print("=" * 70)

print(
    f"\nTotal rows:       {len(master):,}"
)

print(
    f"Total columns:    {len(master.columns)}"
)

print(
    f"Unique GL_IDs:    {master['GL_ID'].nunique():,}"
)

print(
    f"Date range:       "
    f"{master['date'].min()} → {master['date'].max()}"
)


# ============================================================
# 12. ROW COUNT PER LAKE
# ============================================================

row_counts = master.groupby("GL_ID").size()

print(
    f"\nExpected months per complete lake: 132"
)

bad_counts = row_counts[
    row_counts != 132
]

if len(bad_counts) > 0:

    print(
        f"\nWARNING: {len(bad_counts)} lakes "
        "do not have exactly 132 rows."
    )

    print(
        bad_counts.head(30)
    )

else:

    print(
        "\nOK: Every lake has exactly "
        "132 monthly rows."
    )


# ============================================================
# 13. SENSOR COLUMN SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("SENSOR COLUMNS")
print("=" * 70)

for prefix in [
    "ERA5",
    "GPM",
    "LST",
    "S1",
    "S2"
]:

    columns = [
        col for col in master.columns
        if col.startswith(prefix)
    ]

    print(
        f"\n{prefix}:"
    )

    for col in columns:
        print(
            f"  - {col}"
        )


# ============================================================
# 14. NULL SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("NULL SUMMARY")
print("=" * 70)

sensor_columns = [
    col
    for col in master.columns
    if col not in KEY_COLUMNS
]

null_summary = (
    master[sensor_columns]
    .isna()
    .sum()
    .sort_values(ascending=False)
)

for column, count in null_summary.items():

    percentage = (
        count / len(master) * 100
    )

    print(
        f"{column:35s} "
        f"{count:8,} "
        f"({percentage:6.2f}%)"
    )


# ============================================================
# 15. SAVE FINAL MASTER DATASET
# ============================================================

print("\n" + "=" * 70)
print("SAVING MASTER DATASET")
print("=" * 70)

OUTPUT_FILE.parent.mkdir(
    parents=True,
    exist_ok=True
)

master.to_csv(
    OUTPUT_FILE,
    index=False
)

print(
    f"\nSaved successfully:"
)

print(
    OUTPUT_FILE
)


# ============================================================
# 16. FINAL PREVIEW
# ============================================================

print("\n" + "=" * 70)
print("FINAL MASTER DATASET PREVIEW")
print("=" * 70)

print(
    master.head(10).to_string(index=False)
)

print("\n" + "=" * 70)
print("DONE")
print("=" * 70)