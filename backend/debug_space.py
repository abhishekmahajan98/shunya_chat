import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load env from backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("Error: Missing Supabase credentials")
    sys.exit(1)

supabase: Client = create_client(url, key)

SPACE_ID = "d32e4d18-0ec6-4c48-baea-259f6fbe83b2"

print(f"--- Debugging Space: {SPACE_ID} ---")

# 1. Check Documents in Space
print("\n1. Querying Documents...")
docs = supabase.table("documents").select("*").eq("space_id", SPACE_ID).execute()
print(f"Found {len(docs.data)} documents.")
for doc in docs.data:
    print(f" - Doc: {doc['name']} (ID: {doc['id']})")

# 2. Check Chunks for these Documents
print("\n2. Querying Chunks...")
if not docs.data:
    print("No documents found, so no chunks.")
else:
    doc_ids = [d["id"] for d in docs.data]
    print(f"Checking chunks for Document IDs: {doc_ids}")
    # Supabase 'in' filter
    chunks = supabase.table("document_chunks").select("id", "document_id", "content").in_("document_id", doc_ids).limit(5).execute()
    print(f"Found {len(chunks.data)} chunks (showing first 5).")
    for chunk in chunks.data:
        print(f" - Chunk {chunk['id']} (Doc {chunk['document_id']}): {chunk['content'][:50]}...")

    # Count total chunks
    all_chunks = supabase.table("document_chunks").select("id", count="exact").in_("document_id", doc_ids).execute()
    print(f"Total chunks count: {all_chunks.count}")

print("\n3. Testing hybrid_search RPC...")
try:
    # Dummy embedding (768 dims)
    dummy_embedding = [0.0] * 768
    
    queries = [
        "when are my tickets for",
        "check event ticket dates",
        "observatory"
    ]
    
    for q in queries:
        print(f"\n--- Testing Query: '{q}' ---")
        rpc_params = {
            "query_text": q,
            "query_embedding": dummy_embedding,
            "match_count": 5,
            "filter_space_ids": [SPACE_ID],
            "filter_document_ids": None
        }
        
        print(f"Calling RPC with filter_space_ids: {rpc_params['filter_space_ids']}")
        res = supabase.rpc("hybrid_search", rpc_params).execute()
        print(f"RPC returned {len(res.data)} results.")
        for item in res.data:
            print(f" - Result: {item['content'][:30]}... (Score: {item['similarity']})")
except Exception as e:
    print(f"RPC Failed: {e}")
