"""
fetch_top_rated.py — fetch the top 100 highest-rated movies from TMDB
(minimum 2500 votes), skip any already in the checkpoint, embed the new
ones, and write results to movie_embeddings_top_rated.json.

Uses the /discover/movie endpoint with sort_by=vote_average.desc and a
vote_count threshold to avoid obscure low-vote films inflating the top.
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

TOTAL_PAGES      = 5       # 5 pages × 20 results = 100 movies
MIN_VOTE_COUNT   = 2500    # filters out obscure films with artificially high averages
IDS_CHECKPOINT   = "top_rated_movie_ids_checkpoint.json"
OUTPUT_FILE      = "movie_embeddings_top_rated.json"


@retry_on_429(max_retries=4, fallback_wait=60.0)
def _fetch_top_rated_page(page: int) -> requests.Response:
    url = (
        f"{BASE_URL}/discover/movie"
        f"?include_adult=false"
        f"&include_video=false"
        f"&language=en-US"
        f"&sort_by=vote_average.desc"
        f"&vote_count.gte={MIN_VOTE_COUNT}"
        f"&page={page}"
    )
    return requests.get(url, headers=auth_headers())


def get_top_rated_movie_ids() -> list[int]:
    """Fetch the TMDB IDs for the top 100 rated movies."""
    movie_ids = []
    for page in range(1, TOTAL_PAGES + 1):
        response = _fetch_top_rated_page(page)
        if response.status_code != 200:
            print(f"Error fetching page {page}: {response.text}")
            continue
        movie_ids.extend(m["id"] for m in response.json().get("results", []))
        time.sleep(TMDB_SLEEP)
    return movie_ids


def main():
    # --- Load checkpoint and determine which movies still need fetching ---
    existing = load_checkpoint()
    seen_ids = checkpointed_ids(existing)

    # Load the ID list from its own checkpoint if available, otherwise fetch
    all_ids = load_ids_checkpoint(IDS_CHECKPOINT)
    if all_ids is None:
        print("Fetching top-rated movie IDs from TMDB...")
        all_ids = get_top_rated_movie_ids()
        save_ids_checkpoint(all_ids, IDS_CHECKPOINT)

    new_ids  = [mid for mid in all_ids if mid not in seen_ids]
    print(
        f"{len(all_ids)} top-rated movies found — "
        f"{len(all_ids) - len(new_ids)} already in checkpoint, "
        f"{len(new_ids)} are new."
    )

    # --- Fetch details for new movies only ---
    new_movies = []
    for i, movie_id in enumerate(new_ids):
        if i % 20 == 0:
            print(f"  Fetching metadata {i}/{len(new_ids)}...")
        response = get_movie_details(movie_id)
        if response.status_code != 200:
            print(f"  Skipping {movie_id}: {response.text}")
            continue
        new_movies.append(extract_movie_data(response.json()))
        time.sleep(TMDB_SLEEP)

    # --- Append new movies to checkpoint ---
    all_movies = existing + new_movies
    save_checkpoint(all_movies)

    # --- Embed only the newly fetched movies and write output ---
    if not new_movies:
        print("No new movies to embed — all top-rated movies were already in the checkpoint.")
        return

    generate_embeddings(new_movies, OUTPUT_FILE)


if __name__ == "__main__":
    main()