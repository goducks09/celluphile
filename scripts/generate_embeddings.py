from datetime import datetime, timezone
import functools
import json
import os
from pathlib import Path
import time

from dotenv import load_dotenv
import requests
from sentence_transformers import SentenceTransformer

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env.local") 

BASE_URL = os.environ.get("TMDB_API_BASE_URL")
CHECKPOINT_FILE = "movie_metadata_checkpoint.json"
TMDB_API_READ_ACCESS_TOKEN = os.environ.get("TMDB_API_READ_ACCESS_TOKEN")
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"
TMDB_RATE_LIMIT_SLEEP = 0.05
TOP_CAST_COUNT = 5
TOTAL_PAGES = 25 # 25 pages × 20 results = 500 movies

# ---------------------------------------------------------------------------
# Harrier model notes
# ---------------------------------------------------------------------------
# - Produces 1024-dimensional embeddings (up from 384 with all-MiniLM-L6-v2).
#   Update your MongoDB Atlas Vector Search index to use numDimensions: 1024.
# - Document side (movie metadata): NO prompt needed — encode as plain text.
# - Query side (user preference profile at search time in Next.js): you MUST
#   pass prompt_name="sts_query" (or a custom instruction) when encoding the
#   user vector, otherwise you'll see degraded similarity quality.
#   Example in your API route:
#     query_embedding = model.encode(user_profile_text, prompt_name="sts_query")
# ---------------------------------------------------------------------------

BATCH_SIZE = 32            # tune down to 8–16 if you hit memory limits
EMBEDDING_DIM = 1024       # reflect this in your Atlas Vector Search index
EMBEDDING_MODEL = "microsoft/harrier-oss-v1-0.6b"

if not BASE_URL or not TMDB_API_READ_ACCESS_TOKEN:
    raise EnvironmentError("TMDB_API_READ_ACCESS_TOKEN or TMDB_API_BASE_URL is not set. Add it to your .env file or environment.")


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


@retry_on_429(max_retries=4, fallback_wait=60.0)
def _fetch_popular_page(page: int) -> requests.Response:
    """Fetch a single page of popular movies. Returns a Response object."""
    url = f"{BASE_URL}/movie/popular?language=en-US&page={page}"
    headers = {
        "accept": "application/json",
        "Authorization": f"Bearer {TMDB_API_READ_ACCESS_TOKEN}",
    }
    return requests.get(url, headers=headers)


def get_popular_movies() -> list[int]:
    """
    Fetch the top 500 popular movies from TMDB.
    """
    movie_ids = []
    for page in range(1, TOTAL_PAGES + 1):
        response = _fetch_popular_page(page)
        if response.status_code != 200:
            print(f"Error fetching page {page}: {response.text}")
            continue
        results = response.json().get("results", [])
        movie_ids.extend(m["id"] for m in results)
        time.sleep(TMDB_RATE_LIMIT_SLEEP)
    return movie_ids


@retry_on_429(max_retries=4, fallback_wait=60.0)
def get_movie_details(movie_id: int) -> requests.Response:
    """Fetch movie details including credits and keywords from TMDB."""
    url = (
        f"{BASE_URL}/movie/{movie_id}"
        f"?append_to_response=credits,keywords"
    )
    headers = {
        "accept": "application/json",
        "Authorization": f"Bearer {TMDB_API_READ_ACCESS_TOKEN}",
    }
    return requests.get(url, headers=headers)


def parse_name(full_name: str) -> dict:
    """
    Split a full name string into firstName, lastName, and fullName.
    Handles single-word names (e.g. "Zendaya") by setting lastName to an
    empty string and putting the full name in firstName.
    For names with more than two parts (e.g. "Mary Elizabeth Winstead"),
    everything except the last token is treated as the first name.
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
    Returns a dict with both the structured metadata fields and the embedding
    text string derived from them.
    """
    crew = details.get("credits", {}).get("crew", [])
    cast = details.get("credits", {}).get("cast", [])
 
    genres      = [g["name"] for g in details.get("genres", [])]
    keywords    = [k["name"] for k in details.get("keywords", {}).get("keywords", [])]
    actors      = [parse_name(c["name"]) for c in cast[:TOP_CAST_COUNT]]
    directors   = [parse_name(c["name"]) for c in crew if c["job"] == "Director"]
 
    poster_path = details.get("poster_path")
    poster      = f"{TMDB_IMAGE_BASE_URL}{poster_path}" if poster_path else None
 
    # Build the embedding text from the structured fields so both stay in sync.
    # Directors list may have multiple entries (co-directors); join them.
    embedding_text = (
        f"Genres: {', '.join(genres)}. "
        f"Keywords: {', '.join(keywords)}. "
        f"Director: {', '.join(d['fullName'] for d in directors) if directors else 'Unknown'}. "
        f"Cast: {', '.join(a['fullName'] for a in actors)}. "
        f"Plot: {details.get('overview', '')}"
    )
 
    return {
        "tmdbId":      details.get("id"),
        "title":       details.get("title"),
        "poster":      poster,
        "overview":    details.get("overview"),
        "genres":      genres,
        "keywords":    keywords,
        "actors":      actors,
        "directors":   directors,
        "releaseDate": details.get("release_date"),   # "YYYY-MM-DD" string from TMDB
        "runtime":     details.get("runtime"),         # minutes, int
        "voteAverage": details.get("vote_average"),
        "voteCount":   details.get("vote_count"),
        "popularity":  details.get("popularity"),
        "lastFetched": datetime.now(timezone.utc).isoformat(),
        # Stored separately so you can re-embed without re-fetching TMDB
        "_embeddingText": embedding_text,
    }




def main():
    print("Fetching top 500 popular movies from TMDB...")
    movie_ids = get_popular_movies()
    print(f"Fetched {len(movie_ids)} movie IDs.")

    print(f"Loading embedding model '{EMBEDDING_MODEL}'...")
    model = SentenceTransformer(EMBEDDING_MODEL, model_kwargs={"dtype": "auto"})

    # --- Phase 1: collect metadata ---
    # Load from checkpoint if it exists so TMDB API calls are not repeated
    # on a re-run after an embedding failure.
    if os.path.exists(CHECKPOINT_FILE):
        print(f"Checkpoint found — loading metadata from '{CHECKPOINT_FILE}' (delete it to re-fetch from TMDB).")
        with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
            movies_metadata = json.load(f)
        print(f"Loaded {len(movies_metadata)} movies from checkpoint.")
    else:
        print("Fetching movie metadata from TMDB...")
        movies_metadata = []
        for i, movie_id in enumerate(movie_ids):
            if i % 50 == 0:
                print(f"  Metadata {i}/{len(movie_ids)}...")

            response = get_movie_details(movie_id)
            if response.status_code != 200:
                print(f"  Skipping movie {movie_id}: {response.text}")
                continue

            details = response.json()
            movies_metadata.append(extract_movie_data(details))
            time.sleep(TMDB_RATE_LIMIT_SLEEP)

        print(f"Collected metadata for {len(movies_metadata)} movies.")
        with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
            json.dump(movies_metadata, f, ensure_ascii=False, indent=2)
        print(f"Metadata saved to '{CHECKPOINT_FILE}'.")

    # --- Phase 2: batch encode ---
    # No prompt_name here — Harrier only needs instructions on the QUERY side.
    # These movie texts are documents, so plain encoding is correct.
    print(f"Generating embeddings in batches of {BATCH_SIZE}...")
    texts = [m["_embeddingText"] for m in movies_metadata]
    embeddings = model.encode(
        texts,
        batch_size=BATCH_SIZE,
        show_progress_bar=True,
        normalize_embeddings=True,
    )

    # --- Phase 3: assemble output ---
    # Merge the embedding vector into each metadata document and drop the
    # internal _embeddingText key (kept separate so you can re-embed without
    # re-fetching TMDB, but not needed in the final MongoDB document).
    output = []
    for meta, embedding in zip(movies_metadata, embeddings):
        doc = {k: v for k, v in meta.items() if k != "_embeddingText"}
        doc["embedding"] = embedding.tolist()
        output.append(doc)
 
    output_file = "movie_embeddings_top500.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
 
    print(f"\nDone. Generated {len(output)} embeddings → {output_file}")
    print(
        "\nMongoDB Atlas Vector Search index config reminder:\n"
        f"  numDimensions: {EMBEDDING_DIM}\n"
        "  similarity: cosine  (or dotProduct, since vectors are L2-normalised)\n"
        "  path: embedding"
    )



if __name__ == "__main__":
    main()