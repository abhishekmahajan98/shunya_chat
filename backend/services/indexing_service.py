import os
import io
import asyncio
import httpx
from typing import List, Optional
from unstructured_client import UnstructuredClient
from unstructured_client.models import shared, operations
from unstructured_client.models.errors import SDKError
from google import genai
from config import settings
from database import get_supabase
import uuid

class IndexingService:
    """Service to partition documents using Unstructured API and index them in Supabase."""

    def __init__(self):
        self.unstructured_key = settings.UNSTRUCTURED_API_KEY
        self.unstructured_url = settings.UNSTRUCTURED_API_URL
        
        if not self.unstructured_key:
            print("Warning: UNSTRUCTURED_API_KEY not set. Indexing will fail.")
        else:
            print(f"Unstructured Key Loaded: {self.unstructured_key[:4]}...{self.unstructured_key[-4:]}")
            print(f"Unstructured URL: {self.unstructured_url}")
            
        # Create a custom HTTP client with a longer timeout (60s)
        http_client = httpx.Client(timeout=60.0)
        
        # Create a custom HTTP client with a longer timeout (60s)
        http_client = httpx.Client(timeout=60.0)
        
        self.u_client = UnstructuredClient(
            api_key_auth=self.unstructured_key,
            server_url=self.unstructured_url,
            client=http_client
        )
        
        # Initialize Gemini client for embeddings
        self.gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)

    async def index_document(self, document_id: str):
        """Perform full indexing of a document."""
        supabase = get_supabase()
        
        try:
            # 1. Fetch document metadata
            doc_result = supabase.table("documents").select("*").eq("id", document_id).execute()
            if not doc_result.data:
                print(f"Document {document_id} not found.")
                return
            
            doc = doc_result.data[0]
            storage_path = doc["storage_path"]
            filename = doc["name"]
            
            # 2. Download from Supabase Storage
            file_bytes = supabase.storage.from_("documents").download(storage_path)
            
            # 3. Partition via Unstructured API
            elements = self._partition_document(filename, file_bytes)
            
            # 4. Chunk elements (basic semantic grouping by page/section)
            chunks = self._chunk_elements(elements, filename)
            
            # 5. Generate Embeddings & Save to DB
            for chunk in chunks:
                embedding = await self._generate_embedding(chunk["text"])
                
                chunk_data = {
                    "id": str(uuid.uuid4()),
                    "document_id": document_id,
                    "content": chunk["text"],
                    "embedding": embedding,
                    "metadata": chunk["metadata"]
                }
                
                supabase.table("document_chunks").insert(chunk_data).execute()
            
            # 6. Update document status
            supabase.table("documents").update({"status": "completed"}).eq("id", document_id).execute()
            print(f"Indexing completed for document: {doc['name']}")
            
        except Exception as e:
            print(f"Error indexing document {document_id}: {str(e)}")
            supabase.table("documents").update({"status": "error", "metadata": {"error": str(e)}}).eq("id", document_id).execute()

    def _partition_document(self, filename: str, file_bytes: bytes):
        """Call Unstructured API to partition the document."""
        req = operations.PartitionRequest(
            partition_parameters=shared.PartitionParameters(
                files=shared.Files(
                    content=file_bytes,
                    file_name=filename,
                ),
                # General RAG settings
                strategy=shared.Strategy.HI_RES,
                languages=["eng"],
                include_page_breaks=True,
            )
        )

        try:
            res = self.u_client.general.partition(request=req)
            if res.elements is not None:
                return res.elements
            return []
        except SDKError as e:
            raise Exception(f"Unstructured API error: {str(e)}")

    def _chunk_elements(self, elements: List[dict], filename: str) -> List[dict]:
        """Group elements into semantic chunks (e.g. by page or size)."""
        chunks = []
        current_chunk_text = ""
        current_page = 1
        
        for el in elements:
            text = el.get("text", "")
            el_type = el.get("type")
            metadata = el.get("metadata", {})
            page_number = metadata.get("page_number", current_page)
            
            # If we hit a page break or text is getting too long (e.g. > 2000 chars)
            if el_type == "PageBreak" or (len(current_chunk_text) + len(text) > 2000 and current_chunk_text):
                if current_chunk_text.strip():
                    chunks.append({
                        "text": current_chunk_text.strip(),
                        "metadata": {"page_number": current_page, "filename": filename}
                    })
                current_chunk_text = ""
                if el_type != "PageBreak":
                    current_chunk_text = text
                current_page = page_number
            else:
                current_chunk_text += "\n" + text if current_chunk_text else text
                
        # Last chunk
        if current_chunk_text.strip():
            chunks.append({
                "text": current_chunk_text.strip(),
                "metadata": {"page_number": current_page, "filename": filename}
            })
            
        return chunks

    async def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding using Gemini."""
        # Note: genai.Client methods are sync by default in the newer SDK unless using .aio
        # However, .models.embed_content might not have an aio equivalent in all versions.
        # Let's check the SDK docs or try it.
        try:
            # result = await self.gemini_client.aio.models.embed_content(
            #     model="text-embedding-004",
            #     content=text,
            #     config=genai.types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
            # )
            # return result.embeddings[0].values
            
            # For now, use the sync method wrapped in asyncio.to_thread if aio is not stable
            # actually, let's try the direct sync call for now as the provider uses Client
            result = self.gemini_client.models.embed_content(
                model="gemini-embedding-001",
                contents=text,
                config={
                    'task_type': 'RETRIEVAL_DOCUMENT',
                    'output_dimensionality': 768
                }
            )
            return result.embeddings[0].values
        except Exception as e:
            raise Exception(f"Gemini embedding error: {str(e)}")

# Global instance
indexing_service = IndexingService()
