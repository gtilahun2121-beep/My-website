"""
Find Duplicates Script
----------------------
This script deterministically finds identical files in a directory tree.
Instead of relying on filenames or sizes, it uses SHA-256 hashing to compare
the actual byte-for-byte content of the files.
"""

import os
import hashlib
import sys
import json

def get_file_hash(file_path):
    """Calculates the SHA-256 content hash of a file, reading in 8KB chunks to save memory."""
    hash_func = hashlib.sha256()
    try:
        with open(file_path, 'rb') as f:
            while chunk := f.read(8192):
                hash_func.update(chunk)
        return hash_func.hexdigest()
    except (OSError, IOError):
        return None

def find_duplicates(directory):
    """Recursively scans a directory for files with identical hashes, skipping the 'to_remove' folder."""
    hashes = {}
    duplicates = []
    
    for root, _, files in os.walk(directory):
        # Prevent jumping above the start folder or into 'to_remove'
        if 'to_remove' in root.split(os.sep):
            continue
            
        for filename in files:
            file_path = os.path.join(root, filename)
            file_hash = get_file_hash(file_path)
            
            if file_hash:
                if file_hash in hashes:
                    duplicates.append({
                        "original": hashes[file_hash],
                        "duplicate": file_path
                    })
                else:
                    hashes[file_hash] = file_path
                    
    return duplicates

if __name__ == "__main__":
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    dupes = find_duplicates(target_dir)
    print(json.dumps(dupes, indent=2))
