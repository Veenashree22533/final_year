# Laptop data sources
- (primary table) -> data/raw/kaggle/ or data/raw/huggingface/
- (optional second source) -> data/raw/other/

# Run order
python src/cleaning/clean_laptops.py
python src/cleaning/finalize.py

Output: data/processed/laptops_final.csv
