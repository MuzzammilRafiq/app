"""Web Search API Routes"""

from typing import Any
from fastapi import HTTPException, APIRouter
from pydantic import BaseModel

from web_search import web_search, DEFAULT_RESULT_LIMIT
from logger import log_error, log_info

web_search_router = APIRouter()


class WebSearchRequest(BaseModel):
    """Request model for web search."""
    queries: list[str]
    limit_per_query: int = DEFAULT_RESULT_LIMIT


@web_search_router.post("/web/search")
async def search_web(request: WebSearchRequest) -> dict[str, Any]:
    """
    Search the web using SearXNG and scrape results with Crawl4AI.
    
    Returns markdown content for each URL found.
    """
    log_info(f"Received web search request with {len(request.queries)} queries")
    
    try:
        if not request.queries:
            raise HTTPException(status_code=400, detail="At least one query is required")
        
        if request.limit_per_query <= 0:
            raise HTTPException(status_code=400, detail="limit_per_query must be greater than 0")
        
        # Clean empty queries
        queries = [q.strip() for q in request.queries if q.strip()]
        if not queries:
            raise HTTPException(status_code=400, detail="All queries are empty")
        
        result = await web_search(queries, request.limit_per_query)
        
        return {
            "results": result.results,
            "total_results": result.total_results,
            "status": result.status,
            "errors": result.errors if result.errors else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Web search failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Web search failed: {str(e)}"
        )
