"""
sort_keys.py — write new copies of JSON output files with keys sorted alphabetically,
with 'tmdbId' forced into the second position in each document.
The original files are left untouched. Sorted copies are named with '_sorted'
appended before the extension, e.g. movie_embeddings_popular_sorted.json.
"""

import json
import os
import tempfile

FILES = [
    "movie_embeddings_top500.json",
    "movie_embeddings_top_rated.json",
]

PINNED_SECOND = "tmdbId"


def reorder_keys(doc: dict) -> dict:
    """
    Sort all keys alphabetically, then move PINNED_SECOND to index 1.
    If the key is absent the remaining keys are returned in alphabetical order.
    """
    sorted_keys = sorted(doc.keys())
    if PINNED_SECOND in sorted_keys:
        sorted_keys.remove(PINNED_SECOND)
        sorted_keys.insert(1, PINNED_SECOND)
    return {k: doc[k] for k in sorted_keys}


def sorted_filepath(filepath: str) -> str:
    """Return a new filepath with '_sorted' inserted before the extension."""
    root, ext = os.path.splitext(filepath)
    return f"{root}_sorted{ext}"


def sort_file_keys(filepath: str) -> None:
    if not os.path.exists(filepath):
        print(f"Skipping '{filepath}' — file not found.")
        return

    output_path = sorted_filepath(filepath)
    print(f"Sorting keys in '{filepath}' -> '{output_path}'...")

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Apply key reordering to every document in the array
    reordered = [reorder_keys(doc) for doc in data]

    dir_ = os.path.dirname(os.path.abspath(output_path))
    with tempfile.NamedTemporaryFile("w", dir=dir_, delete=False, suffix=".tmp", encoding="utf-8") as tmp:
        # sort_keys=False — key order is already handled by reorder_keys()
        json.dump(reordered, tmp, ensure_ascii=False, indent=2, sort_keys=False)
        tmp_path = tmp.name

    os.replace(tmp_path, output_path)
    print(f"  Done — '{output_path}' written.")


def main():
    for filepath in FILES:
        sort_file_keys(filepath)
    print("\nAll files processed.")


if __name__ == "__main__":
    main()