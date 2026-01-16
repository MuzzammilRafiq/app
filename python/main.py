import uvicorn
from fastapi import FastAPI
from pillow_heif import register_heif_opener
from routes import image_router, text_router, web_search_router, automation_router


register_heif_opener()

# -------------routes--------------------
app = FastAPI()


@app.get("/")
async def health_check():
    return {"status": "healthy", "service": "embedding", "version": "1.0.0"}


app.include_router(image_router)
app.include_router(text_router)
app.include_router(web_search_router)
app.include_router(automation_router)


@app.get("/help")
async def help_routes():
    """Comprehensive API documentation for all available routes."""
    return {
        "service": "Embedding & Automation API",
        "version": "1.0.0",
        "routes": {
            "health": {
                "GET /": {
                    "description": "Health check endpoint",
                    "expects": "No parameters",
                    "returns": {
                        "status": "string",
                        "service": "string",
                        "version": "string",
                    },
                }
            },
            "image": {
                "POST /image/scan-folder": {
                    "description": "Scan and add images from a folder to the database",
                    "expects": {
                        "folder_path": "string (required) - Path to the folder containing images",
                        "batch_size": "int (optional, default: 100) - Number of images to process in each batch",
                    },
                    "returns": {
                        "total_found": "int - Total images found",
                        "total_added": "int - Total images added to database",
                        "errors": "list - Any errors encountered during processing",
                    },
                },
                "POST /image/query": {
                    "description": "Query images using text search",
                    "expects": {
                        "query_text": "string (required) - Text query to search for similar images",
                        "n_results": "int (optional, default: 10) - Number of results to return",
                    },
                    "returns": "list[string] - List of image file paths matching the query",
                },
                "DELETE /image/delete-all": {
                    "description": "Delete all images from the database",
                    "expects": "No parameters",
                    "returns": {"message": "string", "status": "string"},
                },
                "DELETE /image/delete-folder": {
                    "description": "Delete all images from a specific folder",
                    "expects": {
                        "folder_path": "string (required) - Path to the folder to delete"
                    },
                    "returns": {
                        "message": "string",
                        "deleted_count": "int - Number of images deleted",
                        "status": "string",
                    },
                },
            },
            "text": {
                "POST /text/scan-folder": {
                    "description": "Scan and add text documents from a folder to the database",
                    "expects": {
                        "folder_path": "string (required) - Path to the folder containing text documents",
                        "batch_size": "int (optional, default: 100) - Number of documents to process in each batch",
                    },
                    "returns": {
                        "total_found": "int - Total documents found",
                        "total_added": "int - Total documents added to database",
                        "errors": "list - Any errors encountered during processing",
                    },
                },
                "POST /text/query": {
                    "description": "Query text documents using text search",
                    "expects": {
                        "query_text": "string (required) - Text query to search for similar documents",
                        "n_results": "int (optional, default: 10) - Number of results to return",
                    },
                    "returns": {
                        "results": "list - Matching text chunks with metadata",
                        "count": "int - Number of results returned",
                    },
                },
                "DELETE /text/delete-all": {
                    "description": "Delete all text documents from the database",
                    "expects": "No parameters",
                    "returns": {"message": "string", "status": "string"},
                },
                "DELETE /text/delete-folder": {
                    "description": "Delete all text documents from a specific folder",
                    "expects": {
                        "folder_path": "string (required) - Path to the folder to delete"
                    },
                    "returns": {
                        "message": "string",
                        "deleted_count": "int - Number of documents deleted",
                        "status": "string",
                    },
                },
            },
            "web_search": {
                "POST /web/search": {
                    "description": "Search the web using SearXNG and scrape results with Crawl4AI",
                    "expects": {
                        "queries": "list[string] (required) - List of search queries",
                        "limit_per_query": "int (optional, default: 5) - Number of results per query",
                    },
                    "returns": {
                        "results": "list - Search results with markdown content",
                        "total_results": "int - Total number of results",
                        "status": "string",
                        "errors": "list|null - Any errors encountered",
                    },
                }
            },
            "automation": {
                "POST /mouse/move": {
                    "description": "Move the mouse to specified coordinates",
                    "expects": {
                        "x": "int (required) - X coordinate",
                        "y": "int (required) - Y coordinate",
                        "duration_ms": "int (optional) - Duration of movement in milliseconds",
                        "delay_ms": "int (optional, default: 0) - Delay before executing action",
                    },
                    "returns": {"status": "string", "x": "int", "y": "int"},
                },
                "POST /mouse/click": {
                    "description": "Perform a mouse click at the current position",
                    "expects": {
                        "button": "string (optional, default: 'left') - Button to click: 'left', 'right', or 'middle'",
                        "clicks": "int (optional, default: 1) - Number of clicks",
                        "delay_ms": "int (optional, default: 0) - Delay before executing action",
                    },
                    "returns": {
                        "status": "string",
                        "button": "string",
                        "clicks": "int",
                    },
                },
                "POST /mouse/scroll": {
                    "description": "Scroll the mouse wheel",
                    "expects": {
                        "delta_x": "int (optional, default: 0) - Horizontal scroll (not supported)",
                        "delta_y": "int (required) - Vertical scroll amount in pixels (positive=down, negative=up)",
                        "duration_ms": "int (optional, default: 100) - Duration of scroll",
                        "delay_ms": "int (optional, default: 0) - Delay before executing action",
                    },
                    "returns": {
                        "status": "string",
                        "delta_y": "int",
                        "scroll_clicks": "int",
                    },
                },
                "POST /keyboard/type": {
                    "description": "Type the specified text",
                    "expects": {
                        "text": "string (required) - Text to type",
                        "interval_ms": "int (optional) - Interval between keystrokes in milliseconds",
                        "delay_ms": "int (optional, default: 0) - Delay before executing action",
                    },
                    "returns": {
                        "status": "string",
                        "typed_length": "int - Number of characters typed",
                    },
                },
                "POST /keyboard/press": {
                    "description": "Press a single key",
                    "expects": {
                        "key": "string (required) - Key to press",
                        "delay_ms": "int (optional, default: 0) - Delay before executing action",
                    },
                    "returns": {"status": "string", "key": "string"},
                },
                "GET /screenshot": {
                    "description": "Capture a full-screen screenshot and return as PNG",
                    "expects": "No parameters",
                    "returns": "Binary PNG image",
                },
                "GET /screenshot/grid": {
                    "description": "Capture a screenshot and split it into a 3x3 grid",
                    "expects": {
                        "save_image": "bool (optional, default: false) - Save images locally or return base64"
                    },
                    "returns": {
                        "screen_size": "object - Screen dimensions",
                        "rectangles": "list - 9 rectangles with coordinates and image data",
                    },
                },
                "POST /sleep": {
                    "description": "Block execution for the specified duration",
                    "expects": {
                        "duration_ms": "int (required) - Duration to sleep in milliseconds"
                    },
                    "returns": {"status": "string", "slept_ms": "int"},
                },
            },
        },
        "notes": {
            "base_url": "All routes are relative to the API base URL",
            "content_type": "All POST requests expect JSON content-type",
            "error_handling": "All routes return standard HTTP error codes (400, 500) with error details",
        },
    }


# -------------routes--------------------

if __name__ == "__main__":
    uvicorn.run(app)
