# API Reference

Python backend API documentation (FastAPI on `http://localhost:8000`).

---

## Health Check

### GET /
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "embedding",
  "version": "1.0.0"
}
```

### GET /help
Returns comprehensive API documentation.

---

## Image Embeddings

### POST /image/scan-folder
Scan a folder and add images to the embedding database.

**Request Body:**
```json
{
  "folder_path": "/path/to/images",
  "batch_size": 100
}
```

**Response:**
```json
{
  "total_found": 150,
  "total_added": 145,
  "errors": ["file1.png: corrupted"]
}
```

### POST /image/query
Query images using text search.

**Request Body:**
```json
{
  "query_text": "sunset over mountains",
  "n_results": 10
}
```

**Response:**
```json
["/path/to/image1.jpg", "/path/to/image2.png"]
```

### DELETE /image/delete-all
Delete all images from the database.

### DELETE /image/delete-folder
Delete images from a specific folder.

**Request Body:**
```json
{
  "folder_path": "/path/to/images"
}
```

---

## Text Embeddings

### POST /text/scan-folder
Scan a folder and add text documents to the embedding database.

**Request Body:**
```json
{
  "folder_path": "/path/to/documents",
  "batch_size": 100
}
```

### POST /text/query
Query text documents using semantic search.

**Request Body:**
```json
{
  "query_text": "machine learning algorithms",
  "n_results": 10
}
```

**Response:**
```json
{
  "results": [...],
  "count": 10
}
```

### DELETE /text/delete-all
Delete all text documents from the database.

### DELETE /text/delete-folder
Delete documents from a specific folder.

---

## Web Search

### POST /web/search
Search the web and return scraped markdown content.

**Request Body:**
```json
{
  "queries": ["latest AI news", "machine learning trends"],
  "limit_per_query": 5
}
```

**Response:**
```json
{
  "results": [
    {
      "url": "https://example.com/article",
      "title": "AI News Today",
      "markdown": "# Article content...",
      "success": true
    }
  ],
  "total_results": 8,
  "status": "success",
  "errors": null
}
```

---

## Automation

### POST /mouse/move
Move the mouse to specified coordinates.

**Request Body:**
```json
{
  "x": 500,
  "y": 300,
  "duration_ms": 100,
  "delay_ms": 0
}
```

**Response:**
```json
{
  "status": "ok",
  "x": 500,
  "y": 300
}
```

### POST /mouse/click
Perform a mouse click at current position.

**Request Body:**
```json
{
  "button": "left",
  "clicks": 1,
  "delay_ms": 0
}
```

### POST /keyboard/type
Type the specified text.

**Request Body:**
```json
{
  "text": "Hello, world!",
  "interval_ms": 10,
  "delay_ms": 0
}
```

**Response:**
```json
{
  "status": "ok",
  "typed_length": 13
}
```

### POST /keyboard/press
Press a single key.

**Request Body:**
```json
{
  "key": "enter",
  "delay_ms": 0
}
```

### GET /screenshot
Capture a full-screen screenshot.

**Query Parameters:**
- `save_image` (bool): If true, saves to disk and returns path

**Response (save_image=false):** Binary PNG image

**Response (save_image=true):**
```json
{
  "screen_size": {"width": 2560, "height": 1440},
  "file_path": "/path/to/screenshot.png",
  "base64": "iVBORw0KGgo..."
}
```

### GET /screenshot/grid
Capture screenshot split into 9 rectangles (3x3 grid).

**Query Parameters:**
- `save_image` (bool): Save images locally

**Response:**
```json
{
  "screen_size": {"width": 2560, "height": 1440},
  "rectangles": [
    {
      "name": "top_left",
      "top_left": {"x": 0, "y": 0},
      "bottom_right": {"x": 853, "y": 480},
      "image_base64": "iVBORw0..."
    }
  ]
}
```

### GET /screenshot/numbered-grid
Capture screenshot with numbered grid overlay.

**Query Parameters:**
- `grid_size` (int, 2-10): Grid dimension (default: 3)
- `save_image` (bool): Save images locally

**Response:**
```json
{
  "image_size": {"width": 5120, "height": 2880},
  "screen_size": {"width": 2560, "height": 1440},
  "scale_factor": 2.0,
  "grid_size": 6,
  "total_cells": 36,
  "original_image_base64": "...",
  "grid_image_base64": "..."
}
```

### POST /image/numbered-grid
Upload an image and create numbered grid overlay.

**Form Data:**
- `image`: Image file (PNG, JPG, etc.)

**Query Parameters:**
- `grid_size` (int): Grid dimension
- `save_image` (bool): Save locally

### POST /image/crop-cell
Crop a specific cell from an image.

**Form Data:**
- `image`: Image file

**Query Parameters:**
- `cell_number` (int): Cell to crop (1-based)
- `grid_size` (int): Original grid size
- `create_sub_grid` (bool): Overlay new grid on cropped cell
- `sub_grid_size` (int): Sub-grid dimension
- `save_image` (bool): Save locally

**Response:**
```json
{
  "cell_bounds": {"x1": 0, "y1": 0, "x2": 853, "y2": 480, "width": 853, "height": 480},
  "original_size": {"width": 5120, "height": 2880},
  "cropped_size": {"width": 853, "height": 480},
  "cropped_image_base64": "...",
  "clean_cropped_image_base64": "...",
  "sub_grid_size": 6
}
```

### GET /grid/cell-center
Calculate center coordinates of a grid cell.

**Query Parameters:**
- `width` (int): Image width
- `height` (int): Image height
- `grid_size` (int): Grid dimension
- `cell_number` (int): Cell number (1-based)
- `offset_x` (int): X offset for nested cells
- `offset_y` (int): Y offset for nested cells

**Response:**
```json
{
  "x": 426,
  "y": 240
}
```

### POST /sleep
Block execution for specified duration.

**Request Body:**
```json
{
  "duration_ms": 1000
}
```

---

## Error Handling

All endpoints return standard HTTP error codes:

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 500 | Internal Server Error |

Error response format:
```json
{
  "detail": "Error description"
}
```
