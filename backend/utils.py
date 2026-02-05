import base64
import httpx
from typing import Optional, Tuple

async def download_file_as_base64(url: str) -> Optional[Tuple[str, str]]:
    """
    Download a file from a URL and return its base64 string and mime type.
    Returns (base64_string, mime_type) or None if failed.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=30.0)
            response.raise_for_status()
            
            content_type = response.headers.get("content-type", "application/octet-stream")
            base64_str = base64.b64encode(response.content).decode("utf-8")
            
            return base64_str, content_type
    except Exception as e:
        print(f"Error downloading file {url}: {e}")
        return None
