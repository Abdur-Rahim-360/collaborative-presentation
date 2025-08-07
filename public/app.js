const socket = io();
let currentState = null;
let currentSlideId = null;

const nickModal = document.getElementById('nickModal');
const mainApp = document.getElementById('mainApp');
const joinBtn = document.getElementById('joinBtn');
const nicknameInput = document.getElementById('nickname');
const presIdInput = document.getElementById('presId');
const slidesPanel = document.getElementById('slidesPanel');
const slideArea = document.getElementById('slideArea');
const usersPanel = document.getElementById('usersPanel');
const addSlideBtn = document.getElementById('addSlide');
const presentBtn = document.getElementById('presentMode');

joinBtn.onclick = () => {
  const nickname = nicknameInput.value.trim() || 'Guest';
  const presentationId = presIdInput.value.trim() || nanoid();
  socket.emit('join', { nickname, presentationId });
  nickModal.classList.add('hidden');
  mainApp.classList.remove('hidden');
};

function renderSlidesList() {
  slidesPanel.innerHTML = '';
  currentState.slides.forEach(s => {
    const el = document.createElement('div');
    el.className = 'slide-thumb' + (s.id === currentSlideId ? ' active' : '');
    el.innerText = s.content.slice(0, 20) || '– empty –';
    el.onclick = () => openSlide(s.id);
    slidesPanel.appendChild(el);
  });
}

function renderUsers() {
  usersPanel.innerHTML = '';
  Object.values(currentState.users).forEach(u => {
    const el = document.createElement('div');
    el.innerText = `${u.nickname} (${u.role})`;
    if (currentState.users[socket.id]?.role === 'creator' && u.id !== socket.id) {
      const btn = document.createElement('button');
      btn.innerText = u.role === 'viewer' ? 'Make Editor' : 'Make Viewer';
      btn.onclick = () => socket.emit('assignRole', {
        userId: u.id,
        role: u.role === 'viewer' ? 'editor' : 'viewer'
      });
      el.appendChild(btn);
    }
    usersPanel.appendChild(el);
  });
}

function openSlide(id) {
  currentSlideId = id;
  const slide = currentState.slides.find(s => s.id === id);
  slideArea.innerHTML = '';
  const editor = document.createElement('div');
  editor.contentEditable = true;
  editor.className = 'editor';
  editor.innerText = slide.content;
  editor.oninput = () => {
    socket.emit('editSlide', { slideId: id, content: editor.innerText });
  };
  slideArea.appendChild(editor);
  renderSlidesList();
}

addSlideBtn.onclick = () => socket.emit('addSlide');
presentBtn.onclick = () => slideArea.classList.toggle('present');

socket.on('state', state => {
  currentState = state;
  if (!currentSlideId) currentSlideId = state.slides[0].id;
  renderSlidesList();
  renderUsers();
  openSlide(currentSlideId);
});

socket.on('slideUpdated', ({ slideId, content }) => {
  if (slideId === currentSlideId) {
    slideArea.querySelector('.editor').innerText = content;
  }
});
