# """
# GLOF Project — Fix GPM Master Column Names

# Changes only the common key column names:

#     Date  -> date
#     Year  -> year
#     Month -> month

# The GPM attribute columns are left unchanged.

# Input:
#     data/processed/gpm_master_merged.csv

# Output:
#     Same file, overwritten after validation.
# """

# from pathlib import Path
# import pandas as pd


# # ============================================================
# # 1. PATH
# # ============================================================

# SCRIPT_DIR = Path(__file__).resolve().parent
# PROJECT_ROOT = SCRIPT_DIR.parents[1]

# GPM_FILE = (
#     PROJECT_ROOT
#     / "data"
#     / "processed"
#     / "gpm_master_merged.csv"
# )


# # ============================================================
# # 2. LOAD
# # ============================================================

# print("=" * 60)
# print("FIXING GPM MASTER COLUMN NAMES")
# print("=" * 60)

# print("\nFile:")
# print(GPM_FILE)

# if not GPM_FILE.exists():
#     raise FileNotFoundError(
#         f"GPM master file not found:\n{GPM_FILE}"
#     )

# df = pd.read_csv(GPM_FILE)

# print(f"\nRows: {len(df):,}")
# print("\nOriginal columns:")
# print(list(df.columns))


# # ============================================================
# # 3. RENAME COMMON KEY COLUMNS
# # ============================================================

# rename_map = {
#     "Date": "date",
#     "Year": "year",
#     "Month": "month"
# }

# df = df.rename(
#     columns=rename_map
# )


# # ============================================================
# # 4. VALIDATE REQUIRED COLUMNS
# # ============================================================

# required_columns = [
#     "GL_ID",
#     "date",
#     "year",
#     "month",
#     "GPM_Precipitation_mm",
#     "GPM_Scan_Count"
# ]

# missing = [
#     column
#     for column in required_columns
#     if column not in df.columns
# ]

# if missing:
#     raise ValueError(
#         "\nMissing expected columns:\n"
#         + "\n".join(f" - {col}" for col in missing)
#     )


# # ============================================================
# # 5. CHECK DUPLICATE TEMPORAL KEYS
# # ============================================================

# key_columns = [
#     "GL_ID",
#     "date",
#     "year",
#     "month"
# ]

# duplicates = df.duplicated(
#     subset=key_columns,
#     keep=False
# )

# if duplicates.any():

#     print(
#         f"\nWARNING: {duplicates.sum():,} "
#         "duplicate key rows found."
#     )

#     print(
#         df.loc[
#             duplicates,
#             key_columns
#         ].head(20).to_string(index=False)
#     )

#     raise ValueError(
#         "\nDuplicate GL_ID + date + year + month "
#         "combinations detected."
#     )

# else:

#     print(
#         "\nNo duplicate "
#         "GL_ID + date + year + month keys."
#     )


# # ============================================================
# # 6. SAVE
# # ============================================================

# df.to_csv(
#     GPM_FILE,
#     index=False
# )


# # ============================================================
# # 7. FINAL CHECK
# # ============================================================

# print("\nNew columns:")
# print(list(df.columns))

# print(
#     f"\nSaved successfully:\n{GPM_FILE}"
# )

# print("\n" + "=" * 60)
# print("DONE")
# print("=" * 60)



# """
# GLOF Project — Fix Sentinel-1 Master Columns

# Removes accidental columns from:

#     data/processed/s1_master_merged.csv

# Removed:
#     Id
#     source_batch

# Keeps:
#     GL_ID
#     date
#     year
#     month
#     S1_observations
#     VV_mean
#     VV_median
#     VV_stdDev
#     VH_mean
#     VH_median
#     VH_stdDev
#     angle_mean
# """

# from pathlib import Path
# import pandas as pd


# # ============================================================
# # 1. PATH
# # ============================================================

# SCRIPT_DIR = Path(__file__).resolve().parent
# PROJECT_ROOT = SCRIPT_DIR.parents[1]

# S1_FILE = (
#     PROJECT_ROOT
#     / "data"
#     / "processed"
#     / "s1_master_merged.csv"
# )


# # ============================================================
# # 2. LOAD
# # ============================================================

# print("=" * 60)
# print("FIXING SENTINEL-1 MASTER COLUMNS")
# print("=" * 60)

# print("\nFile:")
# print(S1_FILE)

# if not S1_FILE.exists():
#     raise FileNotFoundError(
#         f"S1 master file not found:\n{S1_FILE}"
#     )

# df = pd.read_csv(S1_FILE)

# print(f"\nRows: {len(df):,}")

# print("\nOriginal columns:")
# print(list(df.columns))


# # ============================================================
# # 3. REMOVE UNNECESSARY COLUMNS
# # ============================================================

# columns_to_remove = [
#     "Id",
#     "source_batch"
# ]

# for column in columns_to_remove:

#     if column in df.columns:
#         print(f"\nRemoving column: {column}")
#         df = df.drop(columns=column)

#     else:
#         print(
#             f"\nColumn not found (already removed): {column}"
#         )


# # ============================================================
# # 4. REQUIRED COLUMN CHECK
# # ============================================================

# required_columns = [
#     "GL_ID",
#     "date",
#     "year",
#     "month",
#     "S1_observations",
#     "VV_mean",
#     "VV_median",
#     "VV_stdDev",
#     "VH_mean",
#     "VH_median",
#     "VH_stdDev",
#     "angle_mean"
# ]

# missing = [
#     column
#     for column in required_columns
#     if column not in df.columns
# ]

# if missing:

#     raise ValueError(
#         "\nMissing expected S1 columns:\n"
#         + "\n".join(
#             f" - {column}"
#             for column in missing
#         )
#     )


# # ============================================================
# # 5. CHECK TEMPORAL KEY
# # ============================================================

# key_columns = [
#     "GL_ID",
#     "date",
#     "year",
#     "month"
# ]

# duplicates = df.duplicated(
#     subset=key_columns,
#     keep=False
# )

# if duplicates.any():

#     print(
#         f"\nWARNING: {duplicates.sum():,} "
#         "duplicate key rows found."
#     )

#     print(
#         df.loc[
#             duplicates,
#             key_columns
#         ].head(20).to_string(index=False)
#     )

#     raise ValueError(
#         "\nDuplicate GL_ID + date + year + month "
#         "combinations detected."
#     )

# else:

#     print(
#         "\nNo duplicate "
#         "GL_ID + date + year + month keys."
#     )


# # ============================================================
# # 6. SAVE
# # ============================================================

# df.to_csv(
#     S1_FILE,
#     index=False
# )


# # ============================================================
# # 7. FINAL CHECK
# # ============================================================

# print("\nFinal columns:")
# print(list(df.columns))

# print(
#     f"\nSaved successfully:\n{S1_FILE}"
# )

# print("\n" + "=" * 60)
# print("DONE")
# print("=" * 60)




"""
GLOF Project — Fix LST Master Column Names

Changes only:

    Date  -> date
    Year  -> year
    Month -> month

All LST attribute columns remain unchanged.

Input:
    data/processed/lst_master_merged.csv
"""

from pathlib import Path
import pandas as pd


# ============================================================
# 1. PATH
# ============================================================

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[1]

LST_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "lst_master_merged.csv"
)


# ============================================================
# 2. LOAD
# ============================================================

print("=" * 60)
print("FIXING LST MASTER COLUMN NAMES")
print("=" * 60)

print("\nFile:")
print(LST_FILE)

if not LST_FILE.exists():
    raise FileNotFoundError(
        f"LST master file not found:\n{LST_FILE}"
    )

df = pd.read_csv(LST_FILE)

print(f"\nRows: {len(df):,}")

print("\nOriginal columns:")
print(list(df.columns))


# ============================================================
# 3. RENAME KEY COLUMNS
# ============================================================

rename_map = {
    "Date": "date",
    "Year": "year",
    "Month": "month"
}

df = df.rename(
    columns=rename_map
)


# ============================================================
# 4. REQUIRED COLUMN CHECK
# ============================================================

required_columns = [
    "GL_ID",
    "date",
    "year",
    "month",
    "LST_Day_C",
    "LST_Night_C",
    "LST_Scan_Count"
]

missing = [
    column
    for column in required_columns
    if column not in df.columns
]

if missing:

    raise ValueError(
        "\nMissing expected LST columns:\n"
        + "\n".join(
            f" - {column}"
            for column in missing
        )
    )


# ============================================================
# 5. DUPLICATE KEY CHECK
# ============================================================

key_columns = [
    "GL_ID",
    "date",
    "year",
    "month"
]

duplicates = df.duplicated(
    subset=key_columns,
    keep=False
)

if duplicates.any():

    print(
        f"\nWARNING: {duplicates.sum():,} "
        "duplicate key rows found."
    )

    print(
        df.loc[
            duplicates,
            key_columns
        ].head(20).to_string(index=False)
    )

    raise ValueError(
        "\nDuplicate GL_ID + date + year + month "
        "combinations detected."
    )

else:

    print(
        "\nNo duplicate "
        "GL_ID + date + year + month keys."
    )


# ============================================================
# 6. SAVE
# ============================================================

df.to_csv(
    LST_FILE,
    index=False
)


# ============================================================
# 7. FINAL CHECK
# ============================================================

print("\nFinal columns:")
print(list(df.columns))

print(
    f"\nSaved successfully:\n{LST_FILE}"
)

print("\n" + "=" * 60)
print("DONE")
print("=" * 60)