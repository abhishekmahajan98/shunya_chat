"""
Sample Data Query Agent Node.
Queries sample data from Supabase.
"""
from database import get_supabase
from ..state import AgentState


# Sample data - this simulates what would be in your database
SAMPLE_DATA = {
    "products": [
        {"id": 1, "name": "Quantum Widget", "price": 299.99, "stock": 150, "category": "Electronics"},
        {"id": 2, "name": "Neural Headset", "price": 599.99, "stock": 45, "category": "Electronics"},
        {"id": 3, "name": "Bio-Sensor Band", "price": 149.99, "stock": 320, "category": "Wearables"},
        {"id": 4, "name": "Holographic Display", "price": 1299.99, "stock": 28, "category": "Electronics"},
        {"id": 5, "name": "Smart Fabric Jacket", "price": 449.99, "stock": 85, "category": "Wearables"},
    ],
    "customers": [
        {"id": 1, "name": "Alice Chen", "tier": "Gold", "total_orders": 47, "location": "San Francisco"},
        {"id": 2, "name": "Bob Kumar", "tier": "Silver", "total_orders": 23, "location": "New York"},
        {"id": 3, "name": "Carol Santos", "tier": "Platinum", "total_orders": 128, "location": "Miami"},
        {"id": 4, "name": "David Park", "tier": "Gold", "total_orders": 56, "location": "Seattle"},
        {"id": 5, "name": "Eva Mueller", "tier": "Silver", "total_orders": 19, "location": "Austin"},
    ],
    "sales": [
        {"month": "Jan 2026", "revenue": 125000, "orders": 342, "avg_order": 365.50},
        {"month": "Feb 2026", "revenue": 148000, "orders": 398, "avg_order": 371.86},
        {"month": "Mar 2026", "revenue": 172000, "orders": 445, "avg_order": 386.52},
    ]
}


async def data_node(state: AgentState) -> dict:
    """
    Query sample data based on user intent.
    Returns structured data for the LLM to interpret.
    """
    last_message = state["messages"][-1]
    query = (last_message.content if hasattr(last_message, 'content') else str(last_message)).lower()
    
    # Determine which data category to return
    results = {}
    
    if "product" in query or "inventory" in query or "stock" in query:
        results["products"] = SAMPLE_DATA["products"]
    
    if "customer" in query or "user" in query or "client" in query:
        results["customers"] = SAMPLE_DATA["customers"]
    
    if "sale" in query or "revenue" in query or "order" in query:
        results["sales"] = SAMPLE_DATA["sales"]
    
    # If no specific match, return all data
    if not results:
        results = SAMPLE_DATA
    
    return {
        "agent_results": [{
            "agent": "data",
            "status": "success",
            "query": query,
            "data": results,
            "record_count": sum(len(v) for v in results.values())
        }]
    }
