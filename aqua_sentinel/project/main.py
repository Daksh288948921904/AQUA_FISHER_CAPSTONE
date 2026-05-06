from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from app.analyser import analyze_water_quality
from app.pdf_utils import extract_text_from_pdf
from app.config import settings

import os
import tempfile

app=FastAPI(
    title="Aqua Shark Dashboard",
    version="0.1.0",
    description="Water analysis",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],   
)
@app.get("/health")
async def health():
    return {"status":"ok","service":"aqua Sentinel"}
@app.post("/api/v1/analyse")
async def analyze(file:UploadFile=File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    try:
        contents=await file.read()
        with tempfile.NamedTemporaryFile(delete=False,suffix=".pdf") as tmp:
            tmp.write(contents)
            tmp.flush()
            tmp_path=tmp.name
            
            pdf_text=extract_text_from_pdf(tmp_path)
            if not pdf_text or len(pdf_text.strip())<50:
                raise HTTPException(
                status_code=422,
                detail="Could not extract meaningful text from the PDF.",
            )
            result= await analyze_water_quality(pdf_text)
            return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        if "tmp_path" in locals():
            os.unlink(tmp_path)


if __name__=="__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)