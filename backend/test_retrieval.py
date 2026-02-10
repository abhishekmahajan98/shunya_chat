import asyncio
import os
from dotenv import load_dotenv
load_dotenv(".env")

from services.retrieval_service import RetrievalService
from database import get_supabase

async def test_retrieve():
    service = RetrievalService()
    
    # 1. Get the document ID first
    supabase = get_supabase()
    docs = supabase.table("documents").select("id, space_id").order("created_at", desc=True).limit(1).execute()
    if not docs.data:
        print("No documents found.")
        return
        
    doc_id = docs.data[0]['id']
    space_id = docs.data[0]['space_id']
    query = "Observatory"
    
    print(f"Testing retrieval for query: '{query}'")
    print(f"Filter Space ID: {space_id}")
    
    # 2. Call retrieve_context
    results = await service.retrieve_context(
        query=query,
        space_ids=[space_id],
        k=5
    )
    
    print(f"Results found: {len(results)}")
    for r in results:
        print(f"- {r['content'][:50]}... (Score: {r.get('similarity', 'N/A')})")

if __name__ == "__main__":
    asyncio.run(test_retrieve())
