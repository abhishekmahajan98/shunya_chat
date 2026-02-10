import os
from dotenv import load_dotenv
load_dotenv("../.env")

import uuid
from database import get_supabase
from services.indexing_service import indexing_service
import asyncio

async def test_full_flow():
    # Only need to init the service to trigger the log
    print("Service initialized.")
    try:
        # Create a dummy file
        with open("test_debug.txt", "w") as f:
            f.write("test content")
        
        with open("test_debug.txt", "rb") as f:
            file_bytes = f.read()
            
        res = indexing_service._partition_document("test_debug.txt", file_bytes)
        print(f"Partition Result count: {len(res)}")
    except Exception as e:
        print(f"Partition Failed: {e}")
    finally:
        if os.path.exists("test_debug.txt"):
            os.remove("test_debug.txt")

if __name__ == "__main__":
    asyncio.run(test_full_flow())
