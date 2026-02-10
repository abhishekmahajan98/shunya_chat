import logging
import asyncio
from typing import List, Optional, Dict, Any
from google import genai
from config import settings
from database import get_supabase
import json

logger = logging.getLogger("rag_debugger")

class RetrievalService:
    """Service to perform advanced RAG retrieval using query expansion and hybrid search."""

    def __init__(self):
        self.gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)

    async def retrieve_context(self, query: str, space_ids: Optional[List[str]] = None, document_ids: Optional[List[str]] = None, k: int = 10) -> List[Dict[str, Any]]:
        """
        Execute full RAG retrieval pipeline.
        """
        # 1. Query Expansion
        # Include original query
        expanded_queries = await self._expand_query(query)
        queries = list(set([query] + expanded_queries))
        
        all_results = []
        for q in queries:
            results = await self._hybrid_search(q, space_ids, document_ids, match_count=k)
            all_results.extend(results)
            
        # 2. Re-ranking / De-duplication
        seen_ids = set()
        unique_results = []
        for r in all_results:
            if r["chunk_id"] not in seen_ids:
                seen_ids.add(r["chunk_id"])
                unique_results.append(r)
        
        # Sort by similarity and take top k
        unique_results.sort(key=lambda x: x["similarity"], reverse=True)
        final_results = unique_results[:k]

        # Log content for debugging
        logger.info(f"Final retrieved {len(final_results)} chunks:")
        for i, r in enumerate(final_results):
            logger.info(f"  [{i+1}] {r['content'][:100]}...")

        return final_results

    async def _expand_query(self, query: str) -> List[str]:
        """Use LLM to generate diverse search queries."""
        prompt = f"""
        You are a search expert. The user is asking a question in a RAG system.
        Generate 3 diverse, specific search queries that would help find the information needed to answer this question.
        Focus on technical keywords, synonymous terms, and specific entities.
        
        Original Question: {query}
        
        Return the queries as a JSON list of strings.
        Example: ["query 1", "query 2", "query 3"]
        """
        
        try:
            response = self.gemini_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config={'response_mime_type': 'application/json'}
            )
            return json.loads(response.text)
        except Exception as e:
            print(f"Query expansion error: {str(e)}")
            return []

    async def _hybrid_search(
        self, 
        query_text: str, 
        space_ids: Optional[List[str]],
        document_ids: Optional[List[str]],
        match_count: int
    ) -> List[Dict[str, Any]]:
        """Call the hybrid_search SQL function."""
        supabase = get_supabase()
        import logging
        logger = logging.getLogger("rag_debugger")
        
        try:
            logger.info(f"Hybrid Search Query: {query_text}")
            logger.info(f"Ref Space IDs: {space_ids}")
            
            # Generate embedding for the query
            embed_res = self.gemini_client.models.embed_content(
                model="gemini-embedding-001",
                contents=query_text,
                config={
                    'task_type': 'RETRIEVAL_QUERY',
                    'output_dimensionality': 768
                }
            )
            query_embedding = embed_res.embeddings[0].values
            
            # Call RPC
            # Ensure empty lists are converted to None for SQL 'IS NULL' check
            effective_space_ids = space_ids if space_ids and len(space_ids) > 0 else None
            effective_doc_ids = document_ids if document_ids and len(document_ids) > 0 else None
            
            rpc_params = {
                "query_text": query_text,
                "query_embedding": list(query_embedding), # Ensure native list
                "match_count": match_count,
                "filter_space_ids": effective_space_ids,
                "filter_document_ids": effective_doc_ids
            }
            
            res = supabase.rpc("hybrid_search", rpc_params).execute()
            logger.info(f"RPC Result count: {len(res.data) if res.data else 0}")
            return res.data or []
        except Exception as e:
            logger.error(f"Hybrid search error for query '{query_text}': {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return []

    def _merge_results(self, all_results: List[List[Dict[str, Any]]], k: int) -> List[Dict[str, Any]]:
        """Merge results from multiple queries and keep the top k by score."""
        scored_chunks = {} # chunk_id -> {chunk_data, max_score}
        
        for result_set in all_results:
            for chunk in result_set:
                chunk_id = chunk["chunk_id"]
                score = chunk["similarity"]
                
                if chunk_id not in scored_chunks or score > scored_chunks[chunk_id]["similarity"]:
                    scored_chunks[chunk_id] = chunk
                    
        # Sort by similarity
        sorted_chunks = sorted(
            scored_chunks.values(), 
            key=lambda x: x["similarity"], 
            reverse=True
        )
        
        return sorted_chunks[:k]

# Global instance
retrieval_service = RetrievalService()
