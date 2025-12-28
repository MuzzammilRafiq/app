import uvicorn
from fastapi import FastAPI
from pillow_heif import register_heif_opener
from routes import image_router, text_router, web_search_router


register_heif_opener()

#-------------routes--------------------
app = FastAPI()
@app.get("/")
async def health_check():
    return {"status": "healthy", "service": "embedding", "version": "1.0.0"}

app.include_router(image_router)
app.include_router(text_router)
app.include_router(web_search_router)
#-------------routes--------------------

if __name__ == "__main__":
    uvicorn.run(app)