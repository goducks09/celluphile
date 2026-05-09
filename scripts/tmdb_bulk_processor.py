#!/usr/bin/env python3
import csv
import json
import argparse
import sys
import requests

import utils

def search_movies(input_csv: str, output_csv: str):
    """
    Reads a CSV with a 'title' column, searches TMDB, and writes the first 3
    results (title, id, release_date) to the output CSV.
    """
    try:
        with open(input_csv, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames or 'title' not in reader.fieldnames:
                print("Error: Input CSV must contain a 'title' header.")
                sys.exit(1)
            titles = [{'title': row['title'], 'format': row['format']} for row in reader if row.get('title')]
    except Exception as e:
        print(f"Failed to read input CSV {input_csv}: {e}")
        sys.exit(1)

    headers = utils.auth_headers()
    results_list = []

    for title in titles:
        # Retry mechanism wrapper to handle rate limits
        @utils.retry_on_429(max_retries=4, fallback_wait=10.0)
        def _do_search(t):
            url = f"{utils.BASE_URL}/search/movie?query={requests.utils.quote(t)}&language=en-US"
            return requests.get(url, headers=headers)

        response = _do_search(title['title'])
        
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            # Get up to 3 results
            for result in results[:3]:
                results_list.append({
                    'title': result.get('title', ''),
                    'id': result.get('id', ''),
                    'release_date': result.get('release_date', ''),
                    'format': title['format']
                })
        else:
            print(f"Error fetching '{title}': HTTP {response.status_code}")

    try:
        with open(output_csv, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['title', 'id', 'release_date', 'format'])
            writer.writeheader()
            writer.writerows(results_list)
        print(f"Successfully wrote {len(results_list)} results to {output_csv}")
    except Exception as e:
        print(f"Failed to write output CSV {output_csv}: {e}")
        sys.exit(1)

def fetch_movie_details(input_csv: str, output_json: str):
    """
    Reads a CSV with an 'id' column, fetches detailed info from TMDB using the
    existing utils.get_movie_details, formats the output, and writes to a JSON file.
    """
    try:
        with open(input_csv, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames or 'id' not in reader.fieldnames:
                print("Error: Input CSV must contain an 'id' header.")
                sys.exit(1)
            movie_ids = [row['id'] for row in reader if row.get('id') and row['id'].strip().isdigit()]
    except Exception as e:
        print(f"Failed to read input CSV {input_csv}: {e}")
        sys.exit(1)

    movies_data = []

    for movie_id_str in movie_ids:
        movie_id = int(movie_id_str)
        response = utils.get_movie_details(movie_id)
        
        if response.status_code == 200:
            details = response.json()
            movie_data = utils.extract_movie_data(details)
            movies_data.append(movie_data)
        else:
            print(f"Error fetching details for ID {movie_id}: HTTP {response.status_code}")

    try:
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(movies_data, f, ensure_ascii=False, indent=2)
        print(f"Successfully wrote {len(movies_data)} movie details to {output_json}")
    except Exception as e:
        print(f"Failed to write output JSON {output_json}: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Bulk process movie data using TMDB API.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Search sub-command
    search_parser = subparsers.add_parser("search", help="Search TMDB for movies by title from a CSV file.")
    search_parser.add_argument("input_csv", help="Input CSV file containing a 'title' column.")
    search_parser.add_argument("output_csv", help="Output CSV file to save 'title', 'id', 'release_date'.")

    # Details sub-command
    details_parser = subparsers.add_parser("details", help="Fetch detailed movie info using TMDB IDs from a CSV file.")
    details_parser.add_argument("input_csv", help="Input CSV file containing an 'id' column.")
    details_parser.add_argument("output_json", help="Output JSON file to save full IMovie compliant data.")

    # Unique sub-command
    unique_parser = subparsers.add_parser("unique", help="Find unique movies from search.csv that don't exist in movie_metadata.json.")

    args = parser.parse_args()

    if args.command == "search":
        search_movies(args.input_csv, args.output_csv)
    elif args.command == "details":
        fetch_movie_details(args.input_csv, args.output_json)
    elif args.command == "unique":
        utils.unique_movies()

if __name__ == "__main__":
    main()
