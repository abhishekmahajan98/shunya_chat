from database import get_supabase
import json

def list_agents():
    supabase = get_supabase()
    result = supabase.table("agents").select("*").execute()
    print(json.dumps(result.data, indent=2))

if __name__ == "__main__":
    list_agents()
