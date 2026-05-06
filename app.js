const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

// --- CONFIGURACIÓN DE STORAGE PARA IMÁGENES ---
const storage = multer.diskStorage({
    destination: path.join(__dirname, 'public/uploads'),
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// --- MIDDLEWARES ---
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// --- CONEXIÓN A MYSQL (ACTUALIZADA PARA AIVEN) ---
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 24617,
    ssl: {
        rejectUnauthorized: false // Esto permite la conexión segura con Aiven
    }
});

db.connect(err => {
    if (err) {
        console.error('Error de conexión a la BD: ' + err.stack);
        return;
    }
    console.log('Conectado a MySQL Workbench');
});

// --- RUTAS DEL CRUD EVALUACIONES ---

// 1. LISTAR (READ)
app.get('/', (req, res) => {
    const sql = `SELECT e.*, c.nombre_curso 
                 FROM evaluaciones e 
                 INNER JOIN cursos c ON e.id_curso = c.id_curso`;
    
    db.query(sql, (err, rows) => {
        if (err) throw err;
        db.query('SELECT * FROM cursos', (err, categorias) => {
            res.render('index', { evaluaciones: rows, cursos: categorias });
        });
    });
});

// 2. CREAR (CREATE)
app.post('/save', upload.single('archivo'), (req, res) => {
    const { titulo, id_curso } = req.body;
    const archivo = req.file ? req.file.filename : null;

    if (!titulo || !id_curso) {
        return res.send("Error: Título y Curso son obligatorios.");
    }

    const sql = 'INSERT INTO evaluaciones (titulo, archivo, id_curso) VALUES (?, ?, ?)';
    db.query(sql, [titulo, archivo, id_curso], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// 3. ELIMINAR (DELETE)
app.get('/delete/:id', (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM evaluaciones WHERE id_evaluacion = ?', [id], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// 4. EDITAR (UPDATE) - Vista
app.get('/edit/:id', (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM evaluaciones WHERE id_evaluacion = ?', [id], (err, row) => {
        db.query('SELECT * FROM cursos', (err, categorias) => {
            res.render('edit', { eval: row[0], cursos: categorias });
        });
    });
});

// 5. ACTUALIZAR (UPDATE) - Lógica
app.post('/update', upload.single('archivo'), (req, res) => {
    const { id_evaluacion, titulo, id_curso, old_archivo } = req.body;
    let nuevo_archivo = old_archivo;

    if (req.file) {
        nuevo_archivo = req.file.filename;
    }

    const sql = 'UPDATE evaluaciones SET titulo = ?, archivo = ?, id_curso = ? WHERE id_evaluacion = ?';
    db.query(sql, [titulo, nuevo_archivo, id_curso, id_evaluacion], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// --- NUEVAS RUTAS: CRUD DE CURSOS (CATEGORÍAS) ---

// Listar cursos
app.get('/cursos', (req, res) => {
    db.query('SELECT * FROM cursos', (err, rows) => {
        if (err) throw err;
        res.render('cursos', { cursos: rows });
    });
});

// Guardar nuevo curso
app.post('/cursos/save', (req, res) => {
    const { nombre_curso } = req.body;
    if (!nombre_curso) return res.send("Nombre obligatorio");
    
    db.query('INSERT INTO cursos (nombre_curso) VALUES (?)', [nombre_curso], (err) => {
        if (err) throw err;
        res.redirect('/cursos');
    });
});

// Eliminar curso
app.get('/cursos/delete/:id', (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM cursos WHERE id_curso = ?', [id], (err) => {
        if (err) throw err;
        res.redirect('/cursos');
    });
});

// INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});