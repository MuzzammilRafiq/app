from typing import Dict, Any, List
import uvicorn
from fastapi import FastAPI, HTTPException
from pillow_heif import register_heif_opener
from pydantic import BaseModel
import constants as C
from image import imageCHroma
from text import textChroma
from logger import log_error, log_success, log_info, log_warning

register_heif_opener()
app = FastAPI()


class AddRequest(BaseModel):
    folder_path: str
    batch_size: int = C.DEFAULT_BATCH_SIZE


class QueryRequest(BaseModel):
    query_text: str
    n_results: int = C.DEFAULT_N_RESULTS


@app.get("/")
async def health_check() -> Dict[str, str]:
    return {"status": "healthy", "service": "embedding", "version": "1.0.0"}


@app.post("/images/scan-folder")
async def add_images_from_folder(request: AddRequest) -> Dict[str, Any]:
    log_info(f"Received request to add images from folder: {request.folder_path}")
    try:
        if not request.folder_path.strip():
            log_warning("Received request with empty folder path.")
            raise HTTPException(status_code=400, detail="Folder path cannot be empty")

        if request.batch_size <= 0:
            log_warning(f"Invalid batch size: {request.batch_size}")
            raise HTTPException(
                status_code=400, detail="Batch size must be greater than 0"
            )

        result = imageCHroma.add_images_from_folder_recursively(
            request.folder_path, request.batch_size
        )

        log_success(
            f"Successfully processed folder {request.folder_path}: "
            f"{result['total_added']}/{result['total_found']} images added"
        )

        return result

    except ValueError as ve:
        log_error(
            f"ValueError while adding images from folder {request.folder_path}: {ve}"
        )
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        log_error(
            f"An unexpected error occurred while adding images from folder {request.folder_path}"
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


@app.post("/images/query")
async def query_images(request: QueryRequest) -> List[str]:
    log_info(
        f"Received query request: '{request.query_text[:50]}...' with n_results={request.n_results}"
    )

    try:
        if not request.query_text.strip():
            log_warning("Received request with empty query text.")
            raise HTTPException(status_code=400, detail="Query text cannot be empty")

        if request.n_results <= 0:
            log_warning(f"Invalid n_results: {request.n_results}")
            raise HTTPException(
                status_code=400, detail="n_results must be greater than 0"
            )
        return imageCHroma.READ(request.query_text, request.n_results)

    except HTTPException:
        raise
    except Exception as e:
        log_error(
            f"An unexpected error occurred while querying images with text: '{request.query_text[:50]}...'"
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


@app.delete("/images/delete-all")
async def delete_all_images() -> Dict[str, Any]:
    log_info("Received request to delete all images from database")

    try:
        result = imageCHroma.DELETE_ALL()
        log_success(f"Successfully deleted images: {result}")

        return {
            "message": f"Successfully deleted {result['deleted_count']} images from database",
            "deleted_count": result["deleted_count"],
            "status": result["status"],
        }

    except Exception as e:
        log_error(
            "An unexpected error occurred while deleting all images from database"
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )

@app.post("/text/scan-folder")
async def add_text_from_folder(request: AddRequest) -> Dict[str, Any]:
    log_info(f"Received request to add text from folder: {request.folder_path}")
    try:
        if not request.folder_path.strip():
            log_warning("Received request with empty folder path.")
            raise HTTPException(status_code=400, detail="Folder path cannot be empty")
        if request.batch_size <= 0:
            log_warning(f"Invalid batch size: {request.batch_size}")
            raise HTTPException(
                status_code=400, detail="Batch size must be greater than 0"
            )
        result = textChroma.add_text_from_folder_recursively(
            request.folder_path, request.batch_size
        )
        return result
    except ValueError as ve:
        log_error(
            f"ValueError while adding text from folder {request.folder_path}: {ve}"
        )
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        log_error(
            f"An unexpected error occurred while adding text from folder {request.folder_path}"
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


@app.post("/text/query")
async def query_text(request: QueryRequest) ->Dict[str, Any]:
    log_info(
        f"Received query request: '{request.query_text[:50]}...' with n_results={request.n_results}"
    )

    try:
        if not request.query_text.strip():
            log_warning("Received request with empty query text.")
            raise HTTPException(status_code=400, detail="Query text cannot be empty")

        if request.n_results <= 0:
            log_warning(f"Invalid n_results: {request.n_results}")
            raise HTTPException(
                status_code=400, detail="n_results must be greater than 0"
            )
        return textChroma.READ(request.query_text, request.n_results)

    except HTTPException:
        raise
    except Exception as e:
        log_error(
            f"An unexpected error occurred while querying text with text: '{request.query_text[:50]}...'"
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )

@app.post("/text/delete-all")
async def delete_all_text() -> Dict[str, Any]:
    log_info("Received request to delete all text from database")

    try:
        result = textChroma.DELETE_ALL()
        log_success(f"Successfully deleted text: {result}")

        return {
            "message": f"Successfully deleted {result['deleted_count']} text from database",
            "deleted_count": result["deleted_count"],
            "status": result["status"],
        }

    except Exception as e:
        log_error(
            "An unexpected error occurred while deleting all text from database"
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run(app)