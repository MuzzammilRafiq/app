from typing import Dict, Any, List
from fastapi import HTTPException,APIRouter
from pydantic import BaseModel
import constants as C
from image import imageCHroma
from logger import log_error, log_success, log_info, log_warning

image_router = APIRouter()

class AddRequest(BaseModel):
    folder_path: str
    batch_size: int = C.DEFAULT_BATCH_SIZE

class DeleteRequest(BaseModel):
    folder_path: str

class QueryRequest(BaseModel):
    query_text: str
    n_results: int = C.DEFAULT_N_RESULTS


@image_router.post("/image/scan-folder")
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

@image_router.post("/image/query")
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

@image_router.delete("/image/delete-all")
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

@image_router.delete("/image/delete-folder")
async def delete_folder(request:DeleteRequest) -> Dict[str, Any]:
    log_info(f"Received request to delete folder: {request.folder_path}")
    try:
        if not request.folder_path.strip():
            log_warning("Received request with empty folder path.")
            raise HTTPException(status_code=400, detail="Folder path cannot be empty")
        result = imageCHroma.DELETE(request.folder_path)
        log_success(f"Successfully deleted folder: {request.folder_path}")
        return {
            "message": f"Successfully deleted folder: {request.folder_path}",
            "deleted_count": result["deleted_count"],
            "status": result["status"],
        }
    except Exception as e:
        log_error(f"An unexpected error occurred while deleting folder: {request.folder_path}")
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )
