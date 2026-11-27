// --- INITIALISATION THREE.JS (Espace 3D & Étoiles Rondes) ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02040a, 0.0015);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x02040a, 1);
container.appendChild(renderer.domElement);

// Texture circulaire générée sur Canvas pour des étoiles parfaitement rondes
function createCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(200, 220, 255, 0.8)');
    gradient.addColorStop(0.6, 'rgba(100, 150, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
    
    return new THREE.CanvasTexture(canvas);
}

// Nuage d'étoiles rondes
const starsCount = 1500;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(starsCount * 3);
const colors = new Float32Array(starsCount * 3);

for (let i = 0; i < starsCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 120;
    positions[i + 1] = (Math.random() - 0.5) * 120;
    positions[i + 2] = (Math.random() - 0.5) * 120;

    colors[i] = 0.8 + Math.random() * 0.2;
    colors[i + 1] = 0.85 + Math.random() * 0.15;
    colors[i + 2] = 1.0;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
    size: 0.6,
    map: createCircleTexture(),
    transparent: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const starField = new THREE.Points(geometry, material);
scene.add(starField);

// Contrôle de rotation tactile / souris
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let targetRotationX = 0;
let targetRotationY = 0;

function onPointerDown(e) {
    isDragging = true;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    previousMousePosition = { x, y };
}

function onPointerMove(e) {
    if (!isDragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;

    const deltaX = x - previousMousePosition.x;
    const deltaY = y - previousMousePosition.y;

    targetRotationY += deltaX * 0.003;
    targetRotationX += deltaY * 0.003;

    previousMousePosition = { x, y };
}

function onPointerUp() {
    isDragging = false;
}

window.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);
window.addEventListener('touchstart', onPointerDown, { passive: true });
window.addEventListener('touchmove', onPointerMove, { passive: true });
window.addEventListener('touchend', onPointerUp);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);

    // Animation fluide par inertie
    starField.rotation.y += (targetRotationY - starField.rotation.y) * 0.05;
    starField.rotation.x += (targetRotationX - starField.rotation.x) * 0.05;
    starField.rotation.z += 0.0003; // Rotation lente automatique de fond

    renderer.render(scene, camera);
}
animate();

// --- LOGIQUE RESEAU PEERJS (P2P Fiabilisé) ---
const ROOM_PREFIX = "space-chat-room-v1-";
let peer = null;
let currentConn = null;
let isConnected = false;

const actionBtn = document.getElementById('action-btn');
const statusBadge = document.getElementById('status-badge');
const messagesContainer = document.getElementById('messages-container');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

function updateUI(status) {
    switch (status) {
        case 'disconnected':
            statusBadge.textContent = 'Hors ligne';
            statusBadge.className = 'px-3 py-1 rounded-full text-xs font-medium tracking-wide bg-white/10 backdrop-blur-md border border-white/10 text-white/70';
            actionBtn.textContent = 'Se connecter';
            actionBtn.disabled = false;
            messageInput.disabled = true;
            sendBtn.disabled = true;
            break;
        case 'connecting':
            statusBadge.textContent = 'Recherche...';
            statusBadge.className = 'px-3 py-1 rounded-full text-xs font-medium tracking-wide bg-amber-500/20 backdrop-blur-md border border-amber-500/30 text-amber-200';
            actionBtn.textContent = 'Annuler';
            actionBtn.disabled = false;
            messageInput.disabled = true;
            sendBtn.disabled = true;
            break;
        case 'connected':
            statusBadge.textContent = 'Connecté';
            statusBadge.className = 'px-3 py-1 rounded-full text-xs font-medium tracking-wide bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-200';
            actionBtn.textContent = 'Quitter';
            actionBtn.disabled = false;
            messageInput.disabled = false;
            sendBtn.disabled = false;
            messageInput.focus();
            break;
    }
}

function appendMessage(text, type = 'other') {
    const msgEl = document.createElement('div');
    if (type === 'system') {
        msgEl.className = 'message-system';
    } else {
        msgEl.className = `message-bubble ${type === 'mine' ? 'message-mine' : 'message-other'}`;
    }
    msgEl.textContent = text;
    messagesContainer.appendChild(msgEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Attache les événements de données de manière symétrique des deux côtés
function setupConnectionEvents(conn) {
    currentConn = conn;

    conn.on('open', () => {
        isConnected = true;
        updateUI('connected');
    });

    conn.on('data', (data) => {
        if (typeof data === 'string' && data.trim() !== '') {
            appendMessage(data, 'other');
        }
    });

    conn.on('close', () => {
        disconnect();
    });

    conn.on('error', () => {
        disconnect();
    });
}

function startMatchmaking() {
    updateUI('connecting');
    const randomTargetId = ROOM_PREFIX + Math.floor(Math.random() * 10);
    const myId = ROOM_PREFIX + Math.floor(Math.random() * 100000);

    peer = new Peer(myId, { debug: 0 });

    peer.on('open', () => {
        // Tente de se connecter à une cible potentielle
        const conn = peer.connect(randomTargetId, { reliable: true });
        setupConnectionEvents(conn);

        // Si personne n'accepte au bout de 3.5 sec, on écoute simplement les connexions entrantes
        setTimeout(() => {
            if (!isConnected && (!currentConn || !currentConn.open)) {
                // En attente qu'un autre utilisateur se connecte à nous
            }
        }, 3500);
    });

    // Écoute des connexions entrantes (quand un autre utilisateur nous trouve)
    peer.on('connection', (incomingConn) => {
        setupConnectionEvents(incomingConn);
    });

    peer.on('error', (err) => {
        // En cas de conflit d'ID ou erreur réseau, on continue d'attendre
    });
}

function disconnect() {
    isConnected = false;
    if (currentConn) {
        currentConn.close();
        currentConn = null;
    }
    if (peer) {
        peer.destroy();
        peer = null;
    }
    updateUI('disconnected');
}

actionBtn.addEventListener('click', () => {
    if (isConnected || peer) {
        disconnect();
    } else {
        startMatchmaking();
    }
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (text && currentConn && isConnected) {
        currentConn.send(text);
        appendMessage(text, 'mine');
        messageInput.value = '';
    }
});