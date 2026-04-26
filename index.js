const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors'); // أضيفي هذه المكتبة للسماح بالطلبات الخارجية
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // للسماح بالاتصال من أي مكان بعد الرفع
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const db = mysql.createPool({
    uri: "mysql://avnadmin:AVNS_Ciqp9f7t1WJ9xQBIfw-@mysql-28d492e5-sajaboksande-bbbb.a.aivencloud.com:21435/defaultdb",
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10
});

const driversList = [
    { id: 1, name: "أحمد", pass: "1001", car: "تويوتا كورولا", color: "أبيض" },
    { id: 2, name: "محمد", pass: "1002", car: "هيونداي أفانتي", color: "أسود" },
    { id: 3, name: "علي", pass: "1003", car: "كيا سيراتو", color: "فضي" },
    { id: 4, name: "محمود", pass: "1004", car: "نيسان صني", color: "رصاصي" },
    { id: 5, name: "سالم", pass: "1005", car: "تويوتا كامري", color: "أزرق" },
    { id: 6, name: "جمعة", pass: "1006", car: "هيونداي إلنترا", color: "أبيض" },
    { id: 7, name: "خالد", pass: "1007", car: "كيا ريو", color: "أحمر" },
    { id: 8, name: "عبد الله", pass: "1008", car: "مازدا 3", color: "بني" },
    { id: 9, name: "حسن", pass: "1009", car: "هوندا سيفيك", color: "أسود" },
    { id: 10, name: "مصطفى", pass: "1010", car: "فورد فيوجن", color: "فضي" },
    { id: 11, name: "عمر", pass: "1011", car: "تويوتا يارس", color: "أبيض" },
    { id: 12, name: "إبراهيم", pass: "1012", car: "كيا أوبتيما", color: "كحلي" },
    { id: 13, name: "ياسين", pass: "1013", car: "هيونداي سوناتا", color: "رصاصي" },
    { id: 14, name: "صالح", pass: "1014", car: "نيسان تيدا", color: "أبيض" },
    { id: 15, name: "فرج", pass: "1015", car: "تويوتا بريوس", color: "لؤلؤي" },
    { id: 16, name: "نوري", pass: "1016", car: "هيونداي توسان", color: "أسود" },
    { id: 17, name: "مفتاح", pass: "1017", car: "كيا سبورتاج", color: "أبيض" },
    { id: 18, name: "رمضان", pass: "1018", car: "ميتسوبيشي لانسر", color: "ذهبي" },
    { id: 19, name: "خليفة", pass: "1019", car: "تويوتا افالون", color: "رصاصي" },
    { id: 20, name: "فتحي", pass: "1020", car: "هيونداي أكسنت", color: "أسود" }
];

// --- تعديل مسار تسجيل الدخول (API) ---
app.post('/api/driver/login', (req, res) => {
    const { pass } = req.body;
    const driver = driversList.find(d => d.pass === String(pass));

    if (driver) {
        res.json({ success: true, driver: driver });
    } else {
        res.status(401).json({ success: false, message: "الرمز الذي أدخلته غير صحيح" });
    }
});

app.get('/api/admin/trips', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM trips ORDER BY id DESC");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Socket logic
io.on('connection', (socket) => {
    
    // دعم الطريقة القديمة عبر السوكيت لضمان عدم توقف الواجهة لديكِ
    socket.on('driver_login_attempt', (data) => {
        const driver = driversList.find(d => d.pass === String(data.pass));
        if (driver) socket.emit('login_success', driver);
        else socket.emit('login_error', "الرمز خاطئ");
    });

    socket.on('client_new_order', async (orderData) => {
        io.emit('notify_driver', orderData);
        try {
            const sql = "INSERT INTO trips (passenger_name, destination, pickup_point, status, phone) VALUES (?, ?, ?, ?, ?)";
            await db.query(sql, [orderData.name, orderData.to, `Lat: ${orderData.lat}, Lng: ${orderData.lng}`, 'في الانتظار', orderData.phone]);
        } catch (err) { console.error(err.message); }
    });

    socket.on('driver_accept_order', async (data) => {
        try {
            const [rows] = await db.query("SELECT status FROM trips WHERE passenger_name = ? AND status = 'في الانتظار' ORDER BY id DESC LIMIT 1", [data.passengerName]);
            if (rows.length > 0) {
                await db.query("UPDATE trips SET status = 'تم التأكيد', driver_name = ? WHERE passenger_name = ? AND status = 'في الانتظار' ORDER BY id DESC LIMIT 1", [data.driverName, data.passengerName]);
                const dr = driversList.find(d => d.name === data.driverName);
                io.emit('order_confirmed', { passengerName: data.passengerName, driverName: data.driverName, car: dr.car, color: dr.color });
            } else { socket.emit('order_already_taken'); }
        } catch (err) { console.error(err.message); }
    });

    socket.on('submit_rating', async (data) => {
        try { await db.query("UPDATE trips SET rating = ?, status = 'مكتملة' WHERE passenger_name = ? ORDER BY id DESC LIMIT 1", [data.stars, data.passengerName]); } catch (e) {}
    });
});

async function startApp() {
    try {
        const port = process.env.PORT || 5000; // مهم جداً لمنصة Render
        await db.query("SELECT 1");
        server.listen(port, () => console.log(`🌍 المنظومة تعمل على المنفذ ${port}`));
    } catch (err) { console.error("Database connection failed:", err.message); }
}
startApp();
