"""
utils.py — shared TMDB fetching, metadata extraction, and embedding logic.
Imported by fetch_popular.py and fetch_top_rated.py.
"""

import csv
import os
import json
import time
import functools
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env.local")

TMDB_READ_ACCESS_TOKEN = os.environ.get("TMDB_API_READ_ACCESS_TOKEN")
if not TMDB_READ_ACCESS_TOKEN:
    raise EnvironmentError(
        "TMDB_API_READ_ACCESS_TOKEN is not set. Add it to your .env file or environment."
    )

HF_TOKEN = os.environ.get("HF_TOKEN")
if not HF_TOKEN:
    raise EnvironmentError("HF_TOKEN is not set. Add it to your .env file or environment.")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL           = os.environ.get("TMDB_API_BASE_URL")
TMDB_IMAGE_BASE    = os.environ.get("TMDB_API_IMAGE_BASE_URL")
TOP_CAST_COUNT     = 5
TMDB_SLEEP         = 0.05
CHECKPOINT_FILE    = "movie_metadata_checkpoint.json"

# ---------------------------------------------------------------------------
# Harrier model notes
# ---------------------------------------------------------------------------
# - Produces 1024-dimensional embeddings.
#   Your MongoDB Atlas Vector Search index must use numDimensions: 1024.
# - Documents (movie metadata): NO prompt needed — encode as plain text.
# - Queries (user preference profile at search time in Next.js): MUST use
#   prompt_name="sts_query", otherwise similarity quality degrades.
#   Example:
#     query_embedding = model.encode(user_profile_text, prompt_name="sts_query")
# ---------------------------------------------------------------------------

EMBEDDING_MODEL = "microsoft/harrier-oss-v1-0.6b"
EMBEDDING_DIM   = 1024
BATCH_SIZE      = 32   # reduce to 8–16 if you hit memory limits

# ---------------------------------------------------------------------------
# Auth header (Bearer token — TMDB's recommended auth method)
# ---------------------------------------------------------------------------

def auth_headers() -> dict:
    return {
        "accept": "application/json",
        "Authorization": f"Bearer {TMDB_READ_ACCESS_TOKEN}",
    }

# ---------------------------------------------------------------------------
# Retry decorator
# ---------------------------------------------------------------------------

def retry_on_429(max_retries: int = 4, fallback_wait: float = 60.0):
    """
    Decorator that retries a function on HTTP 429 responses.
    The decorated function must return a requests.Response object.
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                response = func(*args, **kwargs)
                if response.status_code != 429:
                    return response
                if attempt == max_retries:
                    print(f"Max retries ({max_retries}) reached. Giving up.")
                    return response
                retry_after = response.headers.get("Retry-After", fallback_wait)
                print(f"Rate limited. Waiting {retry_after}s (attempt {attempt + 1}/{max_retries})...")
                try:
                    time.sleep(int(retry_after))
                except ValueError:
                    time.sleep(fallback_wait)
            return response
        return wrapper
    return decorator

# ---------------------------------------------------------------------------
# TMDB movie detail fetch
# ---------------------------------------------------------------------------

@retry_on_429(max_retries=4, fallback_wait=60.0)
def get_movie_details(movie_id: int) -> requests.Response:
    """Fetch full movie details (including credits and keywords) from TMDB."""
    url = f"{BASE_URL}/movie/{movie_id}?append_to_response=credits,keywords&language=en-US"
    return requests.get(url, headers=auth_headers())

# ---------------------------------------------------------------------------
# Metadata extraction
# ---------------------------------------------------------------------------

def parse_name(full_name: str) -> dict:
    """
    Split a full name into firstName, lastName, and fullName.
    Single-word names (e.g. "Zendaya") get lastName set to "".
    Multi-part first names (e.g. "Mary Elizabeth Winstead") are kept together
    as firstName; only the final token becomes lastName.
    """
    parts = full_name.strip().split()
    if len(parts) == 1:
        return {"firstName": parts[0], "lastName": "", "fullName": full_name}
    return {
        "firstName": " ".join(parts[:-1]),
        "lastName":  parts[-1],
        "fullName":  full_name,
    }


def extract_movie_data(details: dict) -> dict:
    """
    Extract and structure all relevant fields from a TMDB movie detail response.
    The _embeddingText field is used to generate the vector and is stripped from
    the final MongoDB document — it is kept in the checkpoint so embeddings can
    be regenerated without re-fetching TMDB.
    """
    crew = details.get("credits", {}).get("crew", [])
    cast = details.get("credits", {}).get("cast", [])

    genres    = [g["name"] for g in details.get("genres", [])]
    keywords  = [k["name"] for k in details.get("keywords", {}).get("keywords", [])]
    actors    = [parse_name(c["name"]) for c in cast[:TOP_CAST_COUNT]]
    directors = [parse_name(c["name"]) for c in crew if c["job"] == "Director"]

    poster_path = details.get("poster_path")
    poster      = f"{TMDB_IMAGE_BASE}{poster_path}" if poster_path else None

    embedding_text = (
        f"Genres: {', '.join(genres)}. "
        f"Keywords: {', '.join(keywords)}. "
        f"Director: {', '.join(d['fullName'] for d in directors) if directors else 'Unknown'}. "
        f"Cast: {', '.join(a['fullName'] for a in actors)}. "
        f"Plot: {details.get('overview', '')}"
    )

    return {
        "tmdbId":         details.get("id"),
        "actors":         actors,
        "directors":      directors,
        "genres":         genres,
        "keywords":       keywords,
        "lastFetched":    datetime.now(timezone.utc).isoformat(),
        "overview":       details.get("overview"),
        "popularity":     details.get("popularity"),
        "poster":         poster,
        "releaseDate":    details.get("release_date"),
        "runtime":        details.get("runtime"),
        "title":          details.get("title"),
        "voteAverage":    details.get("vote_average"),
        "voteCount":      details.get("vote_count"),
        "_embeddingText": embedding_text,
    }

# ---------------------------------------------------------------------------
# Checkpoint helpers — movie metadata
# ---------------------------------------------------------------------------

def load_checkpoint() -> list[dict]:
    """Load existing checkpoint file, or return an empty list if none exists."""
    if not os.path.exists(CHECKPOINT_FILE):
        return []
    with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"Checkpoint loaded: {len(data)} movies already fetched.")
    return data


def save_checkpoint(movies: list[dict]) -> None:
    """Overwrite the checkpoint file with the full current movie list."""
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(movies, f, ensure_ascii=False, indent=2)
    print(f"Checkpoint saved: {len(movies)} movies → '{CHECKPOINT_FILE}'.")


def checkpointed_ids(movies: list[dict]) -> set[int]:
    """Return the set of tmdbIds already present in the checkpoint."""
    return {m["tmdbId"] for m in movies}


def unique_movies(output_path: str = "unique_movies.csv") -> None:
    """Write movies from search.csv that don't exist in movie_metadata.json to a new CSV."""

    with open("embeddings/movie_metadata_checkpoint.json", "r", encoding="utf-8") as f:
        seen = json.load(f)

    seen_ids = {m["tmdbId"] for m in seen}

    with open("search.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames  # preserve the original CSV columns

        unique = [movie for movie in reader if int(movie["id"]) not in seen_ids]

    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(unique)

# ---------------------------------------------------------------------------
# Checkpoint helpers — movie ID lists
# ---------------------------------------------------------------------------

def load_ids_checkpoint(filepath: str) -> list[int] | None:
    """
    Load a previously saved list of movie IDs from filepath.
    Returns None if the file does not exist, so callers can distinguish
    between an empty list and a missing checkpoint.
    """
    if not os.path.exists(filepath):
        return None
    with open(filepath, "r", encoding="utf-8") as f:
        ids = json.load(f)
    print(f"ID checkpoint found — loaded {len(ids)} IDs from '{filepath}' (delete to re-fetch).")
    return ids


def save_ids_checkpoint(ids: list[int], filepath: str) -> None:
    """Persist a list of movie IDs to filepath."""
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(ids, f)
    print(f"ID checkpoint saved: {len(ids)} IDs → '{filepath}'.")

# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

def generate_embeddings(movies_metadata: list[dict], output_file: str) -> None:
    """
    Batch-encode the _embeddingText for each movie, assemble the final
    documents (without _embeddingText), and write them to output_file.
    """
    print(f"Loading embedding model '{EMBEDDING_MODEL}'...")
    model = SentenceTransformer(EMBEDDING_MODEL, model_kwargs={"dtype": "auto"})

    print(f"Generating embeddings in batches of {BATCH_SIZE}...")
    texts = [m["_embeddingText"] for m in movies_metadata]
    embeddings = model.encode(
        texts,
        batch_size=BATCH_SIZE,
        show_progress_bar=True,
        normalize_embeddings=True,  # L2-normalised; use dotProduct or cosine in Atlas
    )

    output = []
    for meta, embedding in zip(movies_metadata, embeddings):
        doc = {k: v for k, v in meta.items() if k != "_embeddingText"}
        doc["embedding"] = embedding.tolist()
        output.append(doc)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nDone. {len(output)} embeddings → '{output_file}'")
    print(
        f"\nAtlas Vector Search index reminder:\n"
        f"  numDimensions: {EMBEDDING_DIM}\n"
        f"  similarity: cosine  (or dotProduct — vectors are L2-normalised)\n"
        f"  path: embedding"
    )