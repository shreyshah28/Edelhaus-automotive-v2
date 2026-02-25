"""
╔══════════════════════════════════════════════════════════════╗
║  EDELHAUS AUTOMOTIVE — Flask Backend                        ║
║  Uses cars.json (Kaggle dataset) + SQLite database          ║
║                                                              ║
║  Run:  python app.py                                         ║
║  Site: http://localhost:5000                                 ║
╚══════════════════════════════════════════════════════════════╝
"""

from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from datetime import datetime, timedelta
import jwt
import json
import os

# ================================================================
#  FLASK APP SETUP
# ================================================================
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY']        = os.getenv('SECRET_KEY', 'edelhaus-flask-secret-2026')
app.config['SQLALCHEMY_DATABASE_URI']        = 'sqlite:///edelhaus.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app, supports_credentials=True)
db_sql = SQLAlchemy(app)

# Admin credentials (change via env vars in production)
ADMIN_USERNAME = os.getenv('ADMIN_USER', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASS', 'edelhaus2026')
JWT_SECRET     = app.config['SECRET_KEY']

# ================================================================
#  DATABASE MODELS
# ================================================================
class Car(db_sql.Model):
    __tablename__ = 'cars'
    id                   = db_sql.Column(db_sql.Integer, primary_key=True)
    name                 = db_sql.Column(db_sql.String,  nullable=False)
    subtitle             = db_sql.Column(db_sql.String)
    category             = db_sql.Column(db_sql.String)
    brand                = db_sql.Column(db_sql.String,  nullable=False)
    badge                = db_sql.Column(db_sql.String)
    origin               = db_sql.Column(db_sql.String)
    year                 = db_sql.Column(db_sql.String)
    status               = db_sql.Column(db_sql.String,  default='Available')
    featured             = db_sql.Column(db_sql.Boolean, default=False)
    price                = db_sql.Column(db_sql.String)
    price_usd            = db_sql.Column(db_sql.Integer)
    engine               = db_sql.Column(db_sql.String)
    displacement         = db_sql.Column(db_sql.Integer)
    cylinders            = db_sql.Column(db_sql.Integer)
    fuel_type            = db_sql.Column(db_sql.String)
    transmission         = db_sql.Column(db_sql.String)
    drivetrain           = db_sql.Column(db_sql.String)
    power                = db_sql.Column(db_sql.String)
    power_hp             = db_sql.Column(db_sql.Integer)
    torque_nm            = db_sql.Column(db_sql.Integer)
    acceleration         = db_sql.Column(db_sql.String)
    top_speed_kmh        = db_sql.Column(db_sql.Integer)
    weight_kg            = db_sql.Column(db_sql.Integer)
    fuel_economy_city    = db_sql.Column(db_sql.Integer)
    fuel_economy_highway = db_sql.Column(db_sql.Integer)
    range_km             = db_sql.Column(db_sql.Integer)
    seats                = db_sql.Column(db_sql.Integer)
    description          = db_sql.Column(db_sql.Text)
    depreciation_rate    = db_sql.Column(db_sql.Float)
    investment_grade     = db_sql.Column(db_sql.Boolean, default=False)
    production_units     = db_sql.Column(db_sql.Integer)
    auction_record_usd   = db_sql.Column(db_sql.Integer)
    resale_value_5yr_pct = db_sql.Column(db_sql.Float)
    market_segment       = db_sql.Column(db_sql.String)
    maintenance_cost_usd = db_sql.Column(db_sql.Integer)
    insurance_rate_pct   = db_sql.Column(db_sql.Float)
    images_json          = db_sql.Column(db_sql.Text, default='[]')
    colors_json          = db_sql.Column(db_sql.Text, default='[]')
    highlights_json      = db_sql.Column(db_sql.Text, default='[]')
    created_at           = db_sql.Column(db_sql.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                   self.id,
            'name':                 self.name,
            'subtitle':             self.subtitle,
            'category':             self.category,
            'brand':                self.brand,
            'badge':                self.badge,
            'origin':               self.origin,
            'year':                 self.year,
            'status':               self.status,
            'featured':             self.featured,
            'price':                self.price,
            'price_usd':            self.price_usd,
            'engine':               self.engine,
            'displacement':         self.displacement,
            'cylinders':            self.cylinders,
            'fuel_type':            self.fuel_type,
            'transmission':         self.transmission,
            'drivetrain':           self.drivetrain,
            'power':                self.power,
            'power_hp':             self.power_hp,
            'torque_nm':            self.torque_nm,
            'acceleration':         self.acceleration,
            'top_speed_kmh':        self.top_speed_kmh,
            'weight_kg':            self.weight_kg,
            'fuel_economy_city':    self.fuel_economy_city,
            'fuel_economy_highway': self.fuel_economy_highway,
            'range_km':             self.range_km,
            'seats':                self.seats,
            'description':          self.description,
            'depreciation_rate':    self.depreciation_rate,
            'investment_grade':     self.investment_grade,
            'production_units':     self.production_units,
            'auction_record_usd':   self.auction_record_usd,
            'resale_value_5yr_pct': self.resale_value_5yr_pct,
            'market_segment':       self.market_segment,
            'maintenance_cost_usd': self.maintenance_cost_usd,
            'insurance_rate_pct':   self.insurance_rate_pct,
            'images':               json.loads(self.images_json   or '[]'),
            'colors':               json.loads(self.colors_json   or '[]'),
            'highlights':           json.loads(self.highlights_json or '[]'),
        }


class User(db_sql.Model):
    __tablename__ = 'users'
    id            = db_sql.Column(db_sql.Integer, primary_key=True)
    name          = db_sql.Column(db_sql.String,  nullable=False)
    email         = db_sql.Column(db_sql.String,  unique=True, nullable=False)
    password_hash = db_sql.Column(db_sql.String,  nullable=False)
    phone         = db_sql.Column(db_sql.String,  default='')
    country       = db_sql.Column(db_sql.String,  default='')
    created_at    = db_sql.Column(db_sql.DateTime, default=datetime.utcnow)


class TestDrive(db_sql.Model):
    __tablename__ = 'test_drives'
    id         = db_sql.Column(db_sql.Integer,  primary_key=True)
    user_name  = db_sql.Column(db_sql.String)
    user_email = db_sql.Column(db_sql.String)
    user_phone = db_sql.Column(db_sql.String)
    car_id     = db_sql.Column(db_sql.Integer)
    car_name   = db_sql.Column(db_sql.String)
    date       = db_sql.Column(db_sql.String)
    time       = db_sql.Column(db_sql.String)
    notes      = db_sql.Column(db_sql.Text)
    status     = db_sql.Column(db_sql.String,   default='Pending')
    timestamp  = db_sql.Column(db_sql.DateTime, default=datetime.utcnow)


class Service(db_sql.Model):
    __tablename__ = 'services'
    id           = db_sql.Column(db_sql.Integer,  primary_key=True)
    name         = db_sql.Column(db_sql.String)
    phone        = db_sql.Column(db_sql.String)
    car          = db_sql.Column(db_sql.String)
    service_type = db_sql.Column(db_sql.String)
    date         = db_sql.Column(db_sql.String)
    time         = db_sql.Column(db_sql.String)
    notes        = db_sql.Column(db_sql.Text)
    status       = db_sql.Column(db_sql.String,   default='Pending')
    timestamp    = db_sql.Column(db_sql.DateTime, default=datetime.utcnow)


class Inquiry(db_sql.Model):
    __tablename__ = 'inquiries'
    id           = db_sql.Column(db_sql.Integer,  primary_key=True)
    name         = db_sql.Column(db_sql.String)
    email        = db_sql.Column(db_sql.String)
    phone        = db_sql.Column(db_sql.String,   default='')
    message      = db_sql.Column(db_sql.Text)
    car_interest = db_sql.Column(db_sql.String,   default='')
    status       = db_sql.Column(db_sql.String,   default='Pending')
    created_at   = db_sql.Column(db_sql.DateTime, default=datetime.utcnow)


# ================================================================
#  JWT AUTH HELPERS
# ================================================================
def make_token(payload: dict, hours: int = 24) -> str:
    payload = {**payload, 'exp': datetime.utcnow() + timedelta(hours=hours)}
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def decode_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        return None


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'detail': 'Admin authentication required'}), 401
        payload = decode_token(auth.split(' ', 1)[1])
        if not payload or payload.get('role') != 'admin':
            return jsonify({'detail': 'Invalid or expired admin token'}), 401
        return f(*args, **kwargs)
    return decorated


def require_user(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'detail': 'Login required'}), 401
        payload = decode_token(auth.split(' ', 1)[1])
        if not payload:
            return jsonify({'detail': 'Invalid or expired token'}), 401
        return f(*args, **kwargs)
    return decorated


# ================================================================
#  SERVE STATIC HTML FILES
# ================================================================
@app.route('/')
def index():
    return send_from_directory('.', 'help.html')

@app.route('/admin')
def admin():
    return send_from_directory('.', 'admin.html')

@app.route('/help')
def help_page():
    return send_from_directory('.', 'help.html')

@app.route('/car-detail')
def car_detail():
    return send_from_directory('.', 'car-detail.html')

# Serve static files (js, css, images, car photo folders)
@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)


# ================================================================
#  HEALTH CHECK
# ================================================================
@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'service': 'Edelhaus Automotive API (Flask)', 'version': '3.0.0'})


# ================================================================
#  CAR ENDPOINTS
# ================================================================
@app.route('/api/cars', methods=['GET'])
def get_cars():
    q = Car.query
    category         = request.args.get('category')
    brand            = request.args.get('brand')
    status           = request.args.get('status')
    featured         = request.args.get('featured')
    fuel_type        = request.args.get('fuel_type')
    investment_grade = request.args.get('investment_grade')
    search           = request.args.get('search')

    if category:         q = q.filter(Car.category == category)
    if brand:            q = q.filter(Car.brand == brand)
    if status:           q = q.filter(Car.status == status)
    if featured is not None:
        q = q.filter(Car.featured == (featured.lower() == 'true'))
    if fuel_type:        q = q.filter(Car.fuel_type == fuel_type)
    if investment_grade is not None:
        q = q.filter(Car.investment_grade == (investment_grade.lower() == 'true'))
    if search:
        s = f'%{search}%'
        q = q.filter(
            Car.name.ilike(s) | Car.brand.ilike(s) | Car.description.ilike(s)
        )
    return jsonify([c.to_dict() for c in q.all()])


@app.route('/api/cars/<int:car_id>', methods=['GET'])
def get_car(car_id):
    c = Car.query.get(car_id)
    if not c:
        return jsonify({'detail': 'Car not found'}), 404
    return jsonify(c.to_dict())


@app.route('/api/cars', methods=['POST'])
@require_admin
def add_car():
    data = request.get_json()
    car = Car(
        name         = data.get('name', ''),
        subtitle     = data.get('subtitle'),
        category     = data.get('category'),
        brand        = data.get('brand', ''),
        badge        = data.get('badge'),
        origin       = data.get('origin'),
        year         = data.get('year'),
        status       = data.get('status', 'Available'),
        featured     = data.get('featured', False),
        price        = data.get('price'),
        price_usd    = data.get('price_usd'),
        engine       = data.get('engine'),
        fuel_type    = data.get('fuel_type', 'Gasoline'),
        drivetrain   = data.get('drivetrain', 'RWD'),
        power        = data.get('power'),
        power_hp     = data.get('power_hp'),
        torque_nm    = data.get('torque_nm'),
        acceleration = data.get('acceleration'),
        top_speed_kmh= data.get('top_speed_kmh'),
        weight_kg    = data.get('weight_kg'),
        seats        = data.get('seats', 4),
        description  = data.get('description'),
        investment_grade = data.get('investment_grade', False),
        market_segment   = data.get('market_segment', 'Ultra-Luxury'),
        images_json  = json.dumps(data.get('images', [])),
        colors_json  = json.dumps(data.get('colors', [])),
        highlights_json = json.dumps(data.get('highlights', [])),
    )
    db_sql.session.add(car)
    db_sql.session.commit()
    return jsonify(car.to_dict()), 201


@app.route('/api/cars/<int:car_id>', methods=['PUT'])
@require_admin
def update_car(car_id):
    c = Car.query.get(car_id)
    if not c:
        return jsonify({'detail': 'Car not found'}), 404
    data = request.get_json()
    for field in ['name','subtitle','category','brand','badge','origin','year','status',
                  'featured','price','price_usd','engine','fuel_type','drivetrain',
                  'power','power_hp','torque_nm','acceleration','top_speed_kmh',
                  'weight_kg','seats','description','investment_grade','market_segment']:
        if field in data:
            setattr(c, field, data[field])
    if 'images'     in data: c.images_json     = json.dumps(data['images'])
    if 'colors'     in data: c.colors_json     = json.dumps(data['colors'])
    if 'highlights' in data: c.highlights_json = json.dumps(data['highlights'])
    db_sql.session.commit()
    return jsonify(c.to_dict())


@app.route('/api/cars/<int:car_id>', methods=['DELETE'])
@require_admin
def delete_car(car_id):
    c = Car.query.get(car_id)
    if not c:
        return jsonify({'detail': 'Car not found'}), 404
    db_sql.session.delete(c)
    db_sql.session.commit()
    return jsonify({'message': 'Deleted'})


@app.route('/api/cars/<int:car_id>/status', methods=['PATCH'])
@require_admin
def set_car_status(car_id):
    c = Car.query.get(car_id)
    if not c:
        return jsonify({'detail': 'Car not found'}), 404
    c.status = request.get_json().get('status', c.status)
    db_sql.session.commit()
    return jsonify({'message': 'Status updated', 'status': c.status})


# ================================================================
#  AUTH — USER
# ================================================================
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'detail': 'Email already registered'}), 400
    user = User(
        name          = data['name'],
        email         = data['email'],
        password_hash = generate_password_hash(data['password']),
        phone         = data.get('phone', ''),
        country       = data.get('country', ''),
    )
    db_sql.session.add(user)
    db_sql.session.commit()
    token = make_token({'user_id': user.id, 'email': user.email, 'role': 'user'})
    return jsonify({'token': token, 'name': user.name, 'email': user.email}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'detail': 'Invalid email or password'}), 401
    token = make_token({'user_id': user.id, 'email': user.email, 'role': 'user'})
    return jsonify({'token': token, 'name': user.name, 'email': user.email})


@app.route('/api/users/me/phone', methods=['PUT'])
@require_user
def update_phone():
    auth    = request.headers.get('Authorization', '').split(' ', 1)[1]
    payload = decode_token(auth)
    user    = User.query.get(payload['user_id'])
    user.phone = request.get_json().get('phone', user.phone)
    db_sql.session.commit()
    return jsonify({'message': 'Phone updated'})


# ================================================================
#  AUTH — ADMIN
# ================================================================
@app.route('/api/auth/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    if data.get('username') != ADMIN_USERNAME or data.get('password') != ADMIN_PASSWORD:
        return jsonify({'detail': 'Invalid admin credentials'}), 401
    token = make_token({'role': 'admin', 'username': ADMIN_USERNAME}, hours=12)
    return jsonify({'token': token, 'username': ADMIN_USERNAME})


# ================================================================
#  USERS (admin)
# ================================================================
@app.route('/api/users', methods=['GET'])
@require_admin
def get_users():
    users = User.query.all()
    return jsonify([
        {'id': u.id, 'name': u.name, 'email': u.email,
         'phone': u.phone, 'country': u.country,
         'joined': str(u.created_at)[:10]}
        for u in users
    ])


@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@require_admin
def delete_user(user_id):
    u = User.query.get(user_id)
    if not u:
        return jsonify({'detail': 'Not found'}), 404
    db_sql.session.delete(u)
    db_sql.session.commit()
    return jsonify({'message': 'Deleted'})


# ================================================================
#  TEST DRIVES
# ================================================================
@app.route('/api/testdrives', methods=['POST'])
def book_test_drive():
    data = request.get_json()
    td = TestDrive(
        user_name  = data.get('user_name', ''),
        user_email = data.get('user_email', ''),
        user_phone = data.get('user_phone', ''),
        car_id     = data.get('car_id'),
        car_name   = data.get('car_name', ''),
        date       = data.get('date', ''),
        time       = data.get('time', ''),
        notes      = data.get('notes', ''),
    )
    db_sql.session.add(td)
    db_sql.session.commit()
    return jsonify({'id': td.id, 'message': 'Test drive booked'}), 201


@app.route('/api/testdrives', methods=['GET'])
@require_admin
def get_test_drives():
    rows = TestDrive.query.order_by(TestDrive.timestamp.desc()).all()
    return jsonify([
        {'id': r.id, 'user_name': r.user_name, 'user_email': r.user_email,
         'user_phone': r.user_phone, 'car_name': r.car_name,
         'date': r.date, 'time': r.time, 'notes': r.notes,
         'status': r.status, 'timestamp': str(r.timestamp)[:16]}
        for r in rows
    ])


@app.route('/api/testdrives/user/<email>', methods=['GET'])
def get_user_test_drives(email):
    rows = TestDrive.query.filter_by(user_email=email).order_by(TestDrive.timestamp.desc()).all()
    return jsonify([
        {'id': r.id, 'car_name': r.car_name, 'date': r.date,
         'time': r.time, 'status': r.status}
        for r in rows
    ])


@app.route('/api/testdrives/<int:td_id>', methods=['PUT'])
@require_admin
def update_test_drive(td_id):
    td = TestDrive.query.get(td_id)
    if not td:
        return jsonify({'detail': 'Not found'}), 404
    td.status = request.get_json().get('status', td.status)
    db_sql.session.commit()
    return jsonify({'message': 'Updated'})


@app.route('/api/testdrives/<int:td_id>', methods=['DELETE'])
@require_admin
def delete_test_drive(td_id):
    td = TestDrive.query.get(td_id)
    if not td:
        return jsonify({'detail': 'Not found'}), 404
    db_sql.session.delete(td)
    db_sql.session.commit()
    return jsonify({'message': 'Deleted'})


# ================================================================
#  SERVICE APPOINTMENTS
# ================================================================
@app.route('/api/services', methods=['POST'])
def book_service():
    data = request.get_json()
    svc = Service(
        name         = data.get('name', ''),
        phone        = data.get('phone', ''),
        car          = data.get('car', ''),
        service_type = data.get('service_type', ''),
        date         = data.get('date', ''),
        time         = data.get('time', ''),
        notes        = data.get('notes', ''),
    )
    db_sql.session.add(svc)
    db_sql.session.commit()
    return jsonify({'id': svc.id, 'message': 'Service booked'}), 201


@app.route('/api/services', methods=['GET'])
@require_admin
def get_services():
    rows = Service.query.order_by(Service.timestamp.desc()).all()
    return jsonify([
        {'id': r.id, 'name': r.name, 'phone': r.phone, 'car': r.car,
         'service_type': r.service_type, 'date': r.date, 'time': r.time,
         'notes': r.notes, 'status': r.status, 'timestamp': str(r.timestamp)[:16]}
        for r in rows
    ])


@app.route('/api/services/<int:svc_id>', methods=['PUT'])
@require_admin
def update_service(svc_id):
    svc = Service.query.get(svc_id)
    if not svc:
        return jsonify({'detail': 'Not found'}), 404
    svc.status = request.get_json().get('status', svc.status)
    db_sql.session.commit()
    return jsonify({'message': 'Updated'})


# ================================================================
#  INQUIRIES
# ================================================================
@app.route('/api/inquiries', methods=['POST'])
def submit_inquiry():
    data = request.get_json()
    inq = Inquiry(
        name         = data.get('name', ''),
        email        = data.get('email', ''),
        phone        = data.get('phone', ''),
        message      = data.get('message', ''),
        car_interest = data.get('car_interest', ''),
    )
    db_sql.session.add(inq)
    db_sql.session.commit()
    return jsonify({'id': inq.id, 'message': 'Inquiry received'}), 201


@app.route('/api/inquiries', methods=['GET'])
@require_admin
def get_inquiries():
    rows = Inquiry.query.order_by(Inquiry.created_at.desc()).all()
    return jsonify([
        {'id': r.id, 'name': r.name, 'email': r.email, 'phone': r.phone,
         'message': r.message, 'car_interest': r.car_interest,
         'status': r.status, 'date': str(r.created_at)[:10]}
        for r in rows
    ])


@app.route('/api/inquiries/<int:inq_id>', methods=['PUT'])
@require_admin
def update_inquiry(inq_id):
    inq = Inquiry.query.get(inq_id)
    if not inq:
        return jsonify({'detail': 'Not found'}), 404
    inq.status = request.get_json().get('status', inq.status)
    db_sql.session.commit()
    return jsonify({'message': 'Updated'})


@app.route('/api/inquiries/<int:inq_id>', methods=['DELETE'])
@require_admin
def delete_inquiry(inq_id):
    inq = Inquiry.query.get(inq_id)
    if not inq:
        return jsonify({'detail': 'Not found'}), 404
    db_sql.session.delete(inq)
    db_sql.session.commit()
    return jsonify({'message': 'Deleted'})


# ================================================================
#  ANALYTICS
# ================================================================
@app.route('/api/analytics', methods=['GET'])
@require_admin
def get_analytics():
    from sqlalchemy import func

    totals = {
        'cars':             Car.query.count(),
        'users':            User.query.count(),
        'testDrives':       TestDrive.query.count(),
        'inquiries':        Inquiry.query.count(),
        'services':         Service.query.count(),
        'pendingTD':        TestDrive.query.filter_by(status='Pending').count(),
        'pendingInquiries': Inquiry.query.filter_by(status='Pending').count(),
        'availableCars':    Car.query.filter_by(status='Available').count(),
        'investmentCars':   Car.query.filter_by(investment_grade=True).count(),
    }

    brands   = db_sql.session.query(Car.brand, func.count(Car.id)).group_by(Car.brand).all()
    fuels    = db_sql.session.query(Car.fuel_type, func.count(Car.id)).group_by(Car.fuel_type).all()
    segments = db_sql.session.query(Car.market_segment, func.count(Car.id)).group_by(Car.market_segment).all()
    avg_p    = db_sql.session.query(func.avg(Car.price_usd)).filter(Car.price_usd.isnot(None)).scalar() or 0
    invest_cars = Car.query.filter_by(investment_grade=True).order_by(Car.depreciation_rate.desc()).all()
    top_priced  = Car.query.filter(Car.price_usd.isnot(None)).order_by(Car.price_usd.desc()).limit(5).all()

    return jsonify({
        'totals':      totals,
        'avgPriceUsd': round(avg_p),
        'brands':      [{'brand': b, 'count': c} for b, c in brands],
        'fuelTypes':   [{'fuel_type': f, 'count': c} for f, c in fuels],
        'segments':    [{'segment': s, 'count': c} for s, c in segments],
        'investmentGradeCars': [
            {'name': c.name, 'brand': c.brand, 'price': c.price,
             'appreciation': f'+{c.depreciation_rate:.1f}%/yr' if (c.depreciation_rate or 0) > 0 else f'{c.depreciation_rate:.1f}%/yr',
             'production_units': c.production_units, 'market_segment': c.market_segment}
            for c in invest_cars
        ],
        'topPricedCars': [c.to_dict() for c in top_priced],
    })


# ================================================================
#  SEED — loads cars.json (Kaggle dataset)
# ================================================================
@app.route('/api/seed', methods=['POST'])
@require_admin
def reseed():
    Car.query.delete()
    db_sql.session.commit()
    count = _seed_database()
    return jsonify({'message': f'Seeded {count} cars from dataset'})


def _load_dataset():
    for path in ['cars.json', '../cars.json', os.path.join(os.path.dirname(__file__), 'cars.json')]:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
    print('⚠  cars.json not found!')
    return []


def _seed_database():
    data  = _load_dataset()
    count = 0
    for car in data:
        try:
            c = Car(
                id                   = car.get('id'),
                name                 = car.get('name', ''),
                subtitle             = car.get('subtitle'),
                category             = car.get('category'),
                brand                = car.get('brand', ''),
                badge                = car.get('badge'),
                origin               = car.get('origin'),
                year                 = car.get('year'),
                status               = car.get('status', 'Available'),
                featured             = car.get('featured', False),
                price                = car.get('price'),
                price_usd            = car.get('price_usd'),
                engine               = car.get('engine'),
                displacement         = car.get('displacement'),
                cylinders            = car.get('cylinders'),
                fuel_type            = car.get('fuel_type', 'Gasoline'),
                transmission         = car.get('transmission'),
                drivetrain           = car.get('drivetrain'),
                power                = car.get('power'),
                power_hp             = car.get('power_hp'),
                torque_nm            = car.get('torque_nm'),
                acceleration         = car.get('acceleration'),
                top_speed_kmh        = car.get('top_speed_kmh'),
                weight_kg            = car.get('weight_kg'),
                fuel_economy_city    = car.get('fuel_economy_city'),
                fuel_economy_highway = car.get('fuel_economy_highway'),
                range_km             = car.get('range_km'),
                seats                = car.get('seats', 4),
                description          = car.get('description'),
                depreciation_rate    = car.get('depreciation_rate', -5.0),
                investment_grade     = car.get('investment_grade', False),
                production_units     = car.get('production_units'),
                auction_record_usd   = car.get('auction_record_usd'),
                resale_value_5yr_pct = car.get('resale_value_5yr_pct', 65.0),
                market_segment       = car.get('market_segment', 'Ultra-Luxury'),
                maintenance_cost_usd = car.get('maintenance_cost_usd'),
                insurance_rate_pct   = car.get('insurance_rate_pct', 2.0),
                images_json          = json.dumps(car.get('images', [])),
                colors_json          = json.dumps(car.get('colors', [])),
                highlights_json      = json.dumps(car.get('highlights', [])),
            )
            db_sql.session.add(c)
            db_sql.session.commit()
            count += 1
        except Exception as e:
            db_sql.session.rollback()
            print(f'  ⚠ Skipped car id={car.get("id")}: {e}')
    return count


# ================================================================
#  STARTUP — create tables + auto-seed
# ================================================================
with app.app_context():
    db_sql.create_all()
    if Car.query.count() == 0:
        print('🌱 Seeding database from cars.json ...')
        n = _seed_database()
        print(f'✅ Seeded {n} cars.')


# ================================================================
#  ENTRY POINT
# ================================================================
if __name__ == '__main__':
    print('\n' + '='*55)
    print('  🚗  EDELHAUS AUTOMOTIVE — Flask Server')
    print('  🌐  Site:  http://localhost:5000')
    print('  🔧  Admin: http://localhost:5000/admin')
    print('  📡  API:   http://localhost:5000/api/health')
    print('='*55 + '\n')
    app.run(debug=True, port=5000)