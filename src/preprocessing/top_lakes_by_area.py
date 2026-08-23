"""
GLOF Project - Top 10 Lakes by Area

Reads the final glacial-lake inventory and prints the ten largest lakes.

Run from anywhere inside the repository:

    python src/preprocessing/top_lakes_by_area.py
"""

from pathlib import Path

import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[1]

INVENTORY_FILE = (
    PROJECT_ROOT
    / "data"
    / "inventory"
    / "final_glaciers_master.csv"
)

TOP_N = 10


print("=" * 60)
print("TOP 10 GLACIAL LAKES BY AREA")
print("=" * 60)
print(f"\nInventory: {INVENTORY_FILE}")

if not INVENTORY_FILE.exists():
    raise FileNotFoundError(
        f"Inventory file not found:\n{INVENTORY_FILE}"
    )

inventory = pd.read_csv(INVENTORY_FILE)

required_columns = ["Id", "GL_ID", "Area"]
missing_columns = [
    column
    for column in required_columns
    if column not in inventory.columns
]

if missing_columns:
    raise ValueError(
        "Inventory is missing required columns: "
        f"{missing_columns}"
    )

inventory["Area"] = pd.to_numeric(
    inventory["Area"],
    errors="raise"
)

top_lakes = (
    inventory
    .sort_values(
        by=["Area", "GL_ID"],
        ascending=[False, True]
    )
    .head(TOP_N)
    [["Id", "GL_ID", "Area", "Basin", "Sub_Basin", "Elevation"]]
)

print("\nArea is reported in km2.\n")
print(top_lakes.to_string(index=False))
