import logging
import sys
from typing import Dict, Any, List
import uvicorn
from fastapi import FastAPI, HTTPException
from pillow_heif import register_heif_opener
from pydantic import BaseModel
from chroma import (
    add_images_from_folder_recursively,
    query_images_from_db,
    delete_all_images_from_db,
)

DEFAULT_BATCH_SIZE = 100
DEFAULT_N_RESULTS = 10

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)

register_heif_opener()

app = FastAPI()


class AddImagesRequest(BaseModel):
    folder_path: str
    batch_size: int = DEFAULT_BATCH_SIZE


class QueryImagesRequest(BaseModel):
    query_text: str
    n_results: int = DEFAULT_N_RESULTS


@app.get("/")
async def health_check() -> Dict[str, str]:
    return {"status": "healthy", "service": "image-embedding", "version": "1.0.0"}


@app.post("/images/scan-folder")
async def add_images_from_folder(request: AddImagesRequest) -> Dict[str, Any]:
    logger.info(f"Received request to add images from folder: {request.folder_path}")
    try:
        if not request.folder_path.strip():
            logger.warning("Received request with empty folder path.")
            raise HTTPException(status_code=400, detail="Folder path cannot be empty")

        if request.batch_size <= 0:
            logger.warning(f"Invalid batch size: {request.batch_size}")
            raise HTTPException(
                status_code=400, detail="Batch size must be greater than 0"
            )

        result = add_images_from_folder_recursively(
            request.folder_path, request.batch_size
        )

        logger.info(
            f"Successfully processed folder {request.folder_path}: "
            f"{result['total_added']}/{result['total_found']} images added"
        )

        return result

    except ValueError as ve:
        logger.error(
            f"ValueError while adding images from folder {request.folder_path}: {ve}"
        )
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            f"An unexpected error occurred while adding images from folder {request.folder_path}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


@app.post("/images/query")
async def query_images(request: QueryImagesRequest) -> List[str]:
    logger.info(
        f"Received query request: '{request.query_text[:50]}...' with n_results={request.n_results}"
    )

    try:
        if not request.query_text.strip():
            logger.warning("Received request with empty query text.")
            raise HTTPException(status_code=400, detail="Query text cannot be empty")

        if request.n_results <= 0:
            logger.warning(f"Invalid n_results: {request.n_results}")
            raise HTTPException(
                status_code=400, detail="n_results must be greater than 0"
            )
        return query_images_from_db(request.query_text, request.n_results)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            f"An unexpected error occurred while querying images with text: '{request.query_text[:50]}...'",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


@app.delete("/images/delete-all")
async def delete_all_images() -> Dict[str, Any]:
    logger.info("Received request to delete all images from database")

    try:
        result = delete_all_images_from_db()
        logger.info(f"Successfully deleted images: {result}")

        return {
            "message": f"Successfully deleted {result['deleted_count']} images from database",
            "deleted_count": result["deleted_count"],
            "status": result["status"],
        }

    except Exception as e:
        logger.exception(
            "An unexpected error occurred while deleting all images from database",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


if __name__ == "__main__":
    uvicorn.run(app)
