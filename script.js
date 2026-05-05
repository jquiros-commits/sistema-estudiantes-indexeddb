// ============================================
// BASE DE DATOS INDEXEDDB
// ============================================

let db = null;
let currentUser = null;

// Abrir o crear la base de datos
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SistemaEstudiantesDB', 2); // Versión 2
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            db = request.result;
            console.log('Base de datos abierta correctamente');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const oldVersion = event.oldVersion;
            
            console.log('Actualizando BD de versión', oldVersion, 'a', event.newVersion);
            
            // Crear almacén de usuarios
            if (!db.objectStoreNames.contains('usuarios')) {
                const userStore = db.createObjectStore('usuarios', { keyPath: 'id', autoIncrement: true });
                userStore.createIndex('email', 'email', { unique: true });
                console.log('Almacén "usuarios" creado');
            }
            
            // Crear almacén de estudiantes
            if (!db.objectStoreNames.contains('estudiantes')) {
                const studentStore = db.createObjectStore('estudiantes', { keyPath: 'id', autoIncrement: true });
                studentStore.createIndex('usuario_id', 'usuario_id', { unique: false });
                console.log('Almacén "estudiantes" creado');
            }
            
            // Si es versión 2, agregar usuarios de ejemplo
            if (oldVersion < 2 && db.objectStoreNames.contains('usuarios')) {
                const transaction = event.target.transaction;
                const userStore = transaction.objectStore('usuarios');
                
                // Usuarios de ejemplo
                const usuariosEjemplo = [
                    { nombre: 'Juan Pérez', email: 'juan@test.com', password: '123456', created_at: new Date().toISOString() },
                    { nombre: 'María García', email: 'maria@test.com', password: '123456', created_at: new Date().toISOString() },
                    { nombre: 'Carlos López', email: 'carlos@test.com', password: '123456', created_at: new Date().toISOString() },
                    { nombre: 'Ana Martínez', email: 'ana@test.com', password: '123456', created_at: new Date().toISOString() }
                ];
                
                usuariosEjemplo.forEach(usuario => {
                    userStore.add(usuario);
                });
                console.log('Usuarios de ejemplo agregados');
            }
        };
    });
}

// ============================================
// FUNCIONES DE USUARIOS
// ============================================

// Registrar nuevo usuario (con validación de email único)
async function registrarUsuario(nombre, email, password) {
    return new Promise((resolve, reject) => {
        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            reject(new Error('El formato del email no es válido'));
            return;
        }
        
        const transaction = db.transaction(['usuarios'], 'readwrite');
        const store = transaction.objectStore('usuarios');
        const emailIndex = store.index('email');
        
        // Verificar si el email ya existe
        const emailRequest = emailIndex.get(email);
        
        emailRequest.onsuccess = () => {
            if (emailRequest.result) {
                reject(new Error('❌ Este email ya está registrado. Usa otro correo.'));
                return;
            }
            
            // Crear nuevo usuario
            const user = {
                nombre: nombre,
                email: email,
                password: password,
                created_at: new Date().toISOString()
            };
            
            const addRequest = store.add(user);
            
            addRequest.onsuccess = () => {
                console.log('Usuario registrado:', email);
                resolve({ id: addRequest.result, ...user });
            };
            addRequest.onerror = () => reject(new Error('Error al guardar el usuario'));
        };
        
        emailRequest.onerror = () => reject(new Error('Error al verificar el email'));
    });
}

// Iniciar sesión
async function loginUsuario(email, password) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['usuarios'], 'readonly');
        const store = transaction.objectStore('usuarios');
        const emailIndex = store.index('email');
        
        const emailRequest = emailIndex.get(email);
        
        emailRequest.onsuccess = () => {
            const user = emailRequest.result;
            if (user && user.password === password) {
                console.log('Login exitoso:', email);
                resolve(user);
            } else if (user && user.password !== password) {
                reject(new Error('❌ Contraseña incorrecta'));
            } else {
                reject(new Error('❌ No existe una cuenta con este email'));
            }
        };
        
        emailRequest.onerror = () => reject(new Error('Error al buscar el email'));
    });
}

// Obtener todos los usuarios (para debug)
async function obtenerTodosUsuarios() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['usuarios'], 'readonly');
        const store = transaction.objectStore('usuarios');
        const usuarios = [];
        
        const request = store.openCursor();
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                usuarios.push({ id: cursor.value.id, nombre: cursor.value.nombre, email: cursor.value.email });
                cursor.continue();
            } else {
                resolve(usuarios);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// ============================================
// FUNCIONES DE ESTUDIANTES
// ============================================

// Registrar estudiante
async function registrarEstudiante(usuario_id, nombre_completo, carrera, semestre) {
    return new Promise((resolve, reject) => {
        if (!nombre_completo || !carrera || !semestre) {
            reject(new Error('Complete todos los campos'));
            return;
        }
        
        const transaction = db.transaction(['estudiantes'], 'readwrite');
        const store = transaction.objectStore('estudiantes');
        
        const student = {
            usuario_id: usuario_id,
            nombre_completo: nombre_completo,
            carrera: carrera,
            semestre: parseInt(semestre),
            created_at: new Date().toISOString()
        };
        
        const addRequest = store.add(student);
        
        addRequest.onsuccess = () => {
            console.log('Estudiante registrado:', nombre_completo);
            resolve({ id: addRequest.result, ...student });
        };
        addRequest.onerror = () => reject(new Error('Error al guardar el estudiante'));
    });
}

// Obtener estudiantes de un usuario
async function obtenerEstudiantes(usuario_id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['estudiantes'], 'readonly');
        const store = transaction.objectStore('estudiantes');
        const index = store.index('usuario_id');
        
        const students = [];
        const request = index.openCursor(IDBKeyRange.only(usuario_id));
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                students.push(cursor.value);
                cursor.continue();
            } else {
                resolve(students.sort((a, b) => b.id - a.id));
            }
        };
        
        request.onerror = () => reject(new Error('Error al obtener estudiantes'));
    });
}

// Eliminar estudiante
async function eliminarEstudiante(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['estudiantes'], 'readwrite');
        const store = transaction.objectStore('estudiantes');
        
        const request = store.delete(id);
        
        request.onsuccess = () => {
            console.log('Estudiante eliminado ID:', id);
            resolve(true);
        };
        request.onerror = () => reject(new Error('Error al eliminar estudiante'));
    });
}

// ============================================
// FUNCIONES DE UI Y NAVEGACIÓN
// ============================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `message ${type}`;
    setTimeout(() => {
        element.textContent = '';
        element.className = 'message';
    }, 3000);
}

function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
    } else {
        input.type = 'password';
        button.textContent = '👁️';
    }
}

// Mostrar lista de usuarios registrados (en consola para debug)
async function mostrarUsuariosRegistrados() {
    const usuarios = await obtenerTodosUsuarios();
    console.log('📋 Usuarios registrados:', usuarios);
    return usuarios;
}

// ============================================
// DASHBOARD FUNCTIONS
// ============================================

async function loadStudentsTable() {
    if (!currentUser) return;
    
    const students = await obtenerEstudiantes(currentUser.id);
    const tbody = document.getElementById('studentsTableBody');
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">📭 No hay estudiantes registrados</td></tr>';
        return;
    }
    
    tbody.innerHTML = students.map(student => {
        const fecha = new Date(student.created_at);
        const fechaStr = `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth()+1).toString().padStart(2, '0')}/${fecha.getFullYear()}`;
        
        return `
            <tr>
                <td><strong>#${student.id}</strong></td>
                <td>${escapeHtml(student.nombre_completo)}</td>
                <td>${escapeHtml(student.carrera)}</td>
                <td>${student.semestre}° Semestre</td>
                <td>${fechaStr}</td>
                <td><button class="delete-btn" onclick="deleteStudent(${student.id})">🗑 Eliminar</button></td>
            </tr>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function deleteStudent(id) {
    if (confirm('¿Estás seguro de eliminar este estudiante?')) {
        await eliminarEstudiante(id);
        await loadStudentsTable();
        showMessage('dashboardMessage', '✅ Estudiante eliminado correctamente', 'success');
    }
}

async function logout() {
    currentUser = null;
    showScreen('loginScreen');
    document.getElementById('loginForm').reset();
    document.getElementById('loginMessage').textContent = '';
    document.getElementById('registerForm').reset();
    document.getElementById('registerMessage').textContent = '';
}

// ============================================
// EVENT LISTENERS
// ============================================

// Mostrar usuarios en consola al cargar (para debug)
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎓 Sistema de Estudiantes - Para múltiples usuarios');
    console.log('💡 Puedes registrar cuantos correos quieras, siempre que no se repitan');
    console.log('📧 Ejemplos de cuentas para probar:');
    console.log('   - juan@test.com / 123456');
    console.log('   - maria@test.com / 123456');
    console.log('   - carlos@test.com / 123456');
    console.log('   - ana@test.com / 123456');
    console.log('   - O registra tus propios correos!');
});

// Registro de usuario
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombre = document.getElementById('regNombre').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    
    if (!nombre || !email || !password) {
        showMessage('registerMessage', '❌ Complete todos los campos', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showMessage('registerMessage', '❌ Las contraseñas no coinciden', 'error');
        return;
    }
    
    if (password.length < 4) {
        showMessage('registerMessage', '❌ La contraseña debe tener al menos 4 caracteres', 'error');
        return;
    }
    
    try {
        await registrarUsuario(nombre, email, password);
        showMessage('registerMessage', '✅ Registro exitoso. Redirigiendo al login...', 'success');
        document.getElementById('registerForm').reset();
        document.getElementById('passwordStrength').textContent = '';
        
        // Mostrar usuarios registrados en consola
        await mostrarUsuariosRegistrados();
        
        setTimeout(() => {
            showScreen('loginScreen');
        }, 2000);
    } catch(error) {
        showMessage('registerMessage', `❌ ${error.message}`, 'error');
    }
});

// Login de usuario
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showMessage('loginMessage', '❌ Complete todos los campos', 'error');
        return;
    }
    
    try {
        const user = await loginUsuario(email, password);
        currentUser = user;
        showMessage('loginMessage', `✅ ¡Bienvenido ${user.nombre}! Redirigiendo...`, 'success');
        
        setTimeout(async () => {
            await loadStudentsTable();
            showScreen('dashboardScreen');
            document.getElementById('loginForm').reset();
            document.getElementById('loginMessage').textContent = '';
        }, 1000);
    } catch(error) {
        showMessage('loginMessage', `❌ ${error.message}`, 'error');
    }
});

// Registrar estudiante
document.getElementById('studentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombre = document.getElementById('studentName').value.trim();
    const carrera = document.getElementById('studentCareer').value;
    const semestre = document.getElementById('studentSemester').value;
    
    if (!nombre || !carrera || !semestre) {
        showMessage('dashboardMessage', '❌ Complete todos los campos', 'error');
        return;
    }
    
    try {
        await registrarEstudiante(currentUser.id, nombre, carrera, parseInt(semestre));
        showMessage('dashboardMessage', '✅ Estudiante registrado correctamente', 'success');
        document.getElementById('studentForm').reset();
        await loadStudentsTable();
    } catch(error) {
        showMessage('dashboardMessage', `❌ ${error.message}`, 'error');
    }
});

// Cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', logout);

// Medidor de seguridad de contraseña
document.getElementById('regPassword').addEventListener('input', function() {
    const password = this.value;
    const strengthDiv = document.getElementById('passwordStrength');
    
    if (password.length === 0) {
        strengthDiv.textContent = '';
        strengthDiv.style.color = '';
    } else if (password.length < 4) {
        strengthDiv.textContent = '🔴 Débil - Mínimo 4 caracteres';
        strengthDiv.style.color = 'red';
    } else if (password.length < 6) {
        strengthDiv.textContent = '🟡 Media - Agrega más caracteres';
        strengthDiv.style.color = 'orange';
    } else if (password.length >= 6 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password)) {
        strengthDiv.textContent = '🟢 Fuerte - Buena contraseña';
        strengthDiv.style.color = 'green';
    } else {
        strengthDiv.textContent = '🟡 Media - Mezcla letras y números';
        strengthDiv.style.color = 'orange';
    }
});

// Mostrar panel de info al cargar el dashboard (opcional)
function showUserInfo() {
    if (currentUser) {
        console.log(`👤 Usuario actual: ${currentUser.nombre} (${currentUser.email})`);
    }
}

// Inicializar la aplicación
async function init() {
    try {
        await openDB();
        await mostrarUsuariosRegistrados();
        showScreen('loginScreen');
    } catch(error) {
        console.error('Error al inicializar la base de datos:', error);
        alert('Error al cargar la base de datos. Recarga la página.');
    }
}

init();