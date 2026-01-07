from typing import Dict, Any
from fastapi import HTTPException,APIRouter
from pydantic import BaseModel
import constants as C
from text import textChroma
from logger import log_error, log_success, log_info, log_warning

text_router = APIRouter()

class AddRequest(BaseModel):
    folder_path: str
    batch_size: int = C.DEFAULT_BATCH_SIZE

class DeleteRequest(BaseModel):
    folder_path: str

class QueryRequest(BaseModel):
    query_text: str
    n_results: int = C.DEFAULT_N_RESULTS


@text_router.post("/text/scan-folder")
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


class ScanFileRequest(BaseModel):
    file_path: str


@text_router.post("/text/scan-file")
async def add_single_text_file(request: ScanFileRequest) -> Dict[str, Any]:
    log_info(f"Received request to add single text file: {request.file_path}")
    try:
        if not request.file_path.strip():
            log_warning("Received request with empty file path.")
            raise HTTPException(status_code=400, detail="File path cannot be empty")
        
        result = textChroma.add_single_text_file(request.file_path)
        return result
    except ValueError as ve:
        log_error(f"ValueError while adding text file {request.file_path}: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"An unexpected error occurred while adding text file {request.file_path}")
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


@text_router.post("/text/query")
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

@text_router.delete("/text/delete-all")
async def delete_all_text() -> Dict[str, Any]:
    log_info("Received request to delete all text from database")

    try:
        textChroma.DELETE_ALL()
        log_success("Successfully deleted all text from database")

        return {
            "message": "Successfully deleted all text from database",
            "status": "success",
        }

    except Exception as e:
        log_error(
            "An unexpected error occurred while deleting all text from database"
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


@text_router.delete("/text/delete-folder")
async def delete_folder(request:DeleteRequest) -> Dict[str, Any]:
    log_info(f"Received request to delete folder: {request.folder_path}")
    try:
        if not request.folder_path.strip():
            log_warning("Received request with empty folder path.")
            raise HTTPException(status_code=400, detail="Folder path cannot be empty")
        result = textChroma.DELETE(request.folder_path)
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
