from database import get_supabase
import os
from dotenv import load_dotenv
load_dotenv(".env")

def check_errors():
    supabase = get_supabase()
    res = supabase.table("documents").select("*").eq("status", "error").order("created_at", desc=True).limit(5).execute()
    if res.data:
        for doc in res.data:
            print(f"Document: {doc['name']} ({doc['id']})")
            print(f"Error: {doc.get('metadata', {}).get('error')}")
            print("-" * 20)
    else:
        print("No error documents found.")

if __name__ == "__main__":
    check_errors()
