"""
Extract PDF Metadata Script
---------------------------
A helper script that extracts text from a PDF using the pypdf library.
Uses a sampling strategy (first 3 pages + last page) for faster classification.
Returns output as a JSON dictionary to stdout.
"""

import sys
import json
try:
    from pypdf import PdfReader
except ImportError:
    print(json.dumps({"error": "pypdf is not installed. Please install it using 'pip install pypdf'."}))
    sys.exit(0)

def extract_pdf_metadata(file_path):
    """
    Reads a PDF and returns the text from a sample of pages.
    Sampling: First 3 pages and the Last page.
    """
    try:
        reader = PdfReader(file_path)
        num_pages = len(reader.pages)
        
        pages_to_read = []
        
        # Add first 3 pages (if they exist)
        for i in range(min(3, num_pages)):
            pages_to_read.append(i)
            
        # Add last page (if it's not already included)
        if num_pages > 3:
            pages_to_read.append(num_pages - 1)
            
        extracted_text = []
        for page_idx in pages_to_read:
            text = reader.pages[page_idx].extract_text()
            if text:
                extracted_text.append(f"--- Page {page_idx + 1} ---\n{text}")
        
        full_text = "\n\n".join(extracted_text)
        
        return {
            "success": True,
            "text": full_text
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Please provide the path to the PDF file."}))
        sys.exit(0)
        
    target_file = sys.argv[1]
    result = extract_pdf_metadata(target_file)
    print(json.dumps(result, indent=2))
