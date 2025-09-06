from chroma import ChromaDB
import constants as C
import uuid

class TextChroma:
    def __init__(self):
        self.collection = ChromaDB("./k").get_collection(C.TEXT)

    def CREATE(self,text_chunks:list[str],file_paths=list[str],indexs=list[str]):
        assert len(text_chunks) == len(file_paths)==len(indexs)
        try:
            self.collection.add(
                ids=[str(uuid.uuid4()) for _ in range(len(indexs))],
                documents=text_chunks,
                metadatas=[{"path":f,"index":i} for (f,i) in zip(file_paths,indexs)]
            )
        except Exception as e:
            print(e)

    def READ(self,query_text: str, n_results: int = 10):
        try:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=n_results,
                include=['metadatas','documents']
            )
            return results
        except Exception as e:
            print(e)
            return []
    
    def DELETE_ALL(self):
        try:
            self.collection.delete(where={})
        except Exception as e:
            print(f"Error deleting images from database: {e}")
            raise e
        
    def DELETE(self,file_paths:list[str]):
        try:
            self.collection.delete(where={"path":{"$in":file_paths}})
        except Exception as e:
            print(f"Error deleting images from database: {e}")
            raise e
    
textChroma = TextChroma()
textChroma.CREATE(text_chunks=['boy','girl','women','man'],file_paths=['.','.','.','.'],indexs=[23,33,3,8])
print(textChroma.READ("male"))