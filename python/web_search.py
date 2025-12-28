"""
Web Search Module using SearXNG and Crawl4AI

This module provides web search functionality for RAG applications.
- Uses SearXNG to search and get top URLs
- Uses Crawl4AI to scrape and convert pages to markdown
"""

import asyncio
import re
from typing import Any
from dataclasses import dataclass, field, asdict

import httpx
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

from logger import log_error, log_info, log_success, log_warning


def clean_markdown(markdown: str) -> str:
    """
    Clean markdown content by removing navigation elements, images, 
    excessive links, and other boilerplate.
    
    Args:
        markdown: Raw markdown string from crawler
        
    Returns:
        Cleaned markdown string with meaningful content only
    """
    if not markdown:
        return ""
    
    text = markdown
    
    # Remove image references: ![alt](url) or ![alt]
    text = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', text)
    text = re.sub(r'!\[[^\]]*\]', '', text)
    
    # Remove inline links but keep the text: [text](url) -> text
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)
    
    # Remove reference-style link definitions: [text]: url
    text = re.sub(r'^\[[^\]]+\]:\s*\S+.*$', '', text, flags=re.MULTILINE)
    
    # Remove HTML comments
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    
    # Remove common navigation/boilerplate patterns
    boilerplate_patterns = [
        r'Skip to (?:content|main|navigation).*?\n',
        r'(?:▲|▼)\s*(?:Back to Top|Close|Menu).*?\n',
        r'^\s*\* \* \*\s*$',  # Horizontal rule made of asterisks in list
        r'Copyright ©.*?\n',
        r'All [Rr]ights [Rr]eserved.*?\n',
        r'Privacy Policy.*?\n',
        r'Terms of Service.*?\n',
        r'Cookie Policy.*?\n',
        r'(?:Follow|Connect with) us on.*?\n',
        r'Share (?:this|on).*?\n',
        r'Subscribe to.*?\n',
        r'Sign up for.*?\n',
        r'Newsletter.*?\n',
        r'^\s*Menu\s*$',
        r'^\s*Search\s*$',
        r'^\s*GO\s*$',
        r'^\s*×\s*$',  # Close button
        r'^\s*≡\s*$',  # Hamburger menu
    ]
    
    for pattern in boilerplate_patterns:
        text = re.sub(pattern, '', text, flags=re.MULTILINE | re.IGNORECASE)
    
    # Remove lines that are just bullet points with single short words (navigation)
    # Matches lines like "  * About" or "  * Home" etc
    text = re.sub(r'^\s*[\*\-]\s*\w{1,15}\s*$', '', text, flags=re.MULTILINE)
    
    # Remove lines that are just numbers (pagination like "1 2 3 4 5")
    text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)
    
    # Remove empty bullet points
    text = re.sub(r'^\s*[\*\-\+]\s*$', '', text, flags=re.MULTILINE)
    
    # Remove excessive blank lines (more than 2 consecutive)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Remove lines that are just whitespace
    text = re.sub(r'^\s+$', '', text, flags=re.MULTILINE)
    
    # Remove leading/trailing whitespace from each line
    lines = text.split('\n')
    lines = [line.strip() for line in lines]
    text = '\n'.join(lines)
    
    # Final cleanup of excessive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()

# Configuration
SEARXNG_BASE_URL = "http://localhost:8888"
DEFAULT_RESULT_LIMIT = 7


@dataclass
class SearchResult:
    """Represents a single search result with scraped content."""
    url: str
    title: str
    markdown: str
    success: bool = True
    error: str | None = None


@dataclass
class WebSearchResponse:
    """Response from web search operation."""
    results: list[dict[str, Any]] = field(default_factory=list)
    total_results: int = 0
    status: str = "success"
    errors: list[str] = field(default_factory=list)


async def search_searxng(query: str, limit: int = DEFAULT_RESULT_LIMIT) -> list[dict[str, str]]:
    """
    Query SearXNG instance and return top URLs.
    
    Args:
        query: The search query string
        limit: Maximum number of results to return (default: 7)
    
    Returns:
        List of dicts with 'url' and 'title' keys
    """
    log_info(f"Searching SearXNG for: '{query}' (limit: {limit})")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                f"{SEARXNG_BASE_URL}/search",
                params={
                    "q": query,
                    "format": "json",
                }
            )
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("results", [])[:limit]:
                results.append({
                    "url": item.get("url", ""),
                    "title": item.get("title", "Untitled"),
                })
            
            log_success(f"Found {len(results)} results from SearXNG")
            return results
            
        except httpx.HTTPStatusError as e:
            log_error(f"SearXNG HTTP error: {e.response.status_code}")
            raise
        except httpx.RequestError as e:
            log_error(f"SearXNG request failed: {e}")
            raise
        except Exception as e:
            log_error(f"SearXNG search error: {e}")
            raise


async def crawl_urls(urls: list[str]) -> list[SearchResult]:
    """
    Crawl multiple URLs and extract markdown content.
    
    Args:
        urls: List of URLs to crawl
    
    Returns:
        List of SearchResult objects with markdown content
    """
    if not urls:
        return []
    
    log_info(f"Crawling {len(urls)} URLs with Crawl4AI")
    
    browser_config = BrowserConfig(headless=True)
    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        stream=False
    )
    
    results = []
    
    async with AsyncWebCrawler(config=browser_config) as crawler:
        try:
            crawl_results = await crawler.arun_many(urls, config=run_config)
            
            for result in crawl_results:
                if result.success:
                    markdown_content = ""
                    if hasattr(result, 'markdown'):
                        if hasattr(result.markdown, 'raw_markdown'):
                            markdown_content = result.markdown.raw_markdown
                        elif isinstance(result.markdown, str):
                            markdown_content = result.markdown
                    
                    # Clean the markdown to remove navigation, images, and boilerplate
                    cleaned_content = clean_markdown(markdown_content)
                    
                    results.append(SearchResult(
                        url=result.url,
                        title=getattr(result, 'title', 'Untitled') or 'Untitled',
                        markdown=cleaned_content,
                        success=True
                    ))
                    log_success(f"Crawled: {result.url[:50]}...")
                else:
                    results.append(SearchResult(
                        url=result.url,
                        title="Error",
                        markdown="",
                        success=False,
                        error=result.error_message
                    ))
                    log_warning(f"Failed to crawl: {result.url} - {result.error_message}")
                    
        except Exception as e:
            log_error(f"Crawl4AI error: {e}")
            # Return partial results if we have any
            
    log_info(f"Successfully crawled {sum(1 for r in results if r.success)}/{len(urls)} URLs")
    return results


async def web_search(queries: list[str], limit_per_query: int = DEFAULT_RESULT_LIMIT) -> WebSearchResponse:
    """
    Perform web search for multiple queries and return scraped markdown content.
    
    Args:
        queries: List of search queries
        limit_per_query: Max results per query (default: 7)
    
    Returns:
        WebSearchResponse with scraped results
    """
    log_info(f"Starting web search for {len(queries)} queries")
    
    response = WebSearchResponse()
    all_urls: dict[str, str] = {}  # url -> title mapping to dedupe
    
    # Step 1: Search SearXNG for each query
    for query in queries:
        try:
            search_results = await search_searxng(query, limit_per_query)
            for item in search_results:
                url = item["url"]
                if url and url not in all_urls:
                    all_urls[url] = item["title"]
        except Exception as e:
            response.errors.append(f"Search failed for '{query}': {str(e)}")
            log_error(f"Search failed for query '{query}': {e}")
    
    if not all_urls:
        response.status = "error"
        response.errors.append("No URLs found from search")
        return response
    
    log_info(f"Collected {len(all_urls)} unique URLs to crawl")
    
    # Step 2: Crawl all URLs
    url_list = list(all_urls.keys())
    crawl_results = await crawl_urls(url_list)
    
    # Step 3: Build response
    for result in crawl_results:
        if result.success:
            response.results.append(asdict(result))
        else:
            response.errors.append(f"Crawl failed for {result.url}: {result.error}")
    
    response.total_results = len(response.results)
    
    if response.total_results == 0:
        response.status = "error"
    elif response.errors:
        response.status = "partial"
    
    log_success(f"Web search complete: {response.total_results} results")
    return response
