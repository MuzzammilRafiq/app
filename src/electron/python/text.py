from chroma import ChromaDB
import constants as C
import uuid
from pathlib import Path
import pymupdf
import os
from logger import log_error, log_success, log_info

class TextChroma:
    def __init__(self):
        self.collection = ChromaDB(C.PATH).get_collection(C.TEXT)

    def CREATE(self, chunks):
        # chunks = [index,path,text]
        try:
            self.collection.add(
                ids=[str(uuid.uuid4()) for _ in range(len(chunks))],
                documents=[c[2] for c in chunks],
                metadatas=[
                    {"index": c[0],"path": c[1]} for c in chunks
                ],
            )
        except Exception as e:
            log_error(str(e))

    def READ(self, query_text: str, n_results: int = 10):
        try:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=n_results,
                include=["metadatas", "documents"],
            )
            return results
        except Exception as e:
            log_error(str(e))
            return []

    def DELETE_ALL(self):
        try:
            self.collection.delete(where={})
        except Exception as e:
            log_error(f"Error deleting text from database: {e}")
            raise e

    def DELETE(self, folder_path: str):
        try:
            results= self.collection.get(include=["metadatas"])
            if results == []:
                log_success("folder not present in db")
                return {"deleted_count": 0, "status": "success"}

            ids = [id for id, uri in zip(results["ids"], results["uris"]) if uri.startswith(folder_path)]
            self.collection.delete(ids=ids)
            log_success(f"Successfully deleted {len(ids)} images from folder: {folder_path}")
            return {"deleted_count": len(ids), "status": "success"}
        except Exception as e:
            log_error(str(e))
            return []

    def pdf_text_to_chunk(self, path, chunk_size=100):
        def divide(index, text, chunk_size=100):
            chunks = []
            words = text.split()
            
            for i in range(0, len(words), chunk_size):
                chunk_words = words[i:i+chunk_size]
                chunk_text = ' '.join(chunk_words)
                chunks.append((index, str(path), chunk_text))
            
            return chunks
        
        res = []
        doc = pymupdf.open(path)
        for i, page in enumerate(doc):
            text = page.get_textpage().extractTEXT()
            chunks = divide(i, text, chunk_size)
            res.extend(chunks)
        return res

    def text_file_to_chunk_simple(self, path, chunk_size=100):
        def divide_by_words_simple(text, chunk_size=100):
            chunks = []
            words = text.split()
            lines = text.split("\n")

            # Create a mapping of word position to line number
            word_to_line = {}
            current_line = 1
            word_count = 0

            for line in lines:
                line_words = line.split()
                for _ in line_words:
                    word_to_line[word_count] = current_line
                    word_count += 1
                current_line += 1

            # Create chunks
            for i in range(0, len(words), chunk_size):
                chunk_words = words[i : i + chunk_size]
                chunk_text = " ".join(chunk_words)
                start_line = word_to_line.get(i, 1)
                chunks.append((start_line, str(path), chunk_text))

            return chunks

        with open(path, "r", encoding="utf-8") as file:
            text = file.read()

        chunks = divide_by_words_simple(text, chunk_size)
        return chunks

    def is_supported_text_file(self, file_path: str) -> bool:
        supported_extensions = {
            # General text
            ".txt",
            ".md",
            ".csv",
            ".tsv",
            ".log",
            ".ini",
            ".cfg",
            ".conf",
            ".yaml",
            ".yml",
            ".json",
            ".xml",
            # Programming languages
            ".c",
            ".h",
            ".cpp",
            ".hpp",
            ".cc",
            ".cs",
            ".java",
            ".py",
            ".rb",
            ".php",
            ".swift",
            ".go",
            ".rs",
            ".kt",
            ".kts",
            ".scala",
            ".pl",
            ".sh",
            ".bash",
            ".zsh",
            # Web
            ".html",
            ".htm",
            ".css",
            ".js",
            ".ts",
            ".tsx",
            ".jsx",
            # Config & data
            ".env",
            ".toml",
            ".properties",
            ".dockerfile",
            ".gitignore",
            ".gitattributes",
            # Documentation
            ".rst",
            ".tex",
            ".asciidoc",
            ".pdf"
        }
        _, ext = os.path.splitext(file_path.lower())
        return ext in supported_extensions

    def add_text_from_folder_recursively(self, folder_path: str, batch_size=100):
        folder_path = Path(folder_path).resolve()

        if not folder_path.exists():
            raise ValueError(f"Folder path does not exist: {folder_path}")

        if not folder_path.is_dir():
            raise ValueError(f"Path is not a directory: {folder_path}")

        log_info(f"Searching for files in: {folder_path}")
        file_paths = []
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                if self.is_supported_text_file(file_path):
                    absolute_path = os.path.abspath(file_path)
                    file_paths.append(absolute_path)

        total_files = len(file_paths)
        log_info(f"Found {total_files} text files")
        if total_files == 0:
            return {
                "total_found": 0,
                "total_added": 0,
                "batches_processed": 0,
                "errors": [],
            }
        total_added = 0
        errors = []
        batches_processed = 0

        for file in file_paths:
            try:
                if file.endswith(".pdf"):
                    chunks = self.pdf_text_to_chunk(file)
                else:
                    chunks = self.text_file_to_chunk_simple(file)
                self.CREATE(chunks)
                total_added += 1
                log_success(f"Processed file: {file}")
            except Exception as e:
                log_error(f"Error processing file {file}: {str(e)}")
                errors.append(str(e))

        result = {
            "total_found": total_files,
            "total_added": total_added,
            "errors": errors
        }
        log_success(f"Operation completed: {total_added}/{total_files} files processed")
        return result

textChroma = TextChroma()
