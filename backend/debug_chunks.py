from database import get_supabase
import os
from dotenv import load_dotenv
load_dotenv(".env")
# also load backend env if needed, but .env should have the keys now

def check_chunks():
    supabase = get_supabase()
    # Get the latest document to get its ID
    docs = supabase.table("documents").select("*").order("created_at", desc=True).limit(1).execute()
    if not docs.data:
        print("No documents found.")
        return

    latest_doc = docs.data[0]
    print(f"Latest Document: {latest_doc['name']} (ID: {latest_doc['id']})")
    print(f"Status: {latest_doc.get('status')}")
    
    # Check chunks
    chunks = supabase.table("document_chunks").select("id, content, metadata").eq("document_id", latest_doc['id']).limit(5).execute()
    
    print(f"Chunks found: {len(chunks.data)}")
    if chunks.data:
        print("Sample chunk content:")
        print(chunks.data[0]['content'][:100] + "...")
    else:
        print("WARNING: No chunks found for this document!")

if __name__ == "__main__":
    check_chunks()
