from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from typing import Optional, List
from database import get_supabase
from models import (
    SpaceCreate, SpaceResponse, SpaceDetail, 
    DocumentResponse, FolderCreate
)
from routers.auth import get_current_user
from services.indexing_service import indexing_service
import uuid
import os

router = APIRouter(prefix="/api/spaces", tags=["spaces"])

async def index_document_task(document_id: str):
    """Background task to index a document."""
    await indexing_service.index_document(document_id)

@router.post("", response_model=SpaceResponse)
async def create_space(request: SpaceCreate, user: dict = Depends(get_current_user)):
    """Create a new space."""
    supabase = get_supabase()
    
    space_id = str(uuid.uuid4())
    space_data = {
        "id": space_id,
        "name": request.name,
        "description": request.description,
        "owner_id": user["id"],
        "is_public": request.is_public,
        "type": request.type,
    }
    
    result = supabase.table("spaces").insert(space_data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create space")
    
    return result.data[0]


@router.get("", response_model=List[SpaceResponse])
async def list_spaces(user: dict = Depends(get_current_user)):
    """List all spaces owned by or shared with the user."""
    supabase = get_supabase()
    
    # List spaces owned by the user, shared with the user, or public shared spaces
    # NOTE: Personal spaces are NEVER public.
    result = supabase.table("spaces")\
        .select("*")\
        .or_(f"owner_id.eq.{user['id']},and(is_public.eq.true,type.eq.shared)")\
        .execute()
    
    # If user has no personal space, create one
    personal_space = next((s for s in result.data if s.get("type") == "personal"), None)
    
    if not personal_space:
        space_id = str(uuid.uuid4())
        new_space = {
            "id": space_id,
            "name": "Personal Space",
            "description": "Your private space for documents",
            "owner_id": user["id"],
            "is_public": False,
            "type": "personal",
            "metadata": {"type": "personal"}
        }
        insert_result = supabase.table("spaces").insert(new_space).execute()
        if insert_result.data:
            # Add to the list we return
            result.data.append(insert_result.data[0])
    
    return result.data


@router.get("/{space_id}", response_model=SpaceDetail)
async def get_space(space_id: str, user: dict = Depends(get_current_user)):
    """Get space details including documents."""
    supabase = get_supabase()
    
    # Verify access
    space_result = supabase.table("spaces").select("*").eq("id", space_id).execute()
    if not space_result.data:
        raise HTTPException(status_code=404, detail="Space not found")
    
    space = space_result.data[0]
    if space["owner_id"] != user["id"] and not space["is_public"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Fetch documents
    docs_result = supabase.table("documents").select("*").eq("space_id", space_id).execute()
    space["documents"] = docs_result.data
    
    return space


@router.delete("/{space_id}")
async def delete_space(space_id: str, user: dict = Depends(get_current_user)):
    """Delete a space and all its documents."""
    supabase = get_supabase()
    
    # Verify owner
    space_result = supabase.table("spaces").select("owner_id").eq("id", space_id).execute()
    if not space_result.data:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if space_result.data[0]["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only owners can delete spaces")
    
    # Delete documents from storage first (TODO: Implement storage cleanup)
    # Docs will be cascade deleted from DB
    supabase.table("spaces").delete().eq("id", space_id).execute()
    
    return {"status": "deleted"}


@router.post("/{space_id}/upload", response_model=DocumentResponse)
async def upload_document(
    space_id: str, 
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    parent_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Upload a document to a space and trigger indexing."""
    supabase = get_supabase()
    
    # Verify access
    space_result = supabase.table("spaces").select("owner_id").eq("id", space_id).execute()
    if not space_result.data:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if space_result.data[0]["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # 1. Upload to Supabase Storage
    file_content = await file.read()
    file_ext = os.path.splitext(file.filename)[1]
    storage_path = f"{space_id}/{uuid.uuid4()}{file_ext}"
    
    try:
        # Note: Using bucket "documents"
        storage_result = supabase.storage.from_("documents").upload(
            storage_path, 
            file_content,
            {"content-type": file.content_type}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(e)}")
    
    # 2. Record in DB
    doc_data = {
        "id": str(uuid.uuid4()),
        "space_id": space_id,
        "parent_id": parent_id,
        "name": file.filename,
        "type": "document",
        "storage_path": storage_path,
        "mime_type": file.content_type,
        "size_bytes": len(file_content),
        "status": "processing"
    }
    
    db_result = supabase.table("documents").insert(doc_data).execute()
    if not db_result.data:
        raise HTTPException(status_code=500, detail="Failed to record document in DB")
    
    # 3. Trigger Indexing in background
    background_tasks.add_task(index_document_task, db_result.data[0]["id"])
    
    return db_result.data[0]


    return db_result.data[0]


@router.post("/{space_id}/folders", response_model=DocumentResponse)
async def create_folder(
    space_id: str,
    request: FolderCreate,
    user: dict = Depends(get_current_user)
):
    """Create a folder in a space."""
    supabase = get_supabase()
    
    # Verify access
    space_result = supabase.table("spaces").select("owner_id").eq("id", space_id).execute()
    if not space_result.data:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if space_result.data[0]["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    doc_data = {
        "id": str(uuid.uuid4()),
        "space_id": space_id,
        "parent_id": request.parent_id,
        "name": request.name,
        "type": "folder",
        "status": "completed"
    }
    
    try:
        db_result = supabase.table("documents").insert(doc_data).execute()
        
        # Check for error in response if execute doesn't raise
        if hasattr(db_result, 'error') and db_result.error:
            raise Exception(str(db_result.error))
            
        if not db_result.data:
            raise Exception("No data returned from database")
            
        return db_result.data[0]
        
    except Exception as e:
        error_str = str(e)
        print(f"Folder creation failed: {error_str}")
        
        # Check for specific schema errors to give better guidance
        if "type" in error_str or "parent_id" in error_str:
            raise HTTPException(
                status_code=500, 
                detail="Folder creation failed due to missing database columns. Please run the migration script: backend/sql/06_fix_documents_schema.sql"
            )
            
        raise HTTPException(status_code=500, detail=f"Failed to create folder: {error_str}")


@router.delete("/{space_id}/documents/{document_id}")
async def delete_document(
    space_id: str,
    document_id: str,
    user: dict = Depends(get_current_user)
):
    """Delete a document or folder."""
    supabase = get_supabase()
    
    # Verify access
    space_result = supabase.table("spaces").select("owner_id").eq("id", space_id).execute()
    if not space_result.data:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if space_result.data[0]["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get document info for storage cleanup
    try:
        doc_result = supabase.table("documents").select("*").eq("id", document_id).execute()
        if not doc_result.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        doc = doc_result.data[0]
        doc_type = doc.get("type", "document") # Fallback if column is missing/null
        
        # Recursive cleanup of storage for all nested files if it's a folder
        if doc_type == "folder":
            nested_docs = supabase.table("documents").select("storage_path").eq("parent_id", document_id).execute()
            if nested_docs.data:
                for nd in nested_docs.data:
                    if nd.get("storage_path"):
                        try:
                            supabase.storage.from_("documents").remove([nd["storage_path"]])
                        except Exception as e:
                            print(f"Warning: Failed to cleanup storage for nested file {nd.get('storage_path')}: {e}")
        elif doc.get("storage_path"):
            try:
                supabase.storage.from_("documents").remove([doc["storage_path"]])
            except Exception as e:
                print(f"Warning: Failed to cleanup storage for file {doc.get('storage_path')}: {e}")
                
        # Delete from DB (CASCADE handles children)
        del_result = supabase.table("documents").delete().eq("id", document_id).execute()
        
        # Check for error in response if execute doesn't raise
        if hasattr(del_result, 'error') and del_result.error:
            raise Exception(str(del_result.error))
            
    except Exception as e:
        print(f"Delete operation failed for {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
    
    return {"status": "success"}
