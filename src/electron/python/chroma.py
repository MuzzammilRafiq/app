import chromadb
from chromadb.utils.embedding_functions import OpenCLIPEmbeddingFunction,SentenceTransformerEmbeddingFunction
from chromadb.utils.data_loaders import ImageLoader
from enum import Enum
import constants as C
class ChromaDB:
    __instance = None
    __client = None
    __image_collection = None
    __text_collection = None

    def __new__(cls,*args,**kwargs):
        if cls.__instance is None:
            cls.__instance = super().__new__(cls)
            cls.__client = chromadb.PersistentClient(args[0])
        return cls.__instance
    
    def get_collection(self,collection:str):
        if(ChromaDB.__client is None):
            return None
        

        if collection == C.IMAGE:
            ChromaDB.__image_collection = ChromaDB.__image_collection or ChromaDB.__client.get_or_create_collection(
                name=collection,
                embedding_function=OpenCLIPEmbeddingFunction(model_name="ViT-B-32")
            ) 
            return ChromaDB.__image_collection
        elif collection == C.TEXT:
            ChromaDB.__text_collection = ChromaDB.__text_collection or ChromaDB.__client.get_or_create_collection(
                name=collection,
                embedding_function=SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L12-v2")
            )
            return ChromaDB.__text_collection
        else:
            raise Exception("undefined collection")
    