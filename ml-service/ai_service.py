
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import numpy as np
import math

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import DBSCAN


app = FastAPI(title="CivicSense AI Service", version="2.1")


# =========================================================
# 1. AI MODEL INITIALIZATION
# =========================================================

print("Loading AI Models and Initializing Classifier...")

embedder = SentenceTransformer("all-MiniLM-L6-v2")

training_texts = [
    "deep pothole on main road causing bike accidents",
    "huge crater near school bus stop damaging cars",
    "garbage dump overflow piling up street corner stinking",
    "uncollected trash bags scattered across pavement",
    "water pipe leaking flooding residential street",
    "broken water hydrant spraying clean water continuously",
    "street light broken pitch dark walking hazard at night",
    "malfunctioning traffic signal sparking electricity danger",
]

# Categories aligned with the Node.js backend
training_labels = [
    "Road Damage",
    "Road Damage",
    "Garbage",
    "Garbage",
    "Water Leakage",
    "Water Leakage",
    "Streetlight",
    "Electrical Hazard",
]

classifier = Pipeline([
    ("tfidf", TfidfVectorizer(stop_words="english")),
    ("clf", LogisticRegression()),
])

classifier.fit(training_texts, training_labels)

print("AI Models Loaded Successfully!")


# =========================================================
# 2. IN-MEMORY COMPLAINT HISTORY
# =========================================================
# Note: This history resets when the service restarts.
# For persistent history, integrate MongoDB/backend data.

GLOBAL_COMPLAINTS_HISTORY: List[Dict[str, Any]] = []


# Department values aligned with the Node.js backend
DEPARTMENT_MAPPING = {
    "Electrical Hazard": "Electrical",
    "Garbage": "Sanitation",
    "Road Damage": "Roads",
    "Water Leakage": "Water Supply",
    "Streetlight": "Electrical",
    "Fire Hazard": "Fire and Safety",
    "Other": "Public Works",
}


VALID_CATEGORIES = set(DEPARTMENT_MAPPING.keys())


# =========================================================
# 3. REQUEST AND RESPONSE SCHEMAS
# =========================================================

class AnalyzeInput(BaseModel):
    description: str
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    createdAt: Optional[str] = None
    complaintId: Optional[str] = None
    relatedReports: Optional[List[Dict[str, Any]]] = []


class ClusterInfoSchema(BaseModel):
    clusterId: Optional[int] = None
    clusterSize: int = 1
    isHotspot: bool = False


class AnalyzeOutput(BaseModel):
    predictedCategory: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    explanation: str
    priorityScore: int = Field(..., ge=0, le=100)
    priorityReasons: List[str]
    recommendedDepartment: str
    duplicateCandidates: List[Dict[str, Any]]
    cluster: ClusterInfoSchema


class ReportItem(BaseModel):
    id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    category: Optional[str] = None


class ClusterInput(BaseModel):
    reports: List[ReportItem]


class ClusterDetail(BaseModel):
    clusterId: int
    complaintIds: List[str]
    clusterSize: int
    isHotspot: bool
    latitude: float
    longitude: float


class ClusterOutput(BaseModel):
    clusters: List[ClusterDetail]
    noiseComplaintIds: List[str]


# =========================================================
# 4. GEOGRAPHIC DISTANCE
# =========================================================

def haversine_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """Calculate the distance between GPS coordinates in meters."""

    earth_radius = 6_371_000

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1)
        * math.cos(phi2)
        * math.sin(delta_lambda / 2) ** 2
    )

    # Protect against floating-point rounding errors.
    a = min(1.0, max(0.0, a))

    c = 2 * math.asin(math.sqrt(a))

    return earth_radius * c


# =========================================================
# 5. PRIORITY SCORING
# =========================================================

def evaluate_priority(
    description: str,
    cluster_size: int,
) -> tuple[int, List[str], str]:

    desc_lower = description.lower()

    score = 40
    reasons = []

    safety_keywords = [
        "danger",
        "accident",
        "flooding",
        "sparking",
        "injury",
        "hazard",
        "deep",
        "crater",
        "dark",
        "fire",
        "electric shock",
    ]

    if any(keyword in desc_lower for keyword in safety_keywords):
        score += 35
        reasons.append(
            "High safety risk keywords identified in description."
        )
    else:
        reasons.append("Standard infrastructure severity.")

    if cluster_size > 1:
        cluster_bonus = min(20, (cluster_size - 1) * 5)
        score += cluster_bonus

        reasons.append(
            f"Amplified by {cluster_size} related spatial/semantic reports."
        )

    if any(
        keyword in desc_lower
        for keyword in ["water", "electric", "sparking"]
    ):
        score += 10
        reasons.append(
            "Critical utility infrastructure disruption."
        )

    final_score = int(min(100, max(0, score)))

    explanation = (
        f"Assessed score of {final_score}/100 "
        "based on keyword severity and clustering density."
    )

    return final_score, reasons, explanation


# =========================================================
# 6. HEALTH CHECK
# =========================================================

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CivicSense AI Engine",
    }


# =========================================================
# 7. COMPLAINT ANALYSIS
# =========================================================

@app.post("/analyze", response_model=AnalyzeOutput)
def analyze_complaint(data: AnalyzeInput):

    try:
        description = data.description.strip()

        if not description:
            raise HTTPException(
                status_code=422,
                detail="Complaint description cannot be empty.",
            )

        # -------------------------------------------------
        # A. CLASSIFICATION
        # -------------------------------------------------

        probabilities = classifier.predict_proba([description])[0]
        predicted_category = classifier.predict([description])[0]

        confidence = round(float(np.max(probabilities)), 2)

        # A valid user-selected category takes precedence.
        # Otherwise, use the model prediction.
        if data.category in VALID_CATEGORIES:
            predicted_category = data.category

        recommended_department = DEPARTMENT_MAPPING.get(
            predicted_category,
            "Public Works",
        )

        # -------------------------------------------------
        # B. GENERATE SEMANTIC EMBEDDING
        # -------------------------------------------------

        current_embedding = embedder.encode(description).tolist()

        # -------------------------------------------------
        # C. FIND POSSIBLE DUPLICATES
        # -------------------------------------------------

        duplicate_candidates = []
        cluster_size = 1

        has_current_location = (
            data.latitude is not None
            and data.longitude is not None
        )

        for item in GLOBAL_COMPLAINTS_HISTORY:

            similarity = float(
                cosine_similarity(
                    [current_embedding],
                    [item["embedding"]],
                )[0][0]
            )

            distance = None

            has_previous_location = (
                item.get("latitude") is not None
                and item.get("longitude") is not None
            )

            if has_current_location and has_previous_location:

                distance = haversine_distance(
                    data.latitude,
                    data.longitude,
                    item["latitude"],
                    item["longitude"],
                )

                # High similarity and within 50 meters.
                is_duplicate = similarity >= 0.75 and distance <= 50

            else:
                # Semantic-only fallback if coordinates are unavailable.
                is_duplicate = similarity >= 0.85

            if is_duplicate:
                cluster_size += 1

                previous_id = item.get("id")

                # Actual MongoDB IDs are supplied by the Node backend.
                # The fallback identifies an in-memory record only.
                if not previous_id:
                    previous_id = "historical_ref"

                if distance is not None:
                    reason = (
                        f"Semantic similarity {similarity:.2f}; "
                        f"within {distance:.1f} meters."
                    )
                else:
                    reason = (
                        f"Semantic similarity {similarity:.2f}; "
                        "location comparison unavailable."
                    )

                duplicate_candidates.append({
                    "complaintId": str(previous_id),
                    "similarity": round(similarity, 2),
                    "distanceMeters": (
                        round(distance, 1)
                        if distance is not None
                        else None
                    ),
                    "reason": reason,
                })

        # -------------------------------------------------
        # D. PRIORITY AND HOTSPOT ESTIMATION
        # -------------------------------------------------

        (
            priority_score,
            priority_reasons,
            explanation,
        ) = evaluate_priority(description, cluster_size)

        is_hotspot = cluster_size >= 3

        # -------------------------------------------------
        # E. SAVE TO TEMPORARY HISTORY
        # -------------------------------------------------

        history_id = data.complaintId

        if not history_id:
            # Temporary ID only; not a real MongoDB complaint ID.
            history_id = f"history_{len(GLOBAL_COMPLAINTS_HISTORY) + 1}"

        GLOBAL_COMPLAINTS_HISTORY.append({
            "id": str(history_id),
            "description": description,
            "latitude": data.latitude,
            "longitude": data.longitude,
            "embedding": current_embedding,
        })

        # -------------------------------------------------
        # F. RETURN BACKEND-COMPATIBLE RESPONSE
        # -------------------------------------------------

        return {
            "predictedCategory": predicted_category,
            "confidence": confidence,
            "explanation": explanation,
            "priorityScore": priority_score,
            "priorityReasons": priority_reasons,
            "recommendedDepartment": recommended_department,
            "duplicateCandidates": duplicate_candidates,
            "cluster": {
                # Node backend expects an integer cluster ID.
                "clusterId": 1 if cluster_size > 1 else None,
                "clusterSize": cluster_size,
                "isHotspot": is_hotspot,
            },
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


# =========================================================
# 8. GEOGRAPHIC CLUSTERING USING DBSCAN
# =========================================================

@app.post("/cluster", response_model=ClusterOutput)
def cluster_complaints(data: ClusterInput):

    try:
        valid_reports = [
            report
            for report in data.reports
            if report.latitude is not None
            and report.longitude is not None
        ]

        reports_without_location = [
            report.id
            for report in data.reports
            if report.latitude is None
            or report.longitude is None
        ]

        if len(valid_reports) < 2:
            return {
                "clusters": [],
                "noiseComplaintIds": [
                    report.id for report in data.reports
                ],
            }

        # DBSCAN with haversine requires coordinates in radians.
        coordinates = np.radians([
            [report.latitude, report.longitude]
            for report in valid_reports
        ])

        # 50 meters expressed as an angular distance in radians.
        epsilon = 0.05 / 6371.0

        dbscan = DBSCAN(
            eps=epsilon,
            min_samples=2,
            metric="haversine",
        )

        labels = dbscan.fit_predict(coordinates)

        clusters_map = {}
        noise_complaints = list(reports_without_location)

        for index, label in enumerate(labels):

            report = valid_reports[index]

            if label == -1:
                noise_complaints.append(report.id)
                continue

            if label not in clusters_map:
                clusters_map[label] = {
                    "complaintIds": [],
                    "latitudes": [],
                    "longitudes": [],
                }

            clusters_map[label]["complaintIds"].append(report.id)
            clusters_map[label]["latitudes"].append(report.latitude)
            clusters_map[label]["longitudes"].append(report.longitude)

        formatted_clusters = []

        for cluster_id, info in clusters_map.items():

            complaint_ids = info["complaintIds"]
            cluster_size = len(complaint_ids)

            formatted_clusters.append({
                "clusterId": int(cluster_id),
                "complaintIds": complaint_ids,
                "clusterSize": cluster_size,
                "isHotspot": cluster_size >= 3,
                "latitude": float(np.mean(info["latitudes"])),
                "longitude": float(np.mean(info["longitudes"])),
            })

        return {
            "clusters": formatted_clusters,
            "noiseComplaintIds": noise_complaints,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )
