import hashlib
from chroma import ChromaDB
import os
from pathlib import Path
import constants as C

class ImageChroma:
    def __init__(self):
        self.collection = ChromaDB(C.PATH).get_collection(C.IMAGE)

    def CREATE(self,image_paths:list[str]):
        try:
            self.collection.add(
                ids=[hashlib.sha256(uri.encode()).hexdigest() for uri in image_paths],
                uris=image_paths,
            )
        except Exception as e:
            print(e)

    def READ(self,query_text: str, n_results: int = 10):
        try:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=n_results,
                include=["uris"],
            )
            return results["uris"][0]
        except Exception as e:
            print(e)
            return []
    
    def DELETE_ALL(self):
        try:
            # Get all IDs from the collection
            results = self.collection.get(include=["uris"])
            if results["ids"]:
                self.collection.delete(ids=results["ids"])
                deleted_count = len(results["ids"])
                print(f"Successfully deleted {deleted_count} images from database")
                return {"deleted_count": deleted_count, "status": "success"}
            else:
                print("No images found in database to delete")
                return {"deleted_count": 0, "status": "no_images_found"}
        except Exception as e:
            print(f"Error deleting images from database: {e}")
            raise e
        
    
    def is_supported_image_file(self,file_path: str) -> bool:
        supported_extensions = {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".heic",
            ".heif",
            ".HEIC",
            ".HEIF",
        }
        _, ext = os.path.splitext(file_path.lower())
        return ext in supported_extensions
    
    def add_images_from_folder_recursively(self,folder_path: str, batch_size: int = 100):
        folder_path = Path(folder_path).resolve()

        if not folder_path.exists():
            raise ValueError(f"Folder path does not exist: {folder_path}")

        if not folder_path.is_dir():
            raise ValueError(f"Path is not a directory: {folder_path}")

        print(f"Searching for images in: {folder_path}")

        image_paths = []
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                if self.is_supported_image_file(file_path):
                    absolute_path = os.path.abspath(file_path)
                    image_paths.append(absolute_path)

        total_images = len(image_paths)
        print(f"Found {total_images} image files")

        if total_images == 0:
            return {
                "total_found": 0,
                "total_added": 0,
                "batches_processed": 0,
                "errors": [],
            }

        added_count = 0
        errors = []
        batches_processed = 0

        for i in range(0, total_images, batch_size):
            batch = image_paths[i : i + batch_size]
            try:
                print(f"Processing batch {batches_processed + 1}: {len(batch)} images")
                self.add_images_to_db(batch)
                added_count += len(batch)
                batches_processed += 1
            except Exception as e:
                error_msg = f"Error processing batch {batches_processed + 1}: {str(e)}"
                print(error_msg)
                errors.append(error_msg)

        result = {
            "total_found": total_images,
            "total_added": added_count,
            "batches_processed": batches_processed,
            "errors": errors,
        }

        print(f"Operation completed: {added_count}/{total_images} images added to ChromaDB")
        return result
    
imageCHroma = ImageChroma()