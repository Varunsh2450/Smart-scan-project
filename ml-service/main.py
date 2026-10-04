from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uvicorn
from model import EWPredictor

app = FastAPI(
    title="EW Smart Scan ML Service",
    description="Machine Learning Service for Smart Frequency Band Scanning in Electronic Warfare",
    version="1.0.0"
)

# Enable CORS for React frontend or Spring Boot
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global predictor instance
predictor = EWPredictor(num_bands=20, model_type="rf")

class HistoryItem(BaseModel):
    band: int
    result: int # 1 = HIT, 0 = MISS
    time: Optional[int] = 0

class PredictRequest(BaseModel):
    history: List[HistoryItem] = Field(default_factory=list)
    current_time: int = 0
    num_bands: Optional[int] = 20
    model_type: Optional[str] = None # 'rf' or 'lr'

class PredictResponse(BaseModel):
    probabilities: List[float]
    recommended_band: int
    current_time: int
    metadata: Dict[str, Any]

class TrainRequest(BaseModel):
    history: List[HistoryItem]
    num_bands: Optional[int] = 20
    model_type: Optional[str] = "rf"

class ConfigRequest(BaseModel):
    num_bands: Optional[int] = 20
    model_type: Optional[str] = "rf"

@app.get("/")
def root():
    return {
        "service": "EW Smart Scan ML Service",
        "status": "online",
        "num_bands": predictor.num_bands,
        "model_type": predictor.model_type,
        "is_fitted": predictor.is_fitted
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "num_bands": predictor.num_bands,
        "is_fitted": predictor.is_fitted,
        "training_samples": predictor.training_samples_count
    }

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    try:
        # Adjust bands if request specifies different count
        if req.num_bands and req.num_bands != predictor.num_bands:
            predictor.reset(req.num_bands)
            
        if req.model_type and req.model_type != predictor.model_type:
            predictor.model_type = req.model_type

        # Convert pydantic history to dicts
        history_dicts = [item.model_dump() for item in req.history]

        probs, recommended_band, meta = predictor.predict(
            history=history_dicts,
            current_time=req.current_time
        )

        return PredictResponse(
            probabilities=probs,
            recommended_band=recommended_band,
            current_time=req.current_time,
            metadata=meta
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/train")
def train(req: TrainRequest):
    try:
        if req.num_bands and req.num_bands != predictor.num_bands:
            predictor.reset(req.num_bands)
        if req.model_type:
            predictor.model_type = req.model_type
            
        history_dicts = [item.model_dump() for item in req.history]
        predictor.train_on_history(history_dicts)
        
        return {
            "status": "trained",
            "is_fitted": predictor.is_fitted,
            "training_samples": predictor.training_samples_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training error: {str(e)}")

@app.post("/reset")
def reset(req: Optional[ConfigRequest] = None):
    num_bands = req.num_bands if req and req.num_bands else 20
    model_type = req.model_type if req and req.model_type else "rf"
    predictor.reset(num_bands)
    predictor.model_type = model_type
    return {
        "status": "reset",
        "num_bands": predictor.num_bands,
        "model_type": predictor.model_type
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=False)
