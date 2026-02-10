from typing import List, Optional, Dict, Any
import logging
from services.retrieval_service import retrieval_service

logger = logging.getLogger("rag_debugger")

async def get_rag_context(
    content: str,
    selected_spaces: Optional[List[str]],
    selected_documents: Optional[List[str]]
) -> tuple[str, List[Dict[str, Any]]]:
    """
    Retrieve RAG context for a given query and set of spaces/documents.
    Returns (context_str, raw_chunks).
    """
    context_str = ""
    chunks = []
    if selected_spaces or selected_documents:
        logger.info("Attempting retrieval via rag_utils...")
        try:
            # Perform SOTA Retrieval
            chunks = await retrieval_service.retrieve_context(
                query=content,
                space_ids=selected_spaces,
                document_ids=selected_documents,
                k=5
            )
            
            logger.info(f"Retrieval returned {len(chunks) if chunks else 0} chunks")
            
            if chunks:
                context_parts = []
                for i, chunk in enumerate(chunks):
                    meta = chunk.get("metadata", {})
                    doc_name = meta.get("filename") or "Unknown Document"
                    page = meta.get("page_number", "?")
                    
                    # More structured context block
                    context_parts.append(
                        f"--- SOURCE [{i+1}] ---\n"
                        f"Document: {doc_name}\n"
                        f"Page: {page}\n"
                        f"Content:\n{chunk['content']}"
                    )
                
                context_str = "\n\n".join(context_parts)
        except Exception as e:
            logger.error(f"RAG Retrieval failed: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            
    return context_str, chunks

def format_rag_prompt(context_str: str) -> str:
    """Format the system prompt with the retrieved context."""
    if not context_str:
        return ""
        
    return (
        "You are an assistant with access to the user's uploaded documents. "
        "When answering, prioritize the provided context and ALWAYS cite sources using the [id] notation (e.g., [1]). "
        "If the answer is NOT in the context, you may use your general knowledge, but you MUST explicitly state that the information was NOT found in the documents. "
        "CRITICAL: Never hallucinate that an outside fact exists within the provided context."
        f"\n\nCONTEXT:\n{context_str}"
    )
