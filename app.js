const SUPABASE_URL = 'https://zuoeszdfdybkizdzeqkl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1b2VzemRmZHlia2l6ZHplcWtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDE1NzEsImV4cCI6MjA5MDkxNzU3MX0.rhaLF_KK8cIyn84Mxh9bPdWJislvR6QjtvtZv1zlwXg';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let state = {
    user: localStorage.getItem('duck_user'),
    activeRoom: 'GENERAL',
    rooms: ['GENERAL', 'LOUNGE', 'DEV'],
    lastCount: 0
};

// --- AUTH LOGIC ---
window.toggleAuth = () => {
    const l = document.getElementById('login-form'), s = document.getElementById('signup-form');
    l.style.display = l.style.display === 'none' ? 'block' : 'none';
    s.style.display = s.style.display === 'none' ? 'block' : 'none';
};

window.handleLogin = async () => {
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value;
    const { data } = await db.from('duck_users').select('*').eq('username', u).eq('password', p).single();
    if (data && !data.is_banned) {
        localStorage.setItem('duck_user', data.username);
        location.reload();
    } else alert("Invalid Login");
};

window.handleSignUp = async () => {
    const u = document.getElementById('reg-user').value.trim();
    const p = document.getElementById('reg-pass').value;
    await db.from('duck_users').insert([{ username: u, password: p, is_banned: false }]);
    alert("Account Created");
    toggleAuth();
};

window.handleLogout = () => { localStorage.clear(); location.reload(); };

// --- ROOM LOGIC (FIXED) ---
window.openCreateModal = () => document.getElementById('create-modal').style.display = 'flex';
window.closeCreateModal = () => document.getElementById('create-modal').style.display = 'none';

window.handleCreateRoom = async () => {
    const name = document.getElementById('new-room-name').value.trim().toUpperCase();
    if (!name) return;
    
    // Add to local state and update list
    if (!state.rooms.includes(name)) {
        state.rooms.push(name);
        // Note: In a real app, you'd save this to a 'rooms' table in Supabase.
        // For now, it stays for the session.
        switchRoom(name);
        closeCreateModal();
        document.getElementById('new-room-name').value = '';
    } else {
        alert("Room already exists");
    }
};

window.switchRoom = (r) => {
    state.activeRoom = r;
    state.lastCount = 0;
    document.getElementById('current-room-title').innerText = "# " + r;
    renderRooms();
    fetchMessages();
};

window.renderRooms = () => {
    document.getElementById('room-list').innerHTML = state.rooms.map(r => `
        <div onclick="switchRoom('${r}')" class="room-item ${state.activeRoom === r ? 'active' : ''}"># ${r}</div>
    `).join('');
};

// --- CHAT LOGIC ---
window.sendMessage = async () => {
    const input = document.getElementById('msg-input');
    const val = input.value.trim();
    if (!val) return;

    // OWNER HACKS
    if (val.startsWith('/') && state.user === 'WhoDis/DuckOwner') {
        if (val.startsWith('/purge')) await db.from('duck_messages').delete().eq('topic', state.activeRoom);
        if (val.startsWith('/ban ')) {
            const t = val.split(' ')[1];
            await db.from('duck_users').update({ is_banned: true }).eq('username', t);
            await db.from('duck_messages').delete().eq('sender_name', t);
        }
        input.value = '';
        fetchMessages();
        return;
    }

    await db.from('duck_messages').insert([{ text: val, topic: state.activeRoom, sender_name: state.user }]);
    input.value = '';
    fetchMessages();
};

window.fetchMessages = async () => {
    if (!state.user) return;
    const { data: msgs } = await db.from('duck_messages').select('*').eq('topic', state.activeRoom).order('created_at', { ascending: true });
    
    if (!msgs || msgs.length === state.lastCount) return;
    state.lastCount = msgs.length;

    const chat = document.getElementById('chat-box');
    chat.innerHTML = msgs.map(m => `
        <div class="msg-row">
            <div class="bubble">
                <span class="u-name" style="${m.sender_name === 'WhoDis/DuckOwner' ? 'color:var(--accent)' : ''}">${m.sender_name}</span>
                <div class="msg-text">${m.text}</div>
            </div>
        </div>`).join('');
    chat.scrollTop = chat.scrollHeight;
};

// --- INIT ---
if (state.user) {
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('main-interface').style.display = 'block';
    document.getElementById('display-username').innerText = state.user;
    if (state.user === 'WhoDis/DuckOwner') document.getElementById('owner-tag').style.display = 'inline-block';
    renderRooms();
    fetchMessages();
    setInterval(fetchMessages, 4000);
}