import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

# ------------------------------------------------------------------------------
# Path Definitions & Model Loading
# ------------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "diabetes_prediction_model.joblib"
FRONTEND_DIR = BASE_DIR / "frontend"

FEATURE_NAMES = [
    "n_pregnant",
    "glucose",
    "tension",
    "thickness",
    "insulin",
    "bmi",
    "pedigree",
    "age"
]

model = None

def load_ml_model():
    global model
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model file not found at: {MODEL_PATH}. "
            "Please ensure 'models/diabetes_prediction_model.joblib' is present."
        )
    model = joblib.load(MODEL_PATH)
    print(f"[INFO] ML Model loaded successfully from {MODEL_PATH}")

try:
    load_ml_model()
except Exception as err:
    print(f"[WARNING] Failed to load model on module load: {err}", file=sys.stderr)

# ------------------------------------------------------------------------------
# FastAPI Application Setup
# ------------------------------------------------------------------------------
app = FastAPI(
    title="Diabetes Prediction API",
    description="Production-style ML API for Diabetes Prediction using scikit-learn Logistic Regression Pipeline.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# Pydantic Schemas & Validation
# ------------------------------------------------------------------------------
class DiabetesInput(BaseModel):
    n_pregnant: int = Field(..., ge=0, description="Number of times pregnant (>= 0)")
    glucose: float = Field(..., ge=0, description="Plasma glucose concentration (>= 0)")
    tension: float = Field(..., ge=0, description="Diastolic blood pressure in mm Hg (>= 0)")
    thickness: float = Field(..., ge=0, description="Triceps skin fold thickness in mm (>= 0)")
    insulin: float = Field(..., ge=0, description="2-Hour serum insulin in mu U/ml (>= 0)")
    bmi: float = Field(..., ge=0, description="Body mass index (weight in kg/(height in m)^2) (>= 0)")
    pedigree: float = Field(..., ge=0, description="Diabetes pedigree function score (>= 0)")
    age: int = Field(..., ge=0, description="Age in years (>= 0)")

    @field_validator("n_pregnant", "age", mode="before")
    def validate_int_fields(cls, v, info):
        if v is None or v == "":
            raise ValueError(f"Field '{info.field_name}' cannot be empty.")
        try:
            val = float(v)
            if not val.is_integer():
                raise ValueError(f"Field '{info.field_name}' must be a whole integer.")
            val_int = int(val)
            if val_int < 0:
                raise ValueError(f"Field '{info.field_name}' cannot be negative.")
            return val_int
        except (TypeError, ValueError) as e:
            if "must be a whole integer" in str(e) or "cannot be negative" in str(e) or "cannot be empty" in str(e):
                raise e
            raise ValueError(f"Field '{info.field_name}' must be a valid non-negative integer.")

    @field_validator("glucose", "tension", "thickness", "insulin", "bmi", "pedigree", mode="before")
    def validate_float_fields(cls, v, info):
        if v is None or v == "":
            raise ValueError(f"Field '{info.field_name}' cannot be empty.")
        try:
            val = float(v)
            if val < 0:
                raise ValueError(f"Field '{info.field_name}' cannot be negative.")
            return val
        except (TypeError, ValueError) as e:
            if "cannot be negative" in str(e) or "cannot be empty" in str(e):
                raise e
            raise ValueError(f"Field '{info.field_name}' must be a valid non-negative numeric value.")

class PredictionResponse(BaseModel):
    prediction: int
    prediction_label: str
    risk_status: str
    probability: float
    probability_percentage: float
    probabilities: Dict[str, float]
    disclaimer: str
    timestamp: str

# ------------------------------------------------------------------------------
# Custom Exception Handlers
# ------------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err["loc"] if loc != "body")
        msg = err["msg"].replace("Value error, ", "")
        errors.append(f"{field}: {msg}" if field else msg)
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "details": errors,
            "message": "Invalid input provided. Please ensure all 8 features are non-negative numeric values."
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTP Error",
            "message": exc.detail
        }
    )

# ------------------------------------------------------------------------------
# API Endpoints
# ------------------------------------------------------------------------------
@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint required by deployment platforms and prompt requirements."""
    if model is None:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "reason": "ML Model is not loaded"}
        )
    return {"status": "healthy"}

@app.post("/predict", response_model=PredictionResponse)
@app.post("/api/predict", response_model=PredictionResponse)
async def predict_diabetes(payload: DiabetesInput):
    """
    Accepts 8 input features, generates prediction using the actual trained scikit-learn model,
    and returns prediction class and risk probability.
    """
    if model is None:
        try:
            load_ml_model()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Trained model not available: {str(e)}"
            )

    try:
        # Construct DataFrame with exact 8 feature names in exact order
        input_data = {
            "n_pregnant": payload.n_pregnant,
            "glucose": payload.glucose,
            "tension": payload.tension,
            "thickness": payload.thickness,
            "insulin": payload.insulin,
            "bmi": payload.bmi,
            "pedigree": payload.pedigree,
            "age": payload.age
        }
        df = pd.DataFrame([input_data])[FEATURE_NAMES]

        # Actual Model Inference
        raw_pred = model.predict(df)[0]
        prediction_class = int(raw_pred)

        # Get probabilities if supported by pipeline
        prob_neg, prob_pos = 0.5, 0.5
        if hasattr(model, "predict_proba"):
            proba_arr = model.predict_proba(df)[0]
            prob_neg = float(proba_arr[0])
            prob_pos = float(proba_arr[1])
        elif prediction_class == 1:
            prob_pos = 1.0
            prob_neg = 0.0
        else:
            prob_pos = 0.0
            prob_neg = 1.0

        target_prob = prob_pos if prediction_class == 1 else (1.0 - prob_pos)
        
        if prediction_class == 1:
            label = "High Risk (Diabetes Detected)"
            risk_status = "High Risk"
        else:
            label = "Low Risk (No Diabetes Detected)"
            risk_status = "Low Risk"

        return PredictionResponse(
            prediction=prediction_class,
            prediction_label=label,
            risk_status=risk_status,
            probability=round(prob_pos, 4),
            probability_percentage=round(prob_pos * 100, 2),
            probabilities={
                "negative": round(prob_neg, 4),
                "positive": round(prob_pos, 4)
            },
            disclaimer="Model prediction only — not a medical diagnosis.",
            timestamp=datetime.now(timezone.utc).isoformat()
        )

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction error: {str(exc)}"
        )

# ------------------------------------------------------------------------------
# Static Files Mounting for Frontend
# ------------------------------------------------------------------------------
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
