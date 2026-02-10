"""
Authentication Router.
Handles user signup, login, logout using Supabase Auth.
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
from typing import Optional
from database import get_supabase
import uuid
import uuid

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user_id: str
    email: str
    access_token: str
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Extract and validate user from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    supabase = get_supabase()
    
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {
            "id": user_response.user.id,
            "email": user_response.user.email,
            "name": user_response.user.user_metadata.get("name"),
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/signup", response_model=AuthResponse)
async def signup(request: SignupRequest):
    """Create a new user account."""
    supabase = get_supabase()
    
    try:
        # Sign up with Supabase Auth
        response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {"name": request.name} if request.name else {}
            }
        })
        
        if response.user is None:
            raise HTTPException(status_code=400, detail="Signup failed")
        
        if response.session is None:
            # Email confirmation required
            raise HTTPException(
                status_code=200, 
                detail="Please check your email to confirm your account"
            )
        
        # Create default "Personal Space" for the new user
        try:
            space_id = str(uuid.uuid4())
            new_space = {
                "id": space_id,
                "name": "Personal Space",
                "description": "Your private space for documents",
                "owner_id": response.user.id,
                "is_public": False,
                "type": "personal",
                "metadata": {"type": "personal"}
            }
            supabase.table("spaces").insert(new_space).execute()
        except Exception as space_err:
            # We don't want to fail signup if space creation fails, 
            # but we should log it. List endpoint has lazy-init fallback.
            print(f"Failed to create personal space for new user: {str(space_err)}")

        return AuthResponse(
            user_id=response.user.id,
            email=response.user.email,
            access_token=response.session.access_token,
            refresh_token=response.session.refresh_token,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Log in with email and password."""
    supabase = get_supabase()
    
    try:
        response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })
        
        if response.user is None or response.session is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        return AuthResponse(
            user_id=response.user.id,
            email=response.user.email,
            access_token=response.session.access_token,
            refresh_token=response.session.refresh_token,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    """Log out the current user."""
    if not authorization or not authorization.startswith("Bearer "):
        return {"status": "logged_out"}
    
    supabase = get_supabase()
    
    try:
        supabase.auth.sign_out()
    except Exception:
        pass  # Ignore errors during logout
    
    return {"status": "logged_out"}


@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    """Get current authenticated user."""
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name"),
    )
