"""
fetch_popular.py — fetch the top 500 popular movies from TMDB, embed them,
and write the results to movie_embeddings_popular.json.

Skips any movies already present in the shared checkpoint file so it is safe
to re-run after a failure without duplicating work or API calls.
"""

import time

import requests

from utils import (
    auth_headers,
    retry_on_429,
    get_movie_details,
    extract_movie_data,
    load_checkpoint,
    save_checkpoint,
    checkpointed_ids,
    load_ids_checkpoint,
    save_ids_checkpoint,
    generate_embeddings,
    BASE_URL,
    TMDB_SLEEP,
)

TOTAL_PAGES     = 25    # 25 pages × 20 results = 500 movies
IDS_CHECKPOINT  = "popular_movie_ids_checkpoint.json"
OUTPUT_FILE     = "movie_embeddings_popular.json"


@retry_on_429(max_retries=4, fallback_wait=60.0)
def _fetch_popular_page(page: int) -> requests.Response:
    url = f"{BASE_URL}/movie/popular?language=en-US&page={page}"
    return requests.get(url, headers=auth_headers())


def get_popular_movie_ids() -> list[int]:
    """Fetch the TMDB IDs for the top 500 popular movies."""
    movie_ids = []
    for page in range(1, TOTAL_PAGES + 1):
        response = _fetch_popular_page(page)
        if response.status_code != 200:
            print(f"Error fetching page {page}: {response.text}")
            continue
        movie_ids.extend(m["id"] for m in response.json().get("results", []))
        time.sleep(TMDB_SLEEP)
    return movie_ids


def main():
    # --- Load checkpoint and determine which movies still need fetching ---
    existing   = load_checkpoint()
    seen_ids   = checkpointed_ids(existing)

    # Load the ID list from its own checkpoint if available, otherwise fetch
    all_ids = load_ids_checkpoint(IDS_CHECKPOINT)
    if all_ids is None:
        print("Fetching popular movie IDs from TMDB...")
        all_ids = get_popular_movie_ids()
        save_ids_checkpoint(all_ids, IDS_CHECKPOINT)
    
    new_ids    = [mid for mid in all_ids if mid not in seen_ids]
    print(f"{len(all_ids)} popular movies found — {len(new_ids)} are new (not in checkpoint).")

    # --- Fetch details for new movies only ---
    new_movies = []
    for i, movie_id in enumerate(new_ids):
        if i % 50 == 0:
            print(f"  Fetching metadata {i}/{len(new_ids)}...")
        response = get_movie_details(movie_id)
        if response.status_code != 200:
            print(f"  Skipping {movie_id}: {response.text}")
            continue
        new_movies.append(extract_movie_data(response.json()))
        time.sleep(TMDB_SLEEP)

    # --- Update checkpoint with the new movies appended ---
    all_movies = existing + new_movies
    save_checkpoint(all_movies)

    # --- Embed only the newly fetched movies and write output ---
    if not new_movies:
        print("No new movies to embed.")
        return

    generate_embeddings(new_movies, OUTPUT_FILE)


if __name__ == "__main__":
    main()