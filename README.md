# Multisensor Glacial Lake Analysis

A reproducible data-preprocessing and exploratory analysis workflow for building a **monthly, multisensor dataset of glacial lakes in Nepal**, forming the data foundation for the CT-707 major project *"A Multi-Sensor Machine Learning Framework for Dynamic Glacial Lake Hazard and Exposure Assessment in Nepal"* (Tribhuvan University, Institute of Engineering, Advanced College of Engineering and Management, Dept. of Electronics and Computer Engineering, supervised by Dr. Bipun Man Pati).

This project integrates glacial-lake inventory information with observations from **Google Earth Engine (GEE)-hosted ERA5, GPM, MODIS LST, Sentinel-1, and Sentinel-2** data to create a common lake-by-month data structure for environmental monitoring and future glacial-lake hazard analysis.


---

## Table of Contents

* [Project Overview](#project-overview)
* [Objectives](#objectives)
* [Study Design and Scope Note](#study-design-and-scope-note)
* [Data Sources](#data-sources)
* [Repository Structure](#repository-structure)
* [Dataset Schema](#dataset-schema)
* [Achieved Dataset Coverage](#achieved-dataset-coverage)
* [Environment Setup](#environment-setup)
* [Quick Start](#quick-start)
* [Preprocessing Workflow](#preprocessing-workflow)
* [Validation and Quality Control](#validation-and-quality-control)
* [Multisensor Merge Strategy](#multisensor-merge-strategy)
* [Exploratory Data Analysis — Key Findings](#exploratory-data-analysis--key-findings)
* [Important Data Considerations](#important-data-considerations)
* [Reproducibility Checklist](#reproducibility-checklist)
* [Current Limitations](#current-limitations)
* [Future Development](#future-development)
* [Known Inconsistencies to Verify](#known-inconsistencies-to-verify)
* [License](#license)

---

## Project Overview

Glacial lakes in the Himalayas are dynamic environments whose physical characteristics change in response to temperature, precipitation, surface conditions, and other climatic and environmental factors. This project establishes a consistent **spatio-temporal data foundation** for studying these changes across glacial lakes in Nepal, keyed on:

```text
(GL_ID, date)
```

Sensor-specific datasets are prepared independently — largely via **Google Earth Engine (GEE)**, with exports pulled down and combined locally in Python — and then merged into a single multisensor table.

The resulting dataset feeds downstream work described in the CT-707 report:

* an **LSTM Autoencoder** trained on stable-period lake behaviour to produce a per-lake, per-month anomaly score;
* an **XGBoost risk classifier** that fuses that anomaly signal with climate variables and OSM-derived exposure features (distance to settlements, trekking-route length, building counts) into a composite, SHAP-interpretable risk score.

Neither model is implemented in this checkout yet (see [Current Limitations](#current-limitations)); this repository currently covers preprocessing and EDA only.

---

## Objectives

1. **Standardize lake inventory information** — consistent glacial-lake identifiers and metadata.
2. **Prepare multisensor time-series data** — standardized temporal/lake identifiers across five sensors.
3. **Perform data-quality validation** — duplicate detection, coverage checks, missing-observation identification, merge-key validation.
4. **Explore the resulting dataset** — distributions, trends, seasonality, missingness, correlations, as a baseline before Phase 1/Phase 2 modelling (LSTM Autoencoder → XGBoost).

---

# Study Design and Scope Note

## Two Different Scopes — Read This Carefully

This repository's **preprocessing and EDA scope is national**: the active inventory and master dataset cover **494 glacial lakes across Nepal**, monthly, January 2015–December 2025.

The **downstream hazard-modelling scope described in the CT-707 report is regional and smaller**: the LSTM Autoencoder / XGBoost pipeline targets roughly **300 glacial lakes concentrated in the Khumbu and Annapurna regions** (five districts: Solukhumbu, Myagdi, Manang, Mustang, Kaski), where trekking-corridor exposure is highest. Earlier drafts of this README did not distinguish these two scopes; they are **not the same lake set**, and code/documentation referring to "all lakes" should be read as the 494-lake national preprocessing corpus unless a step explicitly says "Khumbu/Annapurna" or "~300 lakes."

### National Preprocessing Dataset Dimensions

| Parameter              |           Value |
| ---------------------- | --------------: |
| Study region (preprocessing) | Nepal (nationwide inventory) |
| Expected lakes         |             494 |
| Observation frequency  |         Monthly |
| Start date             |    January 2015 |
| End date               |   December 2025 |
| Months per lake        |             132 |
| Expected complete rows |          65,208 |
| Primary join key       | `(GL_ID, date)` |

### Downstream Modelling Subset (CT-707, not yet built)

| Parameter | Value |
| --- | --- |
| Study region | Khumbu & Annapurna corridors |
| Lakes | ~300 |
| Districts | Solukhumbu, Myagdi, Manang, Mustang, Kaski |
| Models | LSTM Autoencoder (anomaly detection) → XGBoost (risk classification) |
| Labelled events | Sparse — no standard supervised classifier is trained without the unsupervised anomaly stage first |

---

# Data Sources

| Dataset        | Platform / Source                | Extraction Environment | Main Measurements                           |
| -------------- | --------------------------------- | ----------------------- | -------------------------------------------- |
| Lake Inventory | Glacial-lake inventory (ICIMOD-referenced) | Local CSV | Location, area, elevation, basin, lake type |
| ERA5-Land      | ECMWF Reanalysis, monthly aggregate | Google Earth Engine | Centroid air temperature (`temperature_2m`) |
| GPM IMERG      | NASA GPM, V07 half-hourly rate    | Google Earth Engine | 5 km-buffer accumulated precipitation |
| MODIS LST      | MOD11A2, 8-day composite, 1 km    | Google Earth Engine | Day/night land-surface temperature, 5 km buffer |
| Sentinel-1     | Copernicus S1 GRD (IW, VV+VH)     | Google Earth Engine | VV/VH SAR backscatter (mean/median/stdDev), incidence angle |
| Sentinel-2     | Copernicus S2 SR Harmonized       | Google Earth Engine | NDWI and water-area estimates |

**Correction:** the original README omitted Google Earth Engine entirely, even though it is the platform on which all five sensor extractions actually run (per the CT-707 report, §4.1 and §3.4). The `gee/` scripts themselves are correctly noted below as *not* checked into this repository — only their exported CSV outputs are.

---

# Repository Structure

```text
multisensor-glacial-lake-analysis/
│
├── data/
│   ├── inventory/
│   │   ├── final_glaciers_master.csv
│   │   └── lake_master.csv
│   │
│   ├── raw/
│   │   └── Nepal glacial-lake shapefile
│   │
│   └── processed/
│       ├── sentinel2/
│       ├── era5_master_merged.csv
│       ├── gpm_master_merged.csv
│       ├── lst_master_merged.csv
│       ├── s1_master_merged.csv
│       ├── s2_master_merged.csv
│       └── master_multisensor_merged.csv   # ← already built; see note below
│
├── notebooks/
│   └── EDA_multisensor_lakes.ipynb
│
├── src/
│   └── preprocessing/
│       ├── top_lakes_by_area.py
│       ├── print-lake.py
│       ├── check_overlap.py
│       ├── s_2merge.py
│       ├── merge-master.py
│       └── fixed_grid.py
│
├── outputs/
│   └── figures/
│
└── README.md
```

### Directory Status

The GEE extraction scripts (Sentinel-1, GPM, ERA5, MODIS LST) that actually produced `data/processed/*_master_merged.csv` run in Google Earth Engine and are **not** part of this Python checkout — only their exported CSVs are present locally. The following directories referenced in the original project outline are also not part of the current checkout:

```text
gee/
models/
docs/
```

They should not be considered part of the current executable workflow.

---

# Dataset Schema

## Lake Inventory

`data/inventory/final_glaciers_master.csv` — fields: `Id`, `GL_ID`, `Latitude`, `Longitude`, `Basin`, `Sub_Basin`, `Area`, `Elevation`, `Type`, `Country`.

`data/inventory/lake_master.csv` is present but empty and is **not required** by the active Sentinel-2 merge workflow.

## Processed Sensor Datasets — Exact Output Columns

| File | Dataset | Key Output Columns (per CT-707 Table 4.1) |
| --- | --- | --- |
| `s1_master_merged.csv` | Sentinel-1 | `GL_ID`, `S1_observations`, `VV_mean`, `VV_median`, `VV_stdDev`, `VH_mean`, `VH_median`, `VH_stdDev`, `angle_mean` |
| `s2_master_merged.csv` | Sentinel-2 | `GL_ID`, `S2_observations`, `S2_NDWI_mean`, `S2_water_area_km2` |
| `era5_master_merged.csv` | ERA5-Land | `GL_ID`, `ERA5_temp_K`, `ERA5_temp_C` |
| `gpm_master_merged.csv` | GPM IMERG | `GPM_Precip_mm`, `GPM_Scan_Count` (⚠ see [Known Inconsistencies](#known-inconsistencies-to-verify) — the CT-707 table lists this file's lake key as `Id`, not `GL_ID`) |
| `lst_master_merged.csv` | MODIS LST | `GL_ID`, `LST_Day_C`, `LST_Night_C`, `LST_Scan_Count` |
| `master_multisensor_merged.csv` | Combined | All of the above, joined on `(GL_ID, date, year, month)` |

All sensor-level datasets are expected to contain the common temporal fields `GL_ID`, `date`, `year`, `month`, with `(GL_ID, date)` as the lake-month observation key.

---

# Achieved Dataset Coverage

**This section previously described 65,208 rows as an aspirational target only. It has since been achieved and validated.**

* The merged master table contains **65,208 rows across 22 columns** (4 join keys + 18 sensor-derived variables).
* Every one of the 494 inventoried lakes has **exactly 132 monthly rows** (Jan 2015–Dec 2025) — zero lakes have incomplete month coverage at the row level.
* No duplicate `(GL_ID, date)` pairs were found in any of the five sensor inputs or in the merged output.

This row-level completeness does **not** mean every cell has a valid measurement, see missingness figures below. A complete row means a lake-month slot exists; individual sensor fields within that row can still be null due to cloud cover, sensor gaps, or acquisition timing. Missing records may result from cloud contamination, sensor availability, acquisition frequency, quality filtering, spatial coverage, processing failures, or temporal differences between sensors — treat the dataset as a **partially observed environmental time series**, not a fully imputed one.

---

# Environment Setup

The project uses Python. **Two different Python versions are referenced across project documentation** — the EDA notebook records `Python 3.10.6`, while the CT-707 report's Tools & Technologies section specifies `Python 3.11` as the primary development language going forward. Use `3.10+` for compatibility with the existing notebook; move to `3.11` if extending the pipeline with the TensorFlow/Keras and XGBoost stages described in the report.

## Create a Virtual Environment

### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install pandas numpy matplotlib seaborn missingno statsmodels jupyter
```

At present the repository does not contain a `requirements.txt` or environment lock file. If continuing into Phase 1/Phase 2 modelling per the CT-707 report, you will additionally need: `tensorflow`/`keras`, `xgboost`, `shap`, `scikit-learn`, `geopandas`, `shapely`. Google Earth Engine access (`earthengine-api`) is required only if re-running sensor extraction, not for working with the already-exported CSVs in `data/processed/`.

---

# Quick Start

## 1. Inspect the Lake Inventory

```powershell
python src/preprocessing/top_lakes_by_area.py
```

## 2. Sentinel-2 — Status Corrected

**Earlier versions of this README stated the Sentinel-2 batch directory and merge were not yet available. This is no longer accurate**: `s2_master_merged.csv` has been produced and is already part of the validated `master_multisensor_merged.csv` (S2_NDWI_mean missingness of 47.24% was measured directly from it during EDA — see [Key Findings](#exploratory-data-analysis--key-findings)).

If you need to *regenerate* Sentinel-2 data from fresh batch exports (e.g., for a lake subset not yet covered), the batch CSVs must be placed in `data/processed/sentinel2/` with at least `GL_ID`, `date`, `year`, `month`, then:

```powershell
python src/preprocessing/print-lake.py       # check for missing inventory lakes
python src/preprocessing/check_overlap.py    # check for overlapping lake IDs
python src/preprocessing/s_2merge.py         # merge batches -> data/processed/sentinel2/s2_master_merged.csv
```

## 3. Merge the Sensor Master Tables

```powershell
python src/preprocessing/merge-master.py
```

Writes `data/processed/master_multisensor_merged.csv`. (Script filename uses a hyphen.)

## 4. Run the Exploratory Data Analysis

```powershell
jupyter notebook
```

Open `notebooks/EDA_multisensor_lakes.ipynb` and run top to bottom. Reads `../data/processed/master_multisensor_merged.csv`, writes figures to `../outputs/figures/`.

---

# Validation and Quality Control

Implemented in `src/preprocessing/merge-master.py`:

* **Required columns**: `GL_ID`, `date`, `year`, `month` — missing any triggers validation failure.
* **Duplicate lake-month records**: rejected per `(GL_ID, date)`.
* **Column-name conflicts**: non-key collisions between sensor tables are checked before merge.
* **One-to-one outer merge**: preserves lake-months even when a sensor has no valid observation for that month.
* **Post-merge duplicate check**: re-run on the final table.
* **Lake-level row count**: expects 132 rows/lake; a deviation warns rather than hard-fails (this warning path is now moot for the current dataset, since all 494 lakes achieved exactly 132 rows — but the check remains in place for future re-runs or lake-set changes).

---

# Multisensor Merge Strategy

Built around `GL_ID + date`, using an **outer join** rather than inner, so that a lake-month missing from one sensor still appears in the table (with nulls) rather than being silently dropped. This keeps the table suitable for missing-data analysis and feature engineering rather than only for complete-case rows.

**Batching detail (added — previously undocumented):** Sentinel-1 and Sentinel-2 were extracted in batches *by lake* (e.g., lakes 100–200) across the full 2015–2025 span, one CSV per batch. GPM and MODIS LST were extracted in batches *by year range* (2015–2019 and 2020–2024) across all 494 lakes at once. All batches were pulled down and concatenated locally per sensor before the five sensor tables were merged.

---

# Exploratory Data Analysis — Key Findings

**This section previously only listed what the EDA *examines*. The analysis has since been run; here are the actual results.**

### Missingness

* `S2_NDWI_mean` is missing in **47.24%** of rows — consistent with monsoon-season cloud contamination in optical-only monitoring.
* SAR-derived variables (VV/VH mean, median, stdDev, incidence angle) are missing in roughly **12.6%** of rows — consistent with Sentinel-1 revisit/scene-availability gaps.
* `S2_observations == 0` aligns exactly with null `S2_NDWI_mean`, confirming the missingness reflects genuine no-data conditions rather than a processing error.

### Cross-Sensor Correlation (Pearson)

* ERA5 temperature vs. MODIS LST night: **r = 0.91**
* ERA5 temperature vs. MODIS LST day: **r = 0.53**
* ERA5 temperature vs. GPM precipitation: **r = 0.72**
* Sentinel-1 VV_mean vs. VH_mean: **r = 0.94** (near-redundant polarization information)
* `angle_mean` and `S2_water_area_km2` correlate weakly with everything else — largely independent signals.

These redundancies (ERA5/LST, VV/VH) are flagged for feature selection ahead of LSTM input.

### Lake-Level Behaviour

* Only 5 of the top-10 lakes by mean water area also appear in the top-10 fastest-growing-by-trend list — static size does not reliably predict which lakes are changing fastest.
* After excluding near-empty lakes (mean area ≤ 0.01 km²), **no lake in the dataset shows a negative area trend over 2015–2025** — every substantial lake in the study corridors is expanding.
* Representative lakes examined in depth: **Imja, Thulagi, Tilicho** — all three show a consistent multi-year expansion trend, with significant autocorrelation in water area persisting across multiple lags (supporting a windowed/sequence LSTM approach over single-timestep methods).

---

# Important Data Considerations

## 1. Observation Count Does Not Guarantee Valid Measurements
A non-zero `S2_observations` does not guarantee a non-null `S2_NDWI_mean`. Treat observation counts and valid-measurement availability as separate quality indicators.

## 2. Interpolation in EDA Is Not General Imputation
Some autocorrelation visualizations use local interpolation purely for plot readability; the underlying dataset is not imputed.

## 3. No Validated Hazard Model Yet
Any anomaly-style signal in the current EDA (e.g., water-area variability rankings) is exploratory only and it is **not** a validated hazard indicator, flood prediction model, GLOF prediction system, or statistically validated anomaly detector. That is the explicit purpose of the not-yet-built LSTM Autoencoder stage.

## 4. Sentinel-1 Quality Checks
Some VV/VH values fall outside the broad `[-30, 5] dB` check range. EDA attributes most out-of-range values to real physical causes (wind, partial ice cover, acquisition angle) rather than sensor error, and recommends **sensor-specific physical checks** rather than a single blanket statistical outlier rule for Stage 1 preprocessing.

## 5. Sentinel-2 Temporal Coverage
Sentinel-2 availability is markedly lower during monsoon months (cloud contamination); pre-operational-era coverage requires careful interpretation. Missing Sentinel-2 observations should be treated as part of the observation process, not environmental absence.

---

# Preprocessing Utility Notes

## `fixed_grid.py`
Contains historical column-repair logic for GPM and Sentinel-1 (currently commented out). The active section validates/normalizes LST column names and can overwrite `data/processed/lst_master_merged.csv` in place. **Back up that file before running this utility.**

---

# Reproducibility Checklist

* [x] Confirm `final_glaciers_master.csv` contains the expected 494 unique lakes. — *achieved*
* [x] Confirm `GL_ID` values are unique and suitable for joining. — *achieved*
* [ ] Verify the inventory coordinate and metadata fields.
* [x] Supply/verify Sentinel-2 batch exports (`data/processed/sentinel2/`) — *already merged into the master table; only needed again for reprocessing.*
* [x] Run `s_2merge.py` — *already run for the current master dataset.*
* [x] Run `merge-master.py` — *already run; output validated (65,208 rows, zero duplicates, all 494 lakes at 132/132 months).*
* [x] Review missingness across sensors — *done; see [Key Findings](#exploratory-data-analysis--key-findings).*
* [x] Run the EDA notebook — *done; figures generated under `outputs/figures/`.*
* [ ] Record any data-quality issues before beginning downstream (LSTM/XGBoost) modelling — *see [Known Inconsistencies](#known-inconsistencies-to-verify).*

---

# Current Limitations

Not yet included as completed implementations (matches CT-707 "Work Remaining"):

* trained LSTM Autoencoder / XGBoost models and artifacts;
* model evaluation results (precision/recall/F1/AUC-ROC/Cohen's Kappa);
* automated feature-engineering pipeline;
* exposure-fusion layer (OSM settlement/trekking-route/building data for Khumbu & Annapurna);
* validated anomaly-detection system;
* hazard-risk classification model;
* model deployment pipeline;
* automated end-to-end data ingestion;
* environment lock file;
* automated test suite;
* complete experiment-tracking infrastructure.

---

# Future Development

Per the CT-707 report's two-phase remaining work plan:

**Phase 1 — Hazard Modeling:** clean the seven core features (S2 NDWI mean, S2 water area, S1 VV/VH mean, GPM precipitation, ERA5 temperature, MODIS LST), apply physically-driven outlier handling from the EDA, per-lake normalization, reshape into fixed-length sequences, chronological train/test split, train an LSTM Autoencoder on stable periods, derive reconstruction-error-based anomaly features (mean error, anomaly frequency, growth rate, climate correlation).

**Phase 2 — Exposure Fusion and Risk Classification:** compile OSM-derived settlement/trekking-route/building exposure data for the five Khumbu/Annapurna districts, compute downstream flood-corridor flow paths, combine with Phase 1 anomaly features and static lake attributes inside an XGBoost classifier, produce a per-lake risk label with SHAP-based interpretability, and validate against ICIMOD GLOF records and existing literature.

---

# Known Inconsistencies to Verify

Flagged during this README correction pass, not yet resolved, should be checked against the actual codebase before relying on them:

1. **GPM join key naming.** The CT-707 report's Table 4.1 lists `gpm_master_merged.csv`'s key output column as `Id`, while every other sensor table and the documented merge logic use `GL_ID`. Since the final merge reportedly passed all duplicate/key validation checks with zero errors, this is likely just an aliasing/rename step during merge (or a typo in the report table) rather than a live bug — but it should be confirmed directly against `merge-master.py` rather than assumed.
2. **ERA5/GPM spatial extraction method.** The originally *proposed* methodology (CT-707 §3.1.2) states ERA5 and GPM are "spatially averaged over a 5 km buffer around each lake centroid." The *actual implementation* described in §4.1.4 instead uses a first-value reducer sampled directly at the lake centroid point for ERA5 (buffer averaging is used for GPM and MODIS LST, not ERA5). Documentation describing ERA5 extraction should say "centroid point sample," not "5 km buffer average."
3. **Python version.** Notebook environment (3.10.6) vs. stated primary language version (3.11) in the tools section — pick one and pin it in a lock file once created.

---

# License

No license is currently specified in this repository. If intended for public distribution, add a `LICENSE` file and update this section accordingly.

---

## Final Note

This repository is a **data and exploratory-analysis foundation** for the CT-707 hazard-and-exposure project, not yet a completed hazard-prediction system. As of this correction, the multisensor dataset (494 lakes × 132 months × 5 sensors, 65,208 rows) is assembled, validated, and explored; the next work is Phase 1 (LSTM Autoencoder anomaly detection) and Phase 2 (XGBoost risk classification with exposure fusion), scoped to the ~300-lake Khumbu/Annapurna subset described above.
