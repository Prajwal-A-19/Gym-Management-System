const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'gym.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error opening database', err);
    else console.log('Connected to GymPro SQLite database.');
});

// Enable foreign key enforcement (SQLite disables it by default)
db.run('PRAGMA foreign_keys = ON');

function initDb() {
    db.serialize(() => {

        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('Admin', 'Trainer', 'Member')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            duration_days INTEGER DEFAULT 30,
            features TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS trainers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            specialization TEXT,
            bio TEXT,
            experience_years INTEGER DEFAULT 0,
            hourly_rate REAL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            date_of_birth TEXT,
            gender TEXT CHECK(gender IN ('Male','Female','Other')),
            address TEXT,
            emergency_contact TEXT,
            emergency_phone TEXT,
            status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Paused', 'Inactive', 'Expired')),
            plan_id INTEGER,
            trainer_id INTEGER,
            plan_start_date TEXT,
            plan_end_date TEXT,
            join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            profile_notes TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE SET NULL,
            FOREIGN KEY (trainer_id) REFERENCES users (id) ON DELETE SET NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            check_out_time DATETIME,
            notes TEXT,
            FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS workouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            trainer_id INTEGER,
            day TEXT NOT NULL,
            workout_name TEXT NOT NULL,
            sets INTEGER,
            reps TEXT,
            weight TEXT,
            duration_mins INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
            FOREIGN KEY (trainer_id) REFERENCES users (id) ON DELETE SET NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            plan_id INTEGER,
            amount REAL NOT NULL,
            method TEXT DEFAULT 'Cash' CHECK(method IN ('Cash','Card','UPI','Bank Transfer','Other')),
            status TEXT DEFAULT 'Paid' CHECK(status IN ('Paid','Pending','Failed','Refunded')),
            payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            due_date TEXT,
            notes TEXT,
            receipt_no TEXT,
            FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
            FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE SET NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS equipment (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            brand TEXT,
            quantity INTEGER DEFAULT 1,
            condition TEXT DEFAULT 'Good' CHECK(condition IN ('Excellent','Good','Fair','Poor','Out of Service')),
            purchase_date TEXT,
            last_maintenance TEXT,
            next_maintenance TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            trainer_id INTEGER,
            schedule_day TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            capacity INTEGER DEFAULT 20,
            category TEXT,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (trainer_id) REFERENCES users (id) ON DELETE SET NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS class_enrollments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id INTEGER NOT NULL,
            member_id INTEGER NOT NULL,
            enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(class_id, member_id),
            FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
            FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS body_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            recorded_date TEXT DEFAULT (date('now')),
            weight_kg REAL,
            height_cm REAL,
            body_fat_pct REAL,
            muscle_mass_kg REAL,
            bmi REAL,
            chest_cm REAL,
            waist_cm REAL,
            hips_cm REAL,
            bicep_cm REAL,
            notes TEXT,
            FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            target_date TEXT,
            status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Completed','Cancelled')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            audience TEXT DEFAULT 'All' CHECK(audience IN ('All','Members','Trainers')),
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT,
            FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
        )`);

        // Seed
        db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
            if (row && row.count === 0) {
                console.log("Seeding GymPro database...");
                const adminHash = await bcrypt.hash('admin123', 10);
                const trainerHash = await bcrypt.hash('trainer123', 10);
                const memberHash = await bcrypt.hash('member123', 10);

                db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['admin', adminHash, 'Admin']);
                db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['trainer1', trainerHash, 'Trainer'], function() {
                    const tid = this.lastID;
                    db.run("INSERT INTO trainers (user_id, first_name, last_name, email, phone, specialization, bio, experience_years, hourly_rate) VALUES (?,?,?,?,?,?,?,?,?)",
                        [tid, 'Ravi', 'Kumar', 'ravi@gym.com', '9876543210', 'Strength & Conditioning', 'Certified strength coach with 8 years experience.', 8, 800]);
                });
                db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['trainer2', trainerHash, 'Trainer'], function() {
                    const tid = this.lastID;
                    db.run("INSERT INTO trainers (user_id, first_name, last_name, email, phone, specialization, bio, experience_years, hourly_rate) VALUES (?,?,?,?,?,?,?,?,?)",
                        [tid, 'Priya', 'Sharma', 'priya@gym.com', '9876543211', 'Yoga & Flexibility', 'Yoga instructor and wellness coach.', 5, 600]);
                });

                db.run("INSERT INTO plans (name, price, duration_days, features) VALUES ('Starter', 999, 30, 'Gym Access|Locker Room|Basic Equipment')");
                db.run("INSERT INTO plans (name, price, duration_days, features) VALUES ('Pro', 1999, 30, 'Gym Access|Group Classes|Locker Room|All Equipment|Nutrition Guide')");
                db.run("INSERT INTO plans (name, price, duration_days, features) VALUES ('Elite', 3499, 30, 'All Pro Features|Personal Trainer (4 sessions)|Diet Plan|Body Analysis')");
                db.run("INSERT INTO plans (name, price, duration_days, features) VALUES ('Annual Pro', 14999, 365, 'All Pro Features|Priority Booking|Annual Health Report')");

                db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['john_d', memberHash, 'Member'], function() {
                    const uid = this.lastID;
                    db.run("INSERT INTO members (user_id, first_name, last_name, email, phone, gender, plan_id, trainer_id, plan_start_date, plan_end_date) VALUES (?,?,?,?,?,?,2,2,date('now'),date('now','+30 days'))",
                        [uid, 'John', 'Doe', 'john@email.com', '9000000001', 'Male']);
                });
                db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['sara_m', memberHash, 'Member'], function() {
                    const uid = this.lastID;
                    db.run("INSERT INTO members (user_id, first_name, last_name, email, phone, gender, plan_id, plan_start_date, plan_end_date) VALUES (?,?,?,?,?,?,3,date('now'),date('now','+30 days'))",
                        [uid, 'Sara', 'Mehta', 'sara@email.com', '9000000002', 'Female']);
                });

                // Equipment
                const equip = [
                    ['Treadmill', 'Cardio', 'LifeFitness', 6, 'Good'],
                    ['Barbell Set', 'Free Weights', 'Rogue', 10, 'Excellent'],
                    ['Bench Press', 'Strength', 'Body-Solid', 4, 'Good'],
                    ['Dumbbells (5-50kg)', 'Free Weights', 'Decathlon', 1, 'Good'],
                    ['Rowing Machine', 'Cardio', 'Concept2', 3, 'Excellent'],
                    ['Pull-up Bar', 'Bodyweight', 'Generic', 5, 'Fair'],
                    ['Leg Press Machine', 'Strength', 'Precor', 2, 'Good'],
                    ['Battle Ropes', 'Functional', 'Valor Fitness', 2, 'Good'],
                ];
                equip.forEach(e => db.run("INSERT INTO equipment (name, category, brand, quantity, condition) VALUES (?,?,?,?,?)", e));

                // Classes
                const classes = [
                    ['HIIT Blast', 2, 'Monday', '06:00', '07:00', 20, 'Cardio', 'High intensity interval training'],
                    ['Yoga Flow', 3, 'Tuesday', '07:00', '08:00', 15, 'Yoga', 'Morning yoga and flexibility'],
                    ['Strength Circuit', 2, 'Wednesday', '18:00', '19:00', 20, 'Strength', 'Full body strength circuit'],
                    ['Zumba Dance', 3, 'Thursday', '19:00', '20:00', 25, 'Dance', 'Fun dance fitness class'],
                    ['CrossFit WOD', 2, 'Friday', '06:00', '07:00', 15, 'CrossFit', 'Workout of the day'],
                    ['Pilates Core', 3, 'Saturday', '08:00', '09:00', 12, 'Pilates', 'Core strength and posture'],
                ];
                classes.forEach(c => db.run("INSERT INTO classes (name, trainer_id, schedule_day, start_time, end_time, capacity, category, description) VALUES (?,?,?,?,?,?,?,?)", c));

                // Announcement
                db.run("INSERT INTO announcements (title, body, audience, created_by) VALUES (?,?,?,?)",
                    ['Welcome to GymPro!', 'We are excited to have you here. Check out our new class schedule and reach your fitness goals!', 'All', 1]);
                db.run("INSERT INTO announcements (title, body, audience, created_by) VALUES (?,?,?,?)",
                    ['Gym Closed — Republic Day', 'The gym will be closed on 26th January. Happy Republic Day!', 'All', 1]);
            }
        });
    });
}

initDb();

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(this); });
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => { if (err) reject(err); else resolve(result); });
});
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
});

module.exports = { db, dbRun, dbGet, dbAll };
