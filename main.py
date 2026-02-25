"""
╔══════════════════════════════════════════════════════════════╗
║  EDELHAUS AUTOMOTIVE — Python FastAPI Backend               ║
║  Replaces localStorage with real REST API + SQLite DB       ║
║                                                              ║
║  Run:  uvicorn main:app --reload --port 8000                ║
║  Docs: http://localhost:8000/docs                           ║
╚══════════════════════════════════════════════════════════════╝
"""

from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import (
    create_engine, Column, Integer, String, Float,
    Boolean, Text, DateTime, func
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
import json
import os

# ================================================================
#  DATABASE SETUP — SQLite (zero-config, file-based)
# ================================================================
DATABASE_URL = "sqlite:///./edelhaus.db"
engine       = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()


# ================================================================
#  ORM MODELS
# ================================================================
class CarDB(Base):
    __tablename__ = "cars"
    id                    = Column(Integer, primary_key=True, index=True)
    name                  = Column(String,  nullable=False)
    subtitle              = Column(String)
    category              = Column(String)
    brand                 = Column(String,  nullable=False, index=True)
    badge                 = Column(String)
    origin                = Column(String)
    year                  = Column(String)
    status                = Column(String,  default="Available")
    featured              = Column(Boolean, default=False)
    price                 = Column(String)
    price_usd             = Column(Integer)
    engine                = Column(String)
    displacement          = Column(Integer)
    cylinders             = Column(Integer)
    fuel_type             = Column(String)
    transmission          = Column(String)
    drivetrain            = Column(String)
    power                 = Column(String)
    power_hp              = Column(Integer)
    torque_nm             = Column(Integer)
    acceleration          = Column(String)
    top_speed_kmh         = Column(Integer)
    weight_kg             = Column(Integer)
    fuel_economy_city     = Column(Integer)
    fuel_economy_highway  = Column(Integer)
    range_km              = Column(Integer)
    seats                 = Column(Integer)
    description           = Column(Text)
    # ── Kaggle Premium Dataset Fields ──
    depreciation_rate     = Column(Float)   # % per year; negative = depreciating
    investment_grade      = Column(Boolean, default=False)
    production_units      = Column(Integer)  # None = unlimited
    auction_record_usd    = Column(Integer)  # highest known public auction sale
    resale_value_5yr_pct  = Column(Float)    # % of purchase price remaining after 5 yrs
    market_segment        = Column(String)   # Hypercar / Ultra-Luxury / Performance etc.
    maintenance_cost_usd  = Column(Integer)  # estimated annual maintenance (USD)
    insurance_rate_pct    = Column(Float)    # % of car value per year
    # ── JSON-serialised arrays ──
    images_json           = Column(Text, default="[]")
    colors_json           = Column(Text, default="[]")
    highlights_json       = Column(Text, default="[]")
    created_at            = Column(DateTime, default=datetime.utcnow)
    updated_at            = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserDB(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String,  nullable=False)
    email         = Column(String,  unique=True, index=True, nullable=False)
    password_hash = Column(String,  nullable=False)
    phone         = Column(String,  default="")
    country       = Column(String,  default="")
    created_at    = Column(DateTime, default=datetime.utcnow)


class TestDriveDB(Base):
    __tablename__ = "test_drives"
    id         = Column(Integer,  primary_key=True, index=True)
    user_name  = Column(String)
    user_email = Column(String)
    user_phone = Column(String)
    car_id     = Column(Integer)
    car_name   = Column(String)
    date       = Column(String)
    time       = Column(String)
    notes      = Column(Text)
    status     = Column(String,   default="Pending")
    timestamp  = Column(DateTime, default=datetime.utcnow)


class ServiceDB(Base):
    __tablename__ = "services"
    id           = Column(Integer,  primary_key=True, index=True)
    name         = Column(String)
    phone        = Column(String)
    car          = Column(String)
    service_type = Column(String)
    date         = Column(String)
    time         = Column(String)
    notes        = Column(Text)
    status       = Column(String,   default="Pending")
    timestamp    = Column(DateTime, default=datetime.utcnow)


class InquiryDB(Base):
    __tablename__ = "inquiries"
    id           = Column(Integer,  primary_key=True, index=True)
    name         = Column(String)
    email        = Column(String)
    phone        = Column(String,   default="")
    message      = Column(Text)
    car_interest = Column(String,   default="")
    status       = Column(String,   default="Pending")
    created_at   = Column(DateTime, default=datetime.utcnow)


# ================================================================
#  AUTH — JWT + bcrypt
# ================================================================
SECRET_KEY          = os.getenv("JWT_SECRET", "edelhaus-secure-secret-change-in-production-2026")
ALGORITHM           = "HS256"
pwd_context         = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_USERNAME      = os.getenv("ADMIN_USER", "admin")
# Default password: edelhaus2026  — change via env var ADMIN_PASS_HASH or update here
ADMIN_PASS_HASH     = os.getenv("ADMIN_PASS_HASH", pwd_context.hash("edelhaus2026"))


def _make_token(payload: dict, hours: int = 24) -> str:
    payload = {**payload, "exp": datetime.utcnow() + timedelta(hours=hours)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None


def require_admin(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    payload = _decode_token(authorization.split(" ", 1)[1])
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")
    return payload


def require_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Login required")
    payload = _decode_token(authorization.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


# ================================================================
#  DB DEPENDENCY
# ================================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ================================================================
#  PYDANTIC SCHEMAS (request bodies)
# ================================================================
class CarCreate(BaseModel):
    name:          str
    subtitle:      Optional[str] = None
    category:      Optional[str] = None
    brand:         str
    badge:         Optional[str] = None
    origin:        Optional[str] = None
    year:          Optional[str] = None
    status:        Optional[str] = "Available"
    featured:      Optional[bool] = False
    price:         Optional[str] = None
    price_usd:     Optional[int] = None
    engine:        Optional[str] = None
    fuel_type:     Optional[str] = "Gasoline"
    drivetrain:    Optional[str] = "RWD"
    power:         Optional[str] = None
    power_hp:      Optional[int] = None
    torque_nm:     Optional[int] = None
    acceleration:  Optional[str] = None
    top_speed_kmh: Optional[int] = None
    weight_kg:     Optional[int] = None
    seats:         Optional[int] = 4
    description:   Optional[str] = None
    investment_grade: Optional[bool] = False
    market_segment:   Optional[str] = "Ultra-Luxury"


class UserRegister(BaseModel):
    name:     str
    email:    str
    password: str
    country:  Optional[str] = ""
    phone:    Optional[str] = ""


class UserLogin(BaseModel):
    email:    str
    password: str


class AdminLogin(BaseModel):
    username: str
    password: str


class TestDriveCreate(BaseModel):
    user_name:  str
    user_email: str
    user_phone: str
    car_id:     int
    car_name:   str
    date:       str
    time:       Optional[str] = ""
    notes:      Optional[str] = ""


class ServiceCreate(BaseModel):
    name:         str
    phone:        str
    car:          str
    service_type: str
    date:         str
    time:         Optional[str] = ""
    notes:        Optional[str] = ""


class InquiryCreate(BaseModel):
    name:         str
    email:        str
    phone:        Optional[str] = ""
    message:      str
    car_interest: Optional[str] = ""


class StatusUpdate(BaseModel):
    status: str


# ================================================================
#  HELPER — convert CarDB row to plain dict (with JSON arrays)
# ================================================================
def car_row(c: CarDB) -> dict:
    return {
        "id":                   c.id,
        "name":                 c.name,
        "subtitle":             c.subtitle,
        "category":             c.category,
        "brand":                c.brand,
        "badge":                c.badge,
        "origin":               c.origin,
        "year":                 c.year,
        "status":               c.status,
        "featured":             c.featured,
        "price":                c.price,
        "price_usd":            c.price_usd,
        "engine":               c.engine,
        "displacement":         c.displacement,
        "cylinders":            c.cylinders,
        "fuel_type":            c.fuel_type,
        "transmission":         c.transmission,
        "drivetrain":           c.drivetrain,
        "power":                c.power,
        "power_hp":             c.power_hp,
        "torque_nm":            c.torque_nm,
        "acceleration":         c.acceleration,
        "top_speed_kmh":        c.top_speed_kmh,
        "weight_kg":            c.weight_kg,
        "fuel_economy_city":    c.fuel_economy_city,
        "fuel_economy_highway": c.fuel_economy_highway,
        "range_km":             c.range_km,
        "seats":                c.seats,
        "description":          c.description,
        "depreciation_rate":    c.depreciation_rate,
        "investment_grade":     c.investment_grade,
        "production_units":     c.production_units,
        "auction_record_usd":   c.auction_record_usd,
        "resale_value_5yr_pct": c.resale_value_5yr_pct,
        "market_segment":       c.market_segment,
        "maintenance_cost_usd": c.maintenance_cost_usd,
        "insurance_rate_pct":   c.insurance_rate_pct,
        "images":               json.loads(c.images_json   or "[]"),
        "colors":               json.loads(c.colors_json   or "[]"),
        "highlights":           json.loads(c.highlights_json or "[]"),
    }


# ================================================================
#  FASTAPI APP
# ================================================================
app = FastAPI(
    title="Edelhaus Automotive API",
    description="Premium car dealership backend — powered by Python + FastAPI",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # lock down to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Create tables + auto-seed if DB is empty."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if db.query(CarDB).count() == 0:
        _seed_database(db)
    db.close()


# ================================================================
#  CAR ENDPOINTS
# ================================================================
@app.get("/api/cars")
def get_cars(
    category:         Optional[str]  = Query(None),
    brand:            Optional[str]  = Query(None),
    status:           Optional[str]  = Query(None),
    featured:         Optional[bool] = Query(None),
    fuel_type:        Optional[str]  = Query(None),
    investment_grade: Optional[bool] = Query(None),
    search:           Optional[str]  = Query(None),
    db:               Session        = Depends(get_db)
):
    q = db.query(CarDB)
    if category:         q = q.filter(CarDB.category == category)
    if brand:            q = q.filter(CarDB.brand == brand)
    if status:           q = q.filter(CarDB.status == status)
    if featured  is not None: q = q.filter(CarDB.featured == featured)
    if fuel_type:        q = q.filter(CarDB.fuel_type == fuel_type)
    if investment_grade is not None: q = q.filter(CarDB.investment_grade == investment_grade)
    if search:
        s = f"%{search}%"
        q = q.filter(CarDB.name.ilike(s) | CarDB.brand.ilike(s) | CarDB.description.ilike(s))
    return [car_row(c) for c in q.all()]


@app.get("/api/cars/{car_id}")
def get_car(car_id: int, db: Session = Depends(get_db)):
    c = db.query(CarDB).filter(CarDB.id == car_id).first()
    if not c:
        raise HTTPException(404, "Car not found")
    return car_row(c)


@app.post("/api/cars", status_code=201)
def add_car(car: CarCreate, _=Depends(require_admin), db: Session = Depends(get_db)):
    db_car = CarDB(**car.dict())
    db.add(db_car); db.commit(); db.refresh(db_car)
    return car_row(db_car)


@app.put("/api/cars/{car_id}")
def update_car(car_id: int, car: CarCreate, _=Depends(require_admin), db: Session = Depends(get_db)):
    c = db.query(CarDB).filter(CarDB.id == car_id).first()
    if not c: raise HTTPException(404, "Car not found")
    for k, v in car.dict(exclude_unset=True).items():
        setattr(c, k, v)
    c.updated_at = datetime.utcnow()
    db.commit()
    return car_row(c)


@app.delete("/api/cars/{car_id}")
def delete_car(car_id: int, _=Depends(require_admin), db: Session = Depends(get_db)):
    c = db.query(CarDB).filter(CarDB.id == car_id).first()
    if not c: raise HTTPException(404, "Car not found")
    db.delete(c); db.commit()
    return {"message": "Car deleted"}


@app.patch("/api/cars/{car_id}/status")
def update_car_status(car_id: int, body: StatusUpdate, _=Depends(require_admin), db: Session = Depends(get_db)):
    c = db.query(CarDB).filter(CarDB.id == car_id).first()
    if not c: raise HTTPException(404, "Car not found")
    c.status = body.status; db.commit()
    return {"message": "Status updated", "status": c.status}


# ================================================================
#  AUTH ENDPOINTS
# ================================================================
@app.post("/api/auth/admin/login")
def admin_login(data: AdminLogin):
    if data.username != ADMIN_USERNAME or not pwd_context.verify(data.password, ADMIN_PASS_HASH):
        raise HTTPException(401, "Invalid admin credentials")
    token = _make_token({"sub": "admin", "role": "admin"}, hours=12)
    return {"token": token, "role": "admin", "username": ADMIN_USERNAME}


@app.post("/api/auth/register", status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if db.query(UserDB).filter(UserDB.email == data.email.lower()).first():
        raise HTTPException(409, "Email already registered")
    user = UserDB(
        name=data.name,
        email=data.email.lower(),
        password_hash=pwd_context.hash(data.password),
        phone=data.phone or "",
        country=data.country or ""
    )
    db.add(user); db.commit(); db.refresh(user)
    token = _make_token({"sub": str(user.id), "email": user.email, "name": user.name, "role": "user"})
    return {
        "token": token,
        "user": {"id": user.id, "name": user.name, "email": user.email,
                 "country": user.country, "phone": user.phone}
    }


@app.post("/api/auth/login")
def user_login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == data.email.lower()).first()
    if not user or not pwd_context.verify(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    token = _make_token({"sub": str(user.id), "email": user.email, "name": user.name, "role": "user"})
    return {
        "token": token,
        "user": {"id": user.id, "name": user.name, "email": user.email,
                 "country": user.country, "phone": user.phone or ""}
    }


@app.put("/api/users/me/phone")
def update_phone(body: dict, auth=Depends(require_user), db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.id == int(auth["sub"])).first()
    if not user: raise HTTPException(404, "User not found")
    user.phone = body.get("phone", ""); db.commit()
    return {"message": "Phone updated"}


# ================================================================
#  USER ENDPOINTS (admin only)
# ================================================================
@app.get("/api/users")
def get_users(_=Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(UserDB).order_by(UserDB.created_at.desc()).all()
    return [
        {"id": u.id, "name": u.name, "email": u.email, "phone": u.phone,
         "country": u.country, "created_at": str(u.created_at)[:19]}
        for u in users
    ]


@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, _=Depends(require_admin), db: Session = Depends(get_db)):
    u = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not u: raise HTTPException(404, "User not found")
    db.delete(u); db.commit()
    return {"message": "User deleted"}


# ================================================================
#  TEST DRIVE ENDPOINTS
# ================================================================
@app.post("/api/testdrives", status_code=201)
def book_testdrive(data: TestDriveCreate, db: Session = Depends(get_db)):
    td = TestDriveDB(**data.dict())
    db.add(td); db.commit(); db.refresh(td)
    return {"id": td.id, "message": "Test drive booked", "status": td.status,
            "timestamp": str(td.timestamp)}


@app.get("/api/testdrives")
def get_testdrives(_=Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(TestDriveDB).order_by(TestDriveDB.timestamp.desc()).all()
    return [
        {"id": r.id, "name": r.user_name, "email": r.user_email, "phone": r.user_phone,
         "car": r.car_name, "date": r.date, "time": r.time, "notes": r.notes,
         "status": r.status, "timestamp": str(r.timestamp)[:19]}
        for r in rows
    ]


@app.get("/api/testdrives/user/{email}")
def get_user_testdrives(email: str, db: Session = Depends(get_db)):
    rows = db.query(TestDriveDB).filter(TestDriveDB.user_email == email).all()
    return [
        {"id": r.id, "car_id": r.car_id, "carId": r.car_id, "car": r.car_name,
         "carName": r.car_name, "date": r.date, "time": r.time,
         "status": r.status, "timestamp": str(r.timestamp)[:19]}
        for r in rows
    ]


@app.put("/api/testdrives/{td_id}")
def update_testdrive(td_id: int, body: StatusUpdate, _=Depends(require_admin), db: Session = Depends(get_db)):
    td = db.query(TestDriveDB).filter(TestDriveDB.id == td_id).first()
    if not td: raise HTTPException(404, "Not found")
    td.status = body.status; db.commit()
    return {"message": "Updated"}


@app.delete("/api/testdrives/{td_id}")
def delete_testdrive(td_id: int, _=Depends(require_admin), db: Session = Depends(get_db)):
    td = db.query(TestDriveDB).filter(TestDriveDB.id == td_id).first()
    if not td: raise HTTPException(404, "Not found")
    db.delete(td); db.commit()
    return {"message": "Deleted"}


# ================================================================
#  SERVICE ENDPOINTS
# ================================================================
@app.post("/api/services", status_code=201)
def book_service(data: ServiceCreate, db: Session = Depends(get_db)):
    svc = ServiceDB(**data.dict())
    db.add(svc); db.commit(); db.refresh(svc)
    return {"id": svc.id, "message": "Service appointment booked"}


@app.get("/api/services")
def get_services(_=Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(ServiceDB).order_by(ServiceDB.timestamp.desc()).all()
    return [
        {"id": r.id, "name": r.name, "phone": r.phone, "car": r.car,
         "serviceType": r.service_type, "date": r.date, "time": r.time,
         "notes": r.notes, "status": r.status, "timestamp": str(r.timestamp)[:19]}
        for r in rows
    ]


@app.put("/api/services/{svc_id}")
def update_service(svc_id: int, body: StatusUpdate, _=Depends(require_admin), db: Session = Depends(get_db)):
    svc = db.query(ServiceDB).filter(ServiceDB.id == svc_id).first()
    if not svc: raise HTTPException(404, "Not found")
    svc.status = body.status; db.commit()
    return {"message": "Updated"}


# ================================================================
#  INQUIRY ENDPOINTS
# ================================================================
@app.post("/api/inquiries", status_code=201)
def submit_inquiry(data: InquiryCreate, db: Session = Depends(get_db)):
    inq = InquiryDB(**data.dict())
    db.add(inq); db.commit(); db.refresh(inq)
    return {"id": inq.id, "message": "Inquiry received"}


@app.get("/api/inquiries")
def get_inquiries(_=Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(InquiryDB).order_by(InquiryDB.created_at.desc()).all()
    return [
        {"id": r.id, "name": r.name, "email": r.email, "phone": r.phone,
         "message": r.message, "car_interest": r.car_interest,
         "status": r.status, "date": str(r.created_at)[:10]}
        for r in rows
    ]


@app.put("/api/inquiries/{inq_id}")
def update_inquiry(inq_id: int, body: StatusUpdate, _=Depends(require_admin), db: Session = Depends(get_db)):
    inq = db.query(InquiryDB).filter(InquiryDB.id == inq_id).first()
    if not inq: raise HTTPException(404, "Not found")
    inq.status = body.status; db.commit()
    return {"message": "Updated"}


@app.delete("/api/inquiries/{inq_id}")
def delete_inquiry(inq_id: int, _=Depends(require_admin), db: Session = Depends(get_db)):
    inq = db.query(InquiryDB).filter(InquiryDB.id == inq_id).first()
    if not inq: raise HTTPException(404, "Not found")
    db.delete(inq); db.commit()
    return {"message": "Deleted"}


# ================================================================
#  ANALYTICS ENDPOINT
# ================================================================
@app.get("/api/analytics")
def get_analytics(_=Depends(require_admin), db: Session = Depends(get_db)):
    totals = {
        "cars":             db.query(CarDB).count(),
        "users":            db.query(UserDB).count(),
        "testDrives":       db.query(TestDriveDB).count(),
        "inquiries":        db.query(InquiryDB).count(),
        "services":         db.query(ServiceDB).count(),
        "pendingTD":        db.query(TestDriveDB).filter(TestDriveDB.status == "Pending").count(),
        "pendingInquiries": db.query(InquiryDB).filter(InquiryDB.status == "Pending").count(),
        "availableCars":    db.query(CarDB).filter(CarDB.status == "Available").count(),
        "investmentCars":   db.query(CarDB).filter(CarDB.investment_grade == True).count(),
    }
    brands     = db.query(CarDB.brand, func.count(CarDB.id)).group_by(CarDB.brand).all()
    fuels      = db.query(CarDB.fuel_type, func.count(CarDB.id)).group_by(CarDB.fuel_type).all()
    segments   = db.query(CarDB.market_segment, func.count(CarDB.id)).group_by(CarDB.market_segment).all()
    invest_cars = db.query(CarDB).filter(CarDB.investment_grade == True).order_by(CarDB.depreciation_rate.desc()).all()
    top_priced  = db.query(CarDB).filter(CarDB.price_usd.isnot(None)).order_by(CarDB.price_usd.desc()).limit(5).all()

    avg_price = db.query(func.avg(CarDB.price_usd)).filter(CarDB.price_usd.isnot(None)).scalar() or 0

    return {
        "totals":      totals,
        "avgPriceUsd": round(avg_price),
        "brands":      [{"brand": b, "count": c} for b, c in brands],
        "fuelTypes":   [{"fuel_type": f, "count": c} for f, c in fuels],
        "segments":    [{"segment": s, "count": c} for s, c in segments],
        "investmentGradeCars": [
            {"name": c.name, "brand": c.brand, "price": c.price,
             "appreciation": f"+{c.depreciation_rate:.1f}%/yr" if (c.depreciation_rate or 0) > 0 else f"{c.depreciation_rate:.1f}%/yr",
             "production_units": c.production_units, "market_segment": c.market_segment}
            for c in invest_cars
        ],
        "topPricedCars": [car_row(c) for c in top_priced],
    }


# ================================================================
#  SEED / RESET ENDPOINT (admin only)
# ================================================================
@app.post("/api/seed")
def reseed(_=Depends(require_admin), db: Session = Depends(get_db)):
    """Wipe and re-seed the car database from cars.json"""
    db.query(CarDB).delete(); db.commit()
    count = _seed_database(db)
    return {"message": f"Seeded {count} cars from dataset"}


# ================================================================
#  HEALTH CHECK
# ================================================================
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Edelhaus Automotive API", "version": "2.0.0"}


# ================================================================
#  SEED FUNCTION — loads from cars.json (Kaggle dataset)
# ================================================================
def _seed_database(db: Session) -> int:
    data = _load_dataset()
    count = 0
    for car in data:
        try:
            db_car = CarDB(
                id                    = car.get("id"),
                name                  = car.get("name", ""),
                subtitle              = car.get("subtitle"),
                category              = car.get("category"),
                brand                 = car.get("brand", ""),
                badge                 = car.get("badge"),
                origin                = car.get("origin"),
                year                  = car.get("year"),
                status                = car.get("status", "Available"),
                featured              = car.get("featured", False),
                price                 = car.get("price"),
                price_usd             = car.get("price_usd"),
                engine                = car.get("engine"),
                displacement          = car.get("displacement"),
                cylinders             = car.get("cylinders"),
                fuel_type             = car.get("fuel_type", "Gasoline"),
                transmission          = car.get("transmission"),
                drivetrain            = car.get("drivetrain"),
                power                 = car.get("power"),
                power_hp              = car.get("power_hp"),
                torque_nm             = car.get("torque_nm"),
                acceleration          = car.get("acceleration"),
                top_speed_kmh         = car.get("top_speed_kmh"),
                weight_kg             = car.get("weight_kg"),
                fuel_economy_city     = car.get("fuel_economy_city"),
                fuel_economy_highway  = car.get("fuel_economy_highway"),
                range_km              = car.get("range_km"),
                seats                 = car.get("seats", 4),
                description           = car.get("description"),
                depreciation_rate     = car.get("depreciation_rate", -5.0),
                investment_grade      = car.get("investment_grade", False),
                production_units      = car.get("production_units"),
                auction_record_usd    = car.get("auction_record_usd"),
                resale_value_5yr_pct  = car.get("resale_value_5yr_pct", 65.0),
                market_segment        = car.get("market_segment", "Ultra-Luxury"),
                maintenance_cost_usd  = car.get("maintenance_cost_usd"),
                insurance_rate_pct    = car.get("insurance_rate_pct", 2.0),
                images_json           = json.dumps(car.get("images", [])),
                colors_json           = json.dumps(car.get("colors", [])),
                highlights_json       = json.dumps(car.get("highlights", [])),
            )
            db.add(db_car)
            db.commit()
            count += 1
        except Exception as e:
            db.rollback()
            print(f"  ⚠ Skipped car id={car.get('id')}: {e}")
    return count


def _load_dataset() -> list:
    """Load cars.json from the same directory as this file."""
    json_path = os.path.join(os.path.dirname(__file__), "..", "cars.json")
    if not os.path.exists(json_path):
        json_path = "cars.json"
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    print("⚠  cars.json not found — database will be empty. Add cars.json next to main.py.")
    return []


# ================================================================
#  ENTRY POINT
# ================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)