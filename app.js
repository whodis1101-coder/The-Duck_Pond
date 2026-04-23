/**
 * THE DUCK POND - CORE ENGINE (Slash Command Edition)
 */

const SUPABASE_URL = 'https://zuoeszdfdybkizdzeqkl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1b2VzemRmZHlia2l6ZHplcWtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDE1NzEsImV4cCI6MjA5MDkxNzU3MX0.rhaLF_KK8cIyn84Mxh9bPdWJislvR6QjtvtZv1zlwXg';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let state = {
    user: localStorage.getItem('duck_user'),
    role: localStorage.getItem('duck_role'),
    activeRoom: 'General',
    rooms: ['General'],
    defaultPfp: 'UserDefaultProfileBlue.jpg',
    lastMessageCount: 0
};

const ui = {
    openModal(id) { document.getElementById(id).style.display = 'flex'; },
    closeModal(id) { document.getElementById(id).style.display = 'none'; },
    toggleAuth() {
        const login = document.getElementById('login-form'), signup = document.getElementById('signup-form');
        const isLogin = login.style.display !== 'none';
        login.style.display = isLogin ? 'none' : 'block';
        signup.style.display = isLogin ? 'block' : 'none';
    },
    async openSettings() {
        const { data } = await db.from('duck_users').select('bio, pfp_url').ilike('username', state.user).single();
        if (data) {
            document.getElementById('set-bio').value = data.bio || "";
            document.getElementById('set-pfp-url').value = data.pfp_url || "";
        }
        this.openModal('settings-modal');
    },
    async visitProfile(target) {
        const { data } = await db.from('duck_users').select('*').ilike('username', target).single();
        if (data) {
            document.getElementById('view-username').innerText = data.username;
            document.getElementById('view-bio').innerText = data.bio || "This duck is silent...";
            document.getElementById('view-pfp').src = data.pfp_url || state.defaultPfp;
            this.openModal('view-profile-page');
        }
    },
    renderRooms() {
        const nav = document.getElementById('code-nav');
        nav.innerHTML = state.rooms.map(r => `<div onclick="app.switchRoom('${r}')" class="code-item ${state.activeRoom === r ? 'active' : ''}"># ${r}</div>`).join('');
    }
};

const app = {
    async signUp() {
        const u = document.getElementById('reg-user').value.trim();
        const p1 = document.getElementById('reg-pass1').value, p2 = document.getElementById('reg-pass2').value;
        if (!u || !p1 || p1 !== p2) return alert("Invalid inputs.");
        const { error } = await db.from('duck_users').insert([{ 
            username: u, password: p1, role: 'user', is_banned: false, 
            bio: 'A happy duck.', pfp_url: state.defaultPfp 
        }]);
        if (error) alert("Username taken!"); else { alert("Account created!"); ui.toggleAuth(); }
    },

    async login() {
        const u = document.getElementById('login-user').value.trim(), p = document.getElementById('login-pass').value;
        const { data } = await db.from('duck_users').select('*').ilike('username', u).eq('password', p).single();
        if (data) {
            if (data.is_banned) return alert("You are banned.");
            localStorage.setItem('duck_user', data.username);
            localStorage.setItem('duck_role', data.role);
            location.reload();
        } else alert("Login failed.");
    },

    async updateProfile() {
        const b = document.getElementById('set-bio').value.trim();
        const p = document.getElementById('set-pfp-url').value.trim();
        await db.from('duck_users').update({ bio: b, pfp_url: p || state.defaultPfp }).ilike('username', state.user);
        alert("Profile Updated!"); ui.closeModal('settings-modal');
    },

    // BAN LOGIC
    async banUser(targetUsername) {
        if (state.user !== 'WhoDis/DuckOwner') return alert("Only the Owner has this power.");
        
        const confirmBan = confirm(`BAN ${targetUsername} AND WIPE ALL MESSAGES?`);
        if (!confirmBan) return;

        await db.from('duck_users').update({ is_banned: true }).ilike('username', targetUsername);
        await db.from('duck_messages').delete().ilike('sender_name', targetUsername);

        alert(`${targetUsername} was nuked.`);
        state.lastMessageCount = 0;
        this.fetch();
    },

    // UPDATED SEND LOGIC WITH SLASH COMMANDS
    async send() {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        if (!text) return;

        // CHECK FOR SLASH COMMAND
        if (text.startsWith('/ban ')) {
            const target = text.replace('/ban ', '').trim();
            input.value = ''; // Clear input
            return this.banUser(target);
        }

        await db.from('duck_messages').insert([{ text: text, topic: state.activeRoom, sender_name: state.user }]);
        input.value = ''; 
        this.fetch();
    },

    async fetch() {
        if (!state.user) return;

        const { data: me } = await db.from('duck_users').select('is_banned').ilike('username', state.user).single();
        if (me?.is_banned) return this.logout();

        const { data: messages } = await db.from('duck_messages').select('*').eq('topic', state.activeRoom).order('created_at', { ascending: true });
        
        if (!messages || messages.length === state.lastMessageCount) return;
        state.lastMessageCount = messages.length;

        const senders = [...new Set(messages.map(m => m.sender_name))];
        const { data: users } = await db.from('duck_users').select('username, pfp_url').in('username', senders);
        
        const pfpLookup = {};
        if (users) users.forEach(u => pfpLookup[u.username] = u.pfp_url || state.defaultPfp);

        document.getElementById('chat-box').innerHTML = messages.map(m => {
            const isOwner = m.sender_name === 'WhoDis/DuckOwner';
            return `
                <div class="msg-container">
                    <img src="${pfpLookup[m.sender_name] || state.defaultPfp}" class="chat-pfp" onclick="ui.visitProfile('${m.sender_name}')" onerror="this.src='${state.defaultPfp}'">
                    <div class="msg-content">
                        <span class="clickable-name" style="color:${isOwner?'#ff5e5e':'var(--accent)'}" onclick="ui.visitProfile('${m.sender_name}')">
                            ${isOwner?'👑 ':''}${m.sender_name}
                        </span>
                        <div class="msg-bubble">${m.text}</div>
                    </div>
                </div>`;
        }).join('');
        
        document.getElementById('chat-box').scrollTo({ top: document.getElementById('chat-box').scrollHeight, behavior: 'smooth' });
    },

    createRoom() {
        const v = document.getElementById('new-room-input').value.toUpperCase().trim();
        if (v && !state.rooms.includes(v)) { 
            state.rooms.push(v); ui.renderRooms(); this.switchRoom(v); ui.closeModal('create-modal'); 
        }
    },

    switchRoom(r) { 
        state.activeRoom = r; state.lastMessageCount = 0; 
        document.getElementById('code-title').innerText = "# " + r; 
        ui.renderRooms(); this.fetch(); 
    },

    logout() { localStorage.clear(); location.reload(); },

    init() {
        if (state.user) {
            document.getElementById('auth-page').style.display = 'none';
            document.getElementById('main-interface').style.display = 'block';
            document.getElementById('user-display').innerText = state.user;
            ui.renderRooms(); this.fetch(); setInterval(() => this.fetch(), 4000);
        }
    }
};

app.init();