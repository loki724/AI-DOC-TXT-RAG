# Production Diabetes Prediction Web Application

A production-style Machine Learning web application that predicts diabetes risk using a pre-trained scikit-learn Logistic Regression pipeline. Built with a FastAPI backend and a responsive, modern HTML/CSS/JavaScript dashboard frontend.

---

## Features

- **Pre-Trained ML Model**: Direct inference using `models/diabetes_prediction_model.joblib` without retraining or fabricated predictions.
- **REST API**: Built with FastAPI providing `/health` and `/predict` endpoints.
- **Strict Validation**: Pydantic backend validation + real-time client-side validation for numeric ranges and non-negative constraints.
- **Interactive UI**: High/Low Risk visual classification, risk probability gauge bar, evaluated feature summary chips, and mandatory medical disclaimer.
- **Session Prediction History**: Tracks all predictions made during the session with quick value reloading.
- **Cloud-Ready**: Containerized with `Dockerfile` and optimized for Google Cloud Run deployment.

---

## Model & Feature Schema

The trained model pipeline expects exactly 8 features in the following order:

| # | Feature Name | User-Facing Label | Expected Type | Range |
|---|--------------|-------------------|---------------|-------|
| 1 | `n_pregnant` | Pregnancies | Integer | >= 0 |
| 2 | `glucose` | Glucose (mg/dL) | Float | >= 0 |
| 3 | `tension` | Blood Pressure (mmHg) | Float | >= 0 |
| 4 | `thickness` | Skin Thickness (mm) | Float | >= 0 |
| 5 | `insulin` | Insulin (µU/mL) | Float | >= 0 |
| 6 | `bmi` | BMI (kg/m²) | Float | >= 0 |
| 7 | `pedigree` | Diabetes Pedigree Function | Float | >= 0 |
| 8 | `age` | Age (years) | Integer | >= 0 |

---

## Quick Start (Local Setup)

### Prerequisites

- Python 3.10+
- pip

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the Application

Launch the FastAPI application using Uvicorn:

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Open in Browser

Navigate to `http://localhost:8000` to access the full interactive dashboard.

---

## API Documentation

### 1. Health Check Endpoint

- **URL**: `GET /health`
- **Response**: `200 OK`
```json
{
  "status": "healthy"
}
```

### 2. Prediction Endpoint

- **URL**: `POST /predict`
- **Request Body**:
```json
{
  "n_pregnant": 6,
  "glucose": 148,
  "tension": 72,
  "thickness": 35,
  "insulin": 0,
  "bmi": 33.6,
  "pedigree": 0.627,
  "age": 50
}
```
- **Response**: `200 OK`
```json
{
  "prediction": 1,
  "prediction_label": "High Risk (Diabetes Detected)",
  "risk_status": "High Risk",
  "probability": 0.7179,
  "probability_percentage": 71.79,
  "probabilities": {
    "negative": 0.2821,
    "positive": 0.7179
  },
  "disclaimer": "Model prediction only — not a medical diagnosis.",
  "timestamp": "2026-09-29T22:31:00Z"
}
```

---

## Deployment to Google Cloud Run

### 1. Build Docker Image Locally

```bash
docker build -t diabetes-prediction-app .
```

### 2. Test Container Locally

```bash
docker run -p 8080:8080 diabetes-prediction-app
```

### 3. Deploy to Google Cloud Run

```bash
# Set GCP Project
gcloud config set project YOUR_PROJECT_ID

# Submit build to Google Artifact Registry / Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/diabetes-prediction-app

# Deploy service to Cloud Run
gcloud run deploy diabetes-prediction-app \
    --image gcr.io/YOUR_PROJECT_ID/diabetes-prediction-app \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated
```

---

## Disclaimer

> **IMPORTANT**: Model prediction only — not a medical diagnosis. This application is designed as a demonstration for machine learning classification workflows.
