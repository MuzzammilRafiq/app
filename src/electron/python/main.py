from typing import Dict, Any, List
import uvicorn
from fastapi import FastAPI, HTTPException
from pillow_heif import register_heif_opener
from pydantic import BaseModel
import constants as C
from image import imageCHroma


register_heif_opener()
app = FastAPI()


class AddImagesRequest(BaseModel):
    folder_path: str
    batch_size: int = C.DEFAULT_BATCH_SIZE


class QueryImagesRequest(BaseModel):
    query_text: str
    n_results: int = C.DEFAULT_N_RESULTS


@app.get("/")
async def health_check() -> Dict[str, str]:
    return {"status": "healthy", "service": "image-embedding", "version": "1.0.0"}


@app.post("/images/scan-folder")
async def add_images_from_folder(request: AddImagesRequest) -> Dict[str, Any]:
    print(f"Received request to add images from folder: {request.folder_path}")
    try:
        if not request.folder_path.strip():
            print("Received request with empty folder path.")
            raise HTTPException(status_code=400, detail="Folder path cannot be empty")

        if request.batch_size <= 0:
            print(f"Invalid batch size: {request.batch_size}")
            raise HTTPException(
                status_code=400, detail="Batch size must be greater than 0"
            )

        result = imageCHroma.add_images_from_folder_recursively(
            request.folder_path, request.batch_size
        )

        print(
            f"Successfully processed folder {request.folder_path}: "
            f"{result['total_added']}/{result['total_found']} images added"
        )

        return result

    except ValueError as ve:
        print(
            f"ValueError while adding images from folder {request.folder_path}: {ve}"
        )
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        print(
            f"An unexpected error occurred while adding images from folder {request.folder_path}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


@app.post("/images/query")
async def query_images(request: QueryImagesRequest) -> List[str]:
    print(
        f"Received query request: '{request.query_text[:50]}...' with n_results={request.n_results}"
    )

    try:
        if not request.query_text.strip():
            print("Received request with empty query text.")
            raise HTTPException(status_code=400, detail="Query text cannot be empty")

        if request.n_results <= 0:
            print(f"Invalid n_results: {request.n_results}")
            raise HTTPException(
                status_code=400, detail="n_results must be greater than 0"
            )
        return imageCHroma.query_images_from_db(request.query_text, request.n_results)

    except HTTPException:
        raise
    except Exception as e:
        print(
            f"An unexpected error occurred while querying images with text: '{request.query_text[:50]}...'",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


@app.delete("/images/delete-all")
async def delete_all_images() -> Dict[str, Any]:
    print("Received request to delete all images from database")

    try:
        result = imageCHroma.delete_all_images_from_db()
        print(f"Successfully deleted images: {result}")

        return {
            "message": f"Successfully deleted {result['deleted_count']} images from database",
            "deleted_count": result["deleted_count"],
            "status": result["status"],
        }

    except Exception as e:
        print(
            "An unexpected error occurred while deleting all images from database",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


if __name__ == "__main__":
    uvicorn.run(app)
