/* Groovy Proxy — app.js v3 */
const $ = (sel) => document.querySelector(sel);
const els = {
    sidebar: $('#sidebar'), chatList: $('#chat-list'), newChatBtn: $('#new-chat-btn'),
    modelSelect: $('#model-select'), title: $('#conversation-title'),
    clearBtn: $('#clear-btn'), messages: $('#messages'),
    dropOverlay: $('#drop-overlay'), composer: $('#composer'),
    attachments: $('#attachments'), fileInput: $('#file-input'),
    attachBtn: $('#attach-btn'), input: $('#input'),
    sendBtn: $('#send-btn'), charCounter: $('#char-counter'),
    modeToggle: $('#mode-toggle'),
    splitBtn: $('#split-btn'),
    // Settings modal elements
    settingsBtn: $('#settings-btn'),
    settingsModal: $('#settings-modal'),
    settingsCloseBtn: $('#settings-close-btn'),
    settingsNavBtns: document.querySelectorAll('.settings-nav-btn'),
    settingsPanes: document.querySelectorAll('.settings-pane'),
    // Settings pane inputs
    themeSelect: $('#theme-select'),
    usernameInput: $('#username-input'),
    modelSettingsSearch: $('#model-settings-search'),
    showHiddenModels: $('#show-hidden-models'),
    modelSettingsList: $('#model-settings-list'),
    systemInput: $('#system-input'),
    contextFiles: $('#context-files'),
    addContextBtn: $('#add-context-btn'),
    contextFileInput: $('#context-file-input'),
    apiKeyInput: $('#api-key-input'),
    apiBaseInput: $('#api-base-input'),
    toggleApiKey: $('#toggle-api-key'),
    // Model picker
    modelPickerBtn: $('#model-picker-btn'),
    modelPickerLabel: $('#model-picker-label'),
    modelPickerDropdown: $('#model-picker-dropdown'),
    modelSearch: $('#model-search'),
    modelList: $('#model-list'),
    // Folder/tag elements
    folderSelect: $('#folder-select'),
    manageFoldersBtn: $('#manage-folders-btn'),
    folderModal: $('#folder-modal'),
    newFolderInput: $('#new-folder-input'),
    createFolderBtn: $('#create-folder-btn'),
    folderList: $('#folder-list'),
    chatContextMenu: $('#chat-context-menu'),
    contextFolderOptions: $('#context-folder-options'),
    contextTagOptions: $('#context-tag-options'),
    newTagInput: $('#new-tag-input'),
    // Other
    tokenEstimate: $('#token-estimate'),
    responseStats: $('#response-stats'),
};
const LS_KEY = 'groovy-proxy::conversations::v3';
const LS_MODEL = 'groovy-proxy::model';
const LS_ACTIVE = 'groovy-proxy::active';
const LS_MODEL_PREFS = 'groovy-proxy::model-prefs';
const LS_USERNAME = 'groovy-proxy::username';
const LS_THEME = 'groovy-proxy::theme';
const LS_API_KEY = 'groovy-proxy::api-key';
const LS_API_BASE = 'groovy-proxy::api-base';
const MAX_FILE = 10*1024*1024;
const IDB_NAME = 'groovy-proxy-images';
const IDB_STORE = 'images';
let conversations = [], activeId = null, streamingAbort = null, pendingFiles = [];
let imageMode = false; // Toggle between chat and image generation
let imageDB = null; // IndexedDB for storing generated images
let allModels = []; // All models from API
let modelPrefs = { favorites: [], hidden: [] }; // Model preferences

/* ====== Model Preferences ====== */
function loadModelPrefs() {
    try { modelPrefs = JSON.parse(localStorage.getItem(LS_MODEL_PREFS) || '{}'); }
    catch { modelPrefs = {}; }
    if (!modelPrefs.favorites) modelPrefs.favorites = [];
    if (!modelPrefs.hidden) modelPrefs.hidden = [];
}
function saveModelPrefs() {
    localStorage.setItem(LS_MODEL_PREFS, JSON.stringify(modelPrefs));
}

/* ====== API Key Management ====== */
function getApiKey() {
    return localStorage.getItem(LS_API_KEY) || '';
}
function setApiKey(key) {
    if (key) localStorage.setItem(LS_API_KEY, key);
    else localStorage.removeItem(LS_API_KEY);
}
function getApiBase() {
    return localStorage.getItem(LS_API_BASE) || '';
}
function setApiBase(base) {
    if (base) localStorage.setItem(LS_API_BASE, base);
    else localStorage.removeItem(LS_API_BASE);
}

/* ====== Settings Modal ====== */
function initSettingsModal() {
    // Open settings button
    els.settingsBtn?.addEventListener('click', openSettingsModal);
    
    // Close settings button
    els.settingsCloseBtn?.addEventListener('click', closeSettingsModal);
    
    // Click outside to close
    els.settingsModal?.addEventListener('click', (e) => {
        if (e.target === els.settingsModal) closeSettingsModal();
    });
    
    // Tab navigation
    els.settingsNavBtns?.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            els.settingsNavBtns.forEach(b => b.classList.toggle('active', b === btn));
            els.settingsPanes.forEach(p => p.classList.toggle('active', p.dataset.pane === target));
            
            // Render model settings when switching to models tab
            if (target === 'models') renderModelSettingsInModal();
            // Render files lists when switching to files tab
            if (target === 'files') {
                renderContextFiles();
                renderPendingFilesList();
            }
        });
    });
    
    // API key toggle visibility
    els.toggleApiKey?.addEventListener('click', () => {
        const inp = els.apiKeyInput;
        if (inp.type === 'password') { inp.type = 'text'; els.toggleApiKey.textContent = '🙈'; }
        else { inp.type = 'password'; els.toggleApiKey.textContent = '👁'; }
    });
    
    // Save API settings on change
    els.apiKeyInput?.addEventListener('change', () => setApiKey(els.apiKeyInput.value.trim()));
    els.apiBaseInput?.addEventListener('change', () => setApiBase(els.apiBaseInput.value.trim()));
    
    // Model settings search
    els.modelSettingsSearch?.addEventListener('input', () => renderModelSettingsInModal());
    
    // Show hidden models toggle - use event delegation on the settings modal
    els.settingsModal?.addEventListener('change', (e) => {
        if (e.target.id === 'show-hidden-models') {
            renderModelSettingsInModal();
        }
    });
    
    // Export buttons in settings
    document.querySelectorAll('.export-btn-large[data-format]').forEach(btn => {
        btn.addEventListener('click', () => {
            const conv = activeConv();
            if (conv && conv.messages.length) {
                exportConversation(conv, btn.dataset.format);
            } else {
                alert('No messages to export');
            }
        });
    });
    
    // Load saved values
    if (els.apiKeyInput) els.apiKeyInput.value = getApiKey();
    if (els.apiBaseInput) els.apiBaseInput.value = getApiBase();
}

function openSettingsModal() {
    els.settingsModal?.classList.remove('hidden');
    // Reset to first tab
    els.settingsNavBtns?.forEach((b, i) => b.classList.toggle('active', i === 0));
    els.settingsPanes?.forEach((p, i) => p.classList.toggle('active', i === 0));
}

function closeSettingsModal() {
    els.settingsModal?.classList.add('hidden');
}

function renderModelSettingsInModal() {
    const modelSettingsList = document.getElementById('model-settings-list');
    if (!modelSettingsList) return;
    
    const searchInput = document.getElementById('model-settings-search');
    const filter = (searchInput?.value || '').toLowerCase();
    const showHiddenCheckbox = document.getElementById('show-hidden-models');
    const showHidden = showHiddenCheckbox?.checked ?? false;
    
    const filtered = allModels.filter(id => {
        if (!showHidden && isHidden(id)) return false;
        return id.toLowerCase().includes(filter);
    });
    
    modelSettingsList.innerHTML = filtered.map(id => `
        <div class="model-item ${isHidden(id) ? 'hidden-model' : ''}">
            <span class="model-name">${isImageModel(id) ? '🖼️ ' : ''}${id}</span>
            <div class="model-actions">
                <button class="model-fav-btn ${isFavorite(id) ? 'active' : ''}" data-model="${id}" title="Favorite">⭐</button>
                <button class="model-hide-btn ${isHidden(id) ? 'active' : ''}" data-model="${id}" title="Hide">${isHidden(id) ? '👁️' : '🚫'}</button>
            </div>
        </div>
    `).join('');
    
    // Attach handlers
    modelSettingsList.querySelectorAll('.model-fav-btn').forEach(btn => {
        btn.onclick = () => { 
            toggleFavorite(btn.dataset.model); 
            renderModelSettingsInModal(); 
            populateModelSelect(); 
            renderModelList(); 
        };
    });
    modelSettingsList.querySelectorAll('.model-hide-btn').forEach(btn => {
        btn.onclick = () => { 
            toggleHidden(btn.dataset.model); 
            renderModelSettingsInModal(); 
            populateModelSelect(); 
            renderModelList(); 
        };
    });
}

/* ====== Chat Folders & Tags ====== */
const LS_FOLDERS = 'groovy-proxy::folders';
let folders = [];
let allTags = [];
let currentFolder = 'all';
let contextMenuConvId = null;

function loadFolders() {
    try { folders = JSON.parse(localStorage.getItem(LS_FOLDERS) || '[]'); } catch { folders = []; }
    // Collect all tags from conversations
    allTags = [...new Set(conversations.flatMap(c => c.tags || []))];
}

function saveFolders() {
    localStorage.setItem(LS_FOLDERS, JSON.stringify(folders));
}

function initFolders() {
    loadFolders();
    populateFolderSelect();
    
    // Folder select change
    els.folderSelect?.addEventListener('change', () => {
        currentFolder = els.folderSelect.value;
        renderSidebar();
    });
    
    // Manage folders button
    els.manageFoldersBtn?.addEventListener('click', openFolderModal);
    
    // Create folder
    els.createFolderBtn?.addEventListener('click', createFolder);
    els.newFolderInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') createFolder();
    });
    
    // Close folder modal
    els.folderModal?.querySelector('.modal-close')?.addEventListener('click', closeFolderModal);
    els.folderModal?.addEventListener('click', (e) => {
        if (e.target === els.folderModal) closeFolderModal();
    });
    
    // Context menu - close on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) {
            els.chatContextMenu?.classList.add('hidden');
        }
    });
    
    // New tag input
    els.newTagInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            addTagToConv(contextMenuConvId, e.target.value.trim());
            e.target.value = '';
        }
    });
}

function populateFolderSelect() {
    if (!els.folderSelect) return;
    
    // Keep current selection
    const currentVal = els.folderSelect.value || 'all';
    
    els.folderSelect.innerHTML = `
        <option value="all">📁 All Chats</option>
        <option value="unfiled">📄 Unfiled</option>
    `;
    
    folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = '📂 ' + f.name;
        els.folderSelect.appendChild(opt);
    });
    
    els.folderSelect.value = currentVal;
}

let selectedFolderId = null;
let showingUnassigned = false;

function openFolderModal() {
    els.folderModal?.classList.remove('hidden');
    selectedFolderId = null;
    showingUnassigned = false;
    renderFolderList();
}

function closeFolderModal() {
    els.folderModal?.classList.add('hidden');
    selectedFolderId = null;
    showingUnassigned = false;
}

function renderFolderList() {
    if (!els.folderList) return;
    
    // Get unassigned chats count
    const unassignedCount = conversations.filter(c => !c.folderId).length;
    
    let html = '';
    
    // Unassigned chats section
    html += `
        <div class="folder-item folder-item-unassigned ${showingUnassigned ? 'active' : ''}" data-folder-id="__unassigned__">
            <div class="folder-item-name">
                <span>📄</span>
                <span>Unassigned Chats</span>
                <span class="folder-chat-count">${unassignedCount}</span>
            </div>
        </div>
    `;
    
    // Folders list
    html += folders.map(f => {
        const chatCount = conversations.filter(c => c.folderId === f.id).length;
        return `
            <div class="folder-item ${selectedFolderId === f.id ? 'active' : ''}" data-folder-id="${f.id}">
                <div class="folder-item-name">
                    <span>📂</span>
                    <span>${f.name}</span>
                    <span class="folder-chat-count">${chatCount}</span>
                </div>
                <div class="folder-item-actions">
                    <button class="rename-btn" title="Rename">✏️</button>
                    <button class="delete-btn" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    if (!folders.length) {
        html += '<p class="muted small" style="padding:12px">No folders yet. Create one above.</p>';
    }
    
    els.folderList.innerHTML = html;
    
    // Attach handlers
    els.folderList.querySelectorAll('.folder-item').forEach(item => {
        const folderId = item.dataset.folderId;
        
        // Click to view folder contents
        item.querySelector('.folder-item-name').onclick = () => {
            if (folderId === '__unassigned__') {
                showingUnassigned = true;
                selectedFolderId = null;
            } else {
                showingUnassigned = false;
                selectedFolderId = folderId;
            }
            renderFolderList();
            renderFolderContents();
        };
        
        // Rename/delete buttons (not for unassigned)
        if (folderId !== '__unassigned__') {
            item.querySelector('.rename-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                renameFolder(folderId);
            });
            item.querySelector('.delete-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteFolder(folderId);
            });
        }
    });
    
    // Render folder contents panel
    renderFolderContents();
}

function renderFolderContents() {
    let contentsEl = document.getElementById('folder-contents');
    if (!contentsEl) {
        // Create contents panel if it doesn't exist
        contentsEl = document.createElement('div');
        contentsEl.id = 'folder-contents';
        contentsEl.className = 'folder-contents';
        els.folderList.parentElement.appendChild(contentsEl);
    }
    
    if (!selectedFolderId && !showingUnassigned) {
        contentsEl.innerHTML = '<div class="folder-contents-empty"><p class="muted">Select a folder or Unassigned Chats to view contents</p></div>';
        return;
    }
    
    if (showingUnassigned) {
        // Show unassigned chats
        const unassigned = conversations.filter(c => !c.folderId);
        
        contentsEl.innerHTML = `
            <div class="folder-contents-header">
                <h4>📄 Unassigned Chats (${unassigned.length})</h4>
            </div>
            <div class="folder-chats-list">
                ${unassigned.length ? unassigned.map(c => `
                    <div class="folder-chat-item" data-chat-id="${c.id}">
                        <span class="chat-title">${c.title || 'Untitled'}</span>
                        <select class="assign-folder-select" data-chat-id="${c.id}">
                            <option value="">— Move to folder —</option>
                            ${folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
                        </select>
                    </div>
                `).join('') : '<p class="muted small">No unassigned chats</p>'}
            </div>
        `;
        
        // Attach move handlers
        contentsEl.querySelectorAll('.assign-folder-select').forEach(select => {
            select.onchange = () => {
                if (select.value) {
                    moveConvToFolder(select.dataset.chatId, select.value);
                    renderFolderList();
                }
            };
        });
    } else {
        // Show folder contents
        const folder = folders.find(f => f.id === selectedFolderId);
        if (!folder) return;
        
        const chatsInFolder = conversations.filter(c => c.folderId === selectedFolderId);
        
        contentsEl.innerHTML = `
            <div class="folder-contents-header">
                <h4>📂 ${folder.name} (${chatsInFolder.length})</h4>
                <button class="add-chats-btn ghost-btn small" id="add-chats-to-folder">+ Add Chats</button>
            </div>
            <div class="folder-chats-list" id="folder-chats-list">
                ${chatsInFolder.length ? chatsInFolder.map(c => `
                    <div class="folder-chat-item" data-chat-id="${c.id}">
                        <span class="chat-title">${c.title || 'Untitled'}</span>
                        <button class="remove-from-folder-btn ghost-btn small" data-chat-id="${c.id}" title="Remove from folder">✕</button>
                    </div>
                `).join('') : '<p class="muted small">No chats in this folder</p>'}
            </div>
            <div class="add-chats-picker hidden" id="add-chats-picker">
                <h5>Select chats to add:</h5>
                <div class="unassigned-chats-list" id="unassigned-chats-list"></div>
            </div>
        `;
        
        // Remove from folder buttons
        contentsEl.querySelectorAll('.remove-from-folder-btn').forEach(btn => {
            btn.onclick = () => {
                moveConvToFolder(btn.dataset.chatId, null);
                renderFolderList();
            };
        });
        
        // Add chats button
        document.getElementById('add-chats-to-folder')?.addEventListener('click', () => {
            const picker = document.getElementById('add-chats-picker');
            const listEl = document.getElementById('unassigned-chats-list');
            picker.classList.toggle('hidden');
            
            if (!picker.classList.contains('hidden')) {
                const unassigned = conversations.filter(c => !c.folderId);
                listEl.innerHTML = unassigned.length ? unassigned.map(c => `
                    <div class="folder-chat-item selectable" data-chat-id="${c.id}">
                        <span class="chat-title">${c.title || 'Untitled'}</span>
                        <button class="add-to-folder-btn ghost-btn small" data-chat-id="${c.id}">+ Add</button>
                    </div>
                `).join('') : '<p class="muted small">No unassigned chats available</p>';
                
                listEl.querySelectorAll('.add-to-folder-btn').forEach(btn => {
                    btn.onclick = () => {
                        moveConvToFolder(btn.dataset.chatId, selectedFolderId);
                        renderFolderList();
                    };
                });
            }
        });
    }
}

function createFolder() {
    const name = els.newFolderInput?.value.trim();
    if (!name) return;
    
    folders.push({ id: newId(), name, contextFiles: [] });
    saveFolders();
    populateFolderSelect();
    renderFolderList();
    els.newFolderInput.value = '';
}

function getFolderContextFiles(folderId) {
    if (!folderId) return [];
    const folder = folders.find(f => f.id === folderId);
    return folder?.contextFiles || [];
}

async function addFolderContextFile(folderId, file) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    if (!folder.contextFiles) folder.contextFiles = [];
    
    const result = await processFile(file);
    if (result) {
        folder.contextFiles.push(result);
        saveFolders();
    }
    return result;
}

function removeFolderContextFile(folderId, index) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder?.contextFiles) return;
    folder.contextFiles.splice(index, 1);
    saveFolders();
}

function renameFolder(folderId) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    
    const newName = prompt('Rename folder:', folder.name);
    if (newName && newName.trim()) {
        folder.name = newName.trim();
        saveFolders();
        populateFolderSelect();
        renderFolderList();
        renderSidebar();
    }
}

function deleteFolder(folderId) {
    if (!confirm('Delete this folder? Chats will be moved to Unfiled.')) return;
    
    // Move chats to unfiled
    conversations.forEach(c => {
        if (c.folderId === folderId) c.folderId = null;
    });
    saveState();
    
    folders = folders.filter(f => f.id !== folderId);
    saveFolders();
    populateFolderSelect();
    renderFolderList();
    renderSidebar();
}

function openContextMenu(e, convId) {
    e.preventDefault();
    contextMenuConvId = convId;
    
    const menu = els.chatContextMenu;
    if (!menu) return;
    
    // Position menu
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    
    // Populate folder options
    const conv = conversations.find(c => c.id === convId);
    const folderOpts = els.contextFolderOptions;
    if (folderOpts) {
        folderOpts.innerHTML = `
            <div class="context-menu-option ${!conv?.folderId ? 'selected' : ''}" data-folder="">📄 Unfiled</div>
            ${folders.map(f => `
                <div class="context-menu-option ${conv?.folderId === f.id ? 'selected' : ''}" data-folder="${f.id}">📂 ${f.name}</div>
            `).join('')}
        `;
        
        folderOpts.querySelectorAll('.context-menu-option').forEach(opt => {
            opt.onclick = () => {
                moveConvToFolder(convId, opt.dataset.folder || null);
                menu.classList.add('hidden');
            };
        });
    }
    
    // Populate tag options
    const tagOpts = els.contextTagOptions;
    if (tagOpts && conv) {
        const convTags = conv.tags || [];
        tagOpts.innerHTML = allTags.map(tag => `
            <div class="context-menu-option ${convTags.includes(tag) ? 'selected' : ''}" data-tag="${tag}">${tag}</div>
        `).join('') || '';
        
        tagOpts.querySelectorAll('.context-menu-option').forEach(opt => {
            opt.onclick = () => {
                toggleTagOnConv(convId, opt.dataset.tag);
                openContextMenu(e, convId); // Refresh
            };
        });
    }
    
    menu.classList.remove('hidden');
}

function moveConvToFolder(convId, folderId) {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    
    conv.folderId = folderId || null;
    saveState();
    renderSidebar();
}

function addTagToConv(convId, tag) {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    
    if (!conv.tags) conv.tags = [];
    if (!conv.tags.includes(tag)) {
        conv.tags.push(tag);
        if (!allTags.includes(tag)) allTags.push(tag);
        saveState();
        renderSidebar();
    }
}

function toggleTagOnConv(convId, tag) {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    
    if (!conv.tags) conv.tags = [];
    const idx = conv.tags.indexOf(tag);
    if (idx >= 0) conv.tags.splice(idx, 1);
    else conv.tags.push(tag);
    saveState();
    renderSidebar();
}

/* ====== Custom Model Picker ====== */
let modelPickerOpen = false;
function initModelPicker() {
    if (!els.modelPickerBtn) return;
    
    els.modelPickerBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent document click from immediately closing
        modelPickerOpen = !modelPickerOpen;
        els.modelPickerDropdown.classList.toggle('hidden', !modelPickerOpen);
        if (modelPickerOpen) {
            els.modelSearch.value = '';
            els.modelSearch.focus();
            renderModelList();
        }
    });
    
    // Prevent clicks inside dropdown from closing it
    els.modelPickerDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
        if (modelPickerOpen && !e.target.closest('#model-picker')) {
            modelPickerOpen = false;
            els.modelPickerDropdown.classList.add('hidden');
        }
    });
    
    // Fuzzy search
    els.modelSearch.addEventListener('input', () => renderModelList(els.modelSearch.value));
    
    // Keyboard nav
    els.modelSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modelPickerOpen = false;
            els.modelPickerDropdown.classList.add('hidden');
        } else if (e.key === 'Enter') {
            const first = els.modelList.querySelector('.model-list-item:not(.hidden-model)');
            if (first) first.click();
        }
    });
}

function renderModelList(filter = '') {
    if (!els.modelList) return;
    els.modelList.innerHTML = '';
    
    const filterLower = filter.toLowerCase();
    const visible = allModels.filter(id => !isHidden(id));
    const favorites = visible.filter(id => isFavorite(id));
    const regular = visible.filter(id => !isFavorite(id));
    
    const matchesFilter = (id) => !filter || id.toLowerCase().includes(filterLower);
    const currentModel = els.modelSelect.value;
    
    const addItem = (id) => {
        if (!matchesFilter(id)) return;
        const item = document.createElement('div');
        item.className = 'model-list-item' + (id === currentModel ? ' selected' : '');
        
        const name = document.createElement('span');
        name.className = 'model-name';
        name.textContent = id;
        item.appendChild(name);
        
        if (isImageModel(id)) {
            const badge = document.createElement('span');
            badge.className = 'model-badge image';
            badge.textContent = '🖼️';
            item.appendChild(badge);
        }
        
        item.addEventListener('click', () => {
            els.modelSelect.value = id;
            els.modelPickerLabel.textContent = id;
            modelPickerOpen = false;
            els.modelPickerDropdown.classList.add('hidden');
            localStorage.setItem(LS_MODEL, id);
            updateModeForModel(id);
            const c = activeConv();
            if (c) { c.model = id; saveState(); }
        });
        
        els.modelList.appendChild(item);
    };
    
    if (favorites.length) {
        const group = document.createElement('div');
        group.className = 'model-list-group';
        group.textContent = '⭐ Favorites';
        els.modelList.appendChild(group);
        favorites.forEach(addItem);
    }
    
    if (regular.length) {
        if (favorites.length) {
            const group = document.createElement('div');
            group.className = 'model-list-group';
            group.textContent = 'All Models';
            els.modelList.appendChild(group);
        }
        regular.forEach(addItem);
    }
    
    if (!els.modelList.children.length) {
        const empty = document.createElement('div');
        empty.className = 'model-list-empty';
        empty.textContent = filter ? 'No models match' : 'No models available';
        els.modelList.appendChild(empty);
    }
}

function updateModelPickerLabel() {
    if (els.modelPickerLabel) {
        els.modelPickerLabel.textContent = els.modelSelect.value || 'Select model…';
    }
}

/* ====== Message Timestamps ====== */
function formatTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
    return d.toLocaleDateString();
}

/* ====== Token Estimation ====== */
// Rough estimate: ~4 chars = 1 token (GPT-like models)
function estimateTokens(text) {
    if (!text) return 0;
    // Rough approximation: split on whitespace/punctuation
    const words = text.split(/\s+/).filter(Boolean);
    return Math.ceil(text.length / 4);
}

function updateTokenEstimate() {
    if (!els.tokenEstimate) return;
    const text = els.input.value || '';
    const tokens = estimateTokens(text);
    els.tokenEstimate.textContent = `~${tokens} tokens`;
}

/* ====== Response Stats ====== */
let lastResponseStats = null;

function showResponseStats(stats) {
    if (!els.responseStats) return;
    lastResponseStats = stats;
    
    const parts = [];
    if (stats.model) parts.push(`<span class="stat"><span class="stat-label">model:</span> <span class="stat-value">${stats.model}</span></span>`);
    if (stats.tokens) parts.push(`<span class="stat"><span class="stat-label">tokens:</span> <span class="stat-value">${stats.tokens}</span></span>`);
    if (stats.time) parts.push(`<span class="stat"><span class="stat-label">time:</span> <span class="stat-value">${stats.time}s</span></span>`);
    if (stats.tokensPerSec) parts.push(`<span class="stat"><span class="stat-label">speed:</span> <span class="stat-value">${stats.tokensPerSec} t/s</span></span>`);
    
    els.responseStats.innerHTML = parts.join('');
    els.responseStats.classList.remove('hidden');
}

function hideResponseStats() {
    if (els.responseStats) {
        els.responseStats.classList.add('hidden');
    }
}

/* ====== Syntax Highlighting (Prism.js) ====== */
function highlightCode() {
    // Re-highlight any code blocks in the messages (including split view panes)
    if (typeof Prism !== 'undefined') {
        requestAnimationFrame(() => {
            document.querySelectorAll('#messages pre code:not(.prism-highlighted), .pane-messages pre code:not(.prism-highlighted)').forEach(block => {
                // Try to detect language from class or content
                const pre = block.closest('pre');
                const wrap = pre?.closest('.code-block-wrap');
                const langMatch = block.className.match(/language-(\w+)/);
                
                if (!langMatch) {
                    // Try to auto-detect
                    const text = block.textContent || '';
                    const detected = detectLanguage(text);
                    if (detected) {
                        block.classList.add(`language-${detected}`);
                    }
                }
                
                Prism.highlightElement(block);
                block.classList.add('prism-highlighted');
            });
        });
    }
}

function detectLanguage(code) {
    // Simple heuristics for common languages
    if (/^(import|from|def|class|if __name__)/m.test(code)) return 'python';
    if (/^(const|let|var|function|import|export|=>)/m.test(code)) return 'javascript';
    if (/^(interface|type|namespace|declare)/m.test(code) && /:\s*(string|number|boolean)/m.test(code)) return 'typescript';
    if (/^(package|import|public|private|class|void|static)/m.test(code)) return 'java';
    if (/^(fn|let|mut|impl|struct|enum|pub|use)/m.test(code)) return 'rust';
    if (/^(func|package|import|var|type|struct)/m.test(code) && /\bfunc\b/.test(code)) return 'go';
    if (/^#include|^int main\(|->|std::/m.test(code)) return 'cpp';
    if (/^\s*<[a-zA-Z][^>]*>/.test(code) && /<\/[a-zA-Z]+>/.test(code)) return 'markup';
    if (/^\s*{[\s\S]*"[^"]+"\s*:/.test(code)) return 'json';
    if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/im.test(code)) return 'sql';
    if (/^(---|\w+:\s|\[\w+\])/m.test(code)) return 'yaml';
    if (/^\s*\$[a-zA-Z_]|^\s*@[a-zA-Z]|^\s*\.[a-zA-Z]|^\s*#[a-zA-Z]/m.test(code)) return 'css';
    if (/^#!/.test(code) || /\$\{|\$\(|^\s*(if|for|while|echo|export)\b/m.test(code)) return 'bash';
    return null;
}

/* ====== Continue Generation ====== */
let canContinue = false;
let lastIncompleteResponse = null;

function showContinueButton(msgIdx) {
    // Remove existing continue button
    const existing = els.messages.querySelector('.continue-btn');
    if (existing) existing.remove();
    
    const conv = activeConv();
    if (!conv || msgIdx >= conv.messages.length) return;
    
    const btn = document.createElement('button');
    btn.className = 'continue-btn';
    btn.innerHTML = '↻ Continue generating';
    btn.onclick = () => continueGeneration(msgIdx);
    
    const lastMsg = els.messages.lastElementChild;
    if (lastMsg) {
        lastMsg.after(btn);
    }
}

async function continueGeneration(msgIdx) {
    const conv = activeConv();
    if (!conv) return;
    
    const lastAssistant = conv.messages[msgIdx];
    if (!lastAssistant || lastAssistant.role !== 'assistant') return;
    
    // Remove continue button
    const btn = els.messages.querySelector('.continue-btn');
    if (btn) btn.remove();
    
    // Build continuation prompt
    const model = conv.model || els.modelSelect.value;
    const apiMsgs = [];
    
    if (conv.systemPrompt) apiMsgs.push({role:'system', content: conv.systemPrompt});
    
    // Include all messages up to and including the last assistant message
    conv.messages.slice(0, msgIdx + 1).forEach(m => {
        apiMsgs.push({role: m.role, content: m.content});
    });
    
    // Add a continuation prompt
    apiMsgs.push({role:'user', content: 'Continue from where you left off.'});
    
    setSending(true);
    const controller = new AbortController();
    streamingAbort = controller;
    
    const lastEl = els.messages.lastElementChild;
    const contentEl = lastEl?.querySelector('.content');
    let existingContent = lastAssistant.content || '';
    let acc = '';
    const startTime = Date.now();
    
    const apiKey = getApiKey();
    try {
        const resp = await fetch('/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
            },
            body: JSON.stringify({model, stream: true, messages: apiMsgs}),
            signal: controller.signal,
        });
        
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            buf += dec.decode(value, {stream: true});
            
            let nl;
            while ((nl = buf.indexOf('\n')) !== -1) {
                const line = buf.slice(0, nl).trim();
                buf = buf.slice(nl + 1);
                if (!line || !line.startsWith('data:')) continue;
                const payload = line.slice(5).trim();
                if (payload === '[DONE]') break;
                try {
                    const obj = JSON.parse(payload);
                    const delta = obj.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        acc += delta;
                        lastAssistant.content = existingContent + '\n\n' + acc;
                        if (contentEl) {
                            contentEl.innerHTML = renderContent(lastAssistant.content) + '<span class="cursor"></span>';
                            scrollToBottom();
                            highlightCode();
                        }
                    }
                } catch {}
            }
        }
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const totalTokens = estimateTokens(acc);
        const tokensPerSec = elapsed > 0 ? (totalTokens / parseFloat(elapsed)).toFixed(1) : 0;
        
        showResponseStats({
            model: model.split('/').pop(),
            tokens: totalTokens,
            time: elapsed,
            tokensPerSec
        });
        
        if (contentEl) contentEl.innerHTML = renderContent(lastAssistant.content);
        highlightCode();
        saveState();
        
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            lastAssistant.content += '\n\n**Error continuing:** ' + err.message;
            if (contentEl) contentEl.innerHTML = renderContent(lastAssistant.content);
        }
        saveState();
    } finally {
        streamingAbort = null;
        setSending(false);
        focusInput();
    }
}
function toggleFavorite(modelId) {
    const idx = modelPrefs.favorites.indexOf(modelId);
    if (idx >= 0) modelPrefs.favorites.splice(idx, 1);
    else modelPrefs.favorites.push(modelId);
    saveModelPrefs();
    populateModelSelect();
}
function toggleHidden(modelId) {
    const idx = modelPrefs.hidden.indexOf(modelId);
    if (idx >= 0) modelPrefs.hidden.splice(idx, 1);
    else modelPrefs.hidden.push(modelId);
    saveModelPrefs();
    populateModelSelect();
}
function isFavorite(modelId) { return modelPrefs.favorites.includes(modelId); }
function isHidden(modelId) { return modelPrefs.hidden.includes(modelId); }

/* ====== Image Model Detection ====== */
function isImageModel(modelId) {
    if (!modelId) return false;
    const lower = modelId.toLowerCase();
    // Match models with "image" or "nano-banana" in the name
    return lower.includes('image') || lower.includes('nano-banana') || lower.includes('dall-e') || lower.includes('imagen');
}

function updateModeForModel(modelId) {
    const shouldBeImageMode = isImageModel(modelId);
    if (imageMode !== shouldBeImageMode) {
        imageMode = shouldBeImageMode;
        els.modeToggle.textContent = imageMode ? '🖼️ Image' : '💬 Chat';
        els.modeToggle.classList.toggle('image-mode', imageMode);
        els.input.placeholder = imageMode 
            ? 'Describe the image to generate...' 
            : 'Message…  (drop or paste files · Shift+Enter for newline)';
    }
}

/* ====== IndexedDB for Generated Images ====== */
async function initImageDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { imageDB = request.result; resolve(imageDB); };
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE, { keyPath: 'id' });
            }
        };
    });
}

async function storeImage(id, dataUrl) {
    if (!imageDB) await initImageDB();
    return new Promise((resolve, reject) => {
        const tx = imageDB.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put({ id, dataUrl, timestamp: Date.now() });
        tx.oncomplete = () => resolve(id);
        tx.onerror = () => reject(tx.error);
    });
}

async function getImage(id) {
    if (!imageDB) await initImageDB();
    return new Promise((resolve, reject) => {
        const tx = imageDB.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result?.dataUrl || null);
        request.onerror = () => reject(request.error);
    });
}

async function deleteImage(id) {
    if (!imageDB) await initImageDB();
    return new Promise((resolve) => {
        const tx = imageDB.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(id);
        tx.oncomplete = () => resolve();
    });
}

function loadState() {
    try { conversations = JSON.parse(localStorage.getItem(LS_KEY)||'[]'); } catch { conversations = []; }
    activeId = localStorage.getItem(LS_ACTIVE);
    if (!conversations.find(c=>c.id===activeId)) activeId = conversations[0]?.id||null;
}
function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(conversations));
    activeId ? localStorage.setItem(LS_ACTIVE, activeId) : localStorage.removeItem(LS_ACTIVE);
}
function newId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function activeConv() { return conversations.find(c=>c.id===activeId)||null; }

function createConversation() {
    const conv = {id:newId(),title:'New chat',model:els.modelSelect.value||'',systemPrompt:'',contextFiles:[],messages:[]};
    conversations.unshift(conv); activeId = conv.id;
    saveState(); renderSidebar(); renderMessages(); syncSystemPanel(); focusInput();
}
async function deleteConversation(id) {
    // Find the conversation and clean up any IndexedDB images
    const conv = conversations.find(c => c.id === id);
    if (conv) {
        for (const msg of conv.messages) {
            if (msg.generatedImages?.length) {
                for (const ref of msg.generatedImages) {
                    if (ref.type === 'idb' && ref.id) {
                        await deleteImage(ref.id).catch(() => {});
                    }
                }
            }
        }
    }
    conversations = conversations.filter(c=>c.id!==id);
    if (activeId===id) activeId = conversations[0]?.id||null;
    saveState(); renderSidebar(); renderMessages(); syncSystemPanel();
}

async function loadModels() {
    const apiKey = getApiKey();
    try {
        const r = await fetch('/api/v1/models', {
            headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
        });
        if (!r.ok) throw new Error('HTTP '+r.status);
        const data = await r.json();
        allModels = (data.data||data.models||[]).map(m=>typeof m==='string'?m:m.id||m.model_name).filter(Boolean).sort();
        populateModelSelect();
    } catch(e) { els.modelSelect.innerHTML='<option>(error)</option>'; console.error(e); }
}

function populateModelSelect() {
    const currentVal = els.modelSelect.value;
    els.modelSelect.innerHTML = '';
    
    if (!allModels.length) { 
        els.modelSelect.innerHTML='<option>(no models)</option>'; 
        return; 
    }
    
    // Filter out hidden models, sort favorites first
    const visible = allModels.filter(id => !isHidden(id));
    const favorites = visible.filter(id => isFavorite(id));
    const regular = visible.filter(id => !isFavorite(id));
    
    // Helper to create option with image badge
    const createOption = (id) => {
        const o = document.createElement('option');
        o.value = id;
        o.textContent = isImageModel(id) ? '🖼️ ' + id : id;
        return o;
    };
    
    // Add favorites group
    if (favorites.length) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = '⭐ Favorites';
        favorites.forEach(id => optgroup.appendChild(createOption(id)));
        els.modelSelect.appendChild(optgroup);
    }
    
    // Add regular models
    if (regular.length) {
        if (favorites.length) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'All Models';
            regular.forEach(id => optgroup.appendChild(createOption(id)));
            els.modelSelect.appendChild(optgroup);
        } else {
            regular.forEach(id => els.modelSelect.appendChild(createOption(id)));
        }
    }
    
    // Restore selection
    const pref = localStorage.getItem(LS_MODEL);
    if (currentVal && visible.includes(currentVal)) {
        els.modelSelect.value = currentVal;
    } else if (pref && visible.includes(pref)) {
        els.modelSelect.value = pref;
    }
    const conv = activeConv();
    if (conv?.model && visible.includes(conv.model)) {
        els.modelSelect.value = conv.model;
    }
}

/* ====== Sidebar ====== */
function renderSidebar() {
    els.chatList.innerHTML = '';
    
    // Filter conversations based on selected folder
    const filtered = conversations.filter(c => {
        if (currentFolder === 'all') return true;
        if (currentFolder === 'unfiled') return !c.folderId;
        return c.folderId === currentFolder;
    });
    
    filtered.forEach(c => {
        const item = document.createElement('div');
        item.className = 'chat-item' + (c.id===activeId?' active':'');
        item.title = c.title;
        const label = document.createElement('span');
        label.textContent = c.title||'New chat';
        label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;flex:1';
        item.appendChild(label);
        const del = document.createElement('button');
        del.className='del'; del.textContent='\xd7'; del.title='Delete';
        del.onclick = e => { e.stopPropagation(); if(confirm('Delete?')) deleteConversation(c.id); };
        item.appendChild(del);
        item.addEventListener('click', () => {
            activeId = c.id;
            const opts = Array.from(els.modelSelect.options).map(o=>o.value);
            if (c.model&&opts.includes(c.model)) els.modelSelect.value=c.model;
            saveState(); renderSidebar(); renderMessages(); syncSystemPanel(); focusInput();
        });
        els.chatList.appendChild(item);
    });
}

function syncSystemPanel() { 
    const c=activeConv(); 
    els.systemInput.value=c?.systemPrompt||''; 
    renderContextFiles();
}

function renderPendingFilesList() {
    const pendingList = document.getElementById('pending-files-list');
    if (!pendingList) return;
    pendingList.innerHTML = '';
    
    if (!pendingFiles.length) {
        pendingList.innerHTML = '<p class="muted small" style="padding:8px 0">No pending attachments</p>';
        return;
    }
    
    pendingFiles.forEach((f, i) => {
        const thumb = document.createElement('div');
        thumb.className = 'context-file-thumb';
        
        if (f.isImage) {
            const img = document.createElement('img');
            img.src = f.dataUrl;
            thumb.appendChild(img);
        } else {
            const icon = document.createElement('span');
            icon.className = 'file-icon';
            icon.textContent = '📄';
            thumb.appendChild(icon);
        }
        
        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = f.name;
        thumb.appendChild(name);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => {
            pendingFiles.splice(i, 1);
            renderAttachments();
            renderPendingFilesList();
        };
        thumb.appendChild(removeBtn);
        
        pendingList.appendChild(thumb);
    });
}

function renderContextFiles() {
    const c = activeConv();
    els.contextFiles.innerHTML = '';
    if (!c?.contextFiles?.length) {
        els.contextFiles.innerHTML = '<p class="muted small" style="padding:8px 0">No context files</p>';
        return;
    }
    
    c.contextFiles.forEach((f, i) => {
        const thumb = document.createElement('div');
        thumb.className = 'context-file-thumb';
        
        if (f.isImage) {
            const img = document.createElement('img');
            img.src = f.dataUrl;
            thumb.appendChild(img);
        } else {
            const icon = document.createElement('span');
            icon.className = 'file-icon';
            icon.textContent = '📄';
            thumb.appendChild(icon);
        }
        
        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = f.name;
        thumb.appendChild(name);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => {
            c.contextFiles.splice(i, 1);
            saveState();
            renderContextFiles();
        };
        thumb.appendChild(removeBtn);
        
        els.contextFiles.appendChild(thumb);
    });
}
function renderContent(text) {
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    
    // 1. Extract code blocks and math blocks first
    const tokens = [];
    let remaining = text;
    
    // Fenced code blocks (newline after lang is optional)
    remaining = remaining.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (m, lang, code) => {
        const id = `%%TOKEN${tokens.length}%%`;
        tokens.push({type:'code', lang, code: code.replace(/^\n|\n$/g, '')});
        return id;
    });
    
    // Block math $$...$$ 
    remaining = remaining.replace(/\$\$([\s\S]+?)\$\$/g, (m, math) => {
        const id = `%%TOKEN${tokens.length}%%`;
        tokens.push({type:'blockmath', math: math.trim()});
        return id;
    });
    
    // Inline math $...$ (not preceded by \ or $)
    remaining = remaining.replace(/(?<![\\$])\$([^$\n]+)\$(?!\$)/g, (m, math) => {
        const id = `%%TOKEN${tokens.length}%%`;
        tokens.push({type:'inlinemath', math: math.trim()});
        return id;
    });
    
    // 2. Process blocks line by line
    const lines = remaining.split('\n');
    let html = '';
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i];
        
        // Blockquote
        if (/^>\s?/.test(line)) {
            let bq = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) {
                bq.push(lines[i].replace(/^>\s?/, ''));
                i++;
            }
            html += '<blockquote>' + bq.map(l => '<p>' + processInline(esc(l)) + '</p>').join('') + '</blockquote>';
            continue;
        }
        
        // Table (detect header | sep | rows)
        if (/^\|/.test(line) && i+1 < lines.length && /^\|[\s:-]+\|/.test(lines[i+1])) {
            const headerLine = line;
            const sepLine = lines[i+1];
            let rows = [];
            i += 2;
            while (i < lines.length && /^\|/.test(lines[i])) {
                rows.push(lines[i]);
                i++;
            }
            html += parseTable(headerLine, rows);
            continue;
        }
        
        // Task list
        if (/^[-*+]\s+\[[ xX]\]/.test(line)) {
            let items = [];
            while (i < lines.length && /^[-*+]\s+\[[ xX]\]/.test(lines[i])) {
                const m = lines[i].match(/^[-*+]\s+\[([ xX])\]\s*(.*)/);
                items.push({checked: m[1].toLowerCase() === 'x', text: m[2]});
                i++;
            }
            html += '<ul class="task-list">' + items.map(it => 
                '<li><input type="checkbox"' + (it.checked?' checked':'') + '> ' + processInline(esc(it.text)) + '</li>'
            ).join('') + '</ul>';
            continue;
        }
        
        // Bullet list (with nesting support)
        if (/^(\s*)[-*+]\s+/.test(line) && !/^(\s*)[-*+]\s+\[[ xX]\]/.test(line)) {
            const listResult = parseNestedList(lines, i, 'ul');
            html += listResult.html;
            i = listResult.endIndex;
            continue;
        }
        
        // Numbered list (with nesting support)
        if (/^(\s*)\d+\.\s+/.test(line)) {
            const listResult = parseNestedList(lines, i, 'ol');
            html += listResult.html;
            i = listResult.endIndex;
            continue;
        }
        
        // Headings (check longer prefixes first)
        if (/^#### /.test(line)) { html += '<h4>' + processInline(esc(line.slice(5))) + '</h4>'; i++; continue; }
        if (/^### /.test(line)) { html += '<h3>' + processInline(esc(line.slice(4))) + '</h3>'; i++; continue; }
        if (/^## /.test(line)) { html += '<h2>' + processInline(esc(line.slice(3))) + '</h2>'; i++; continue; }
        if (/^# /.test(line)) { html += '<h1>' + processInline(esc(line.slice(2))) + '</h1>'; i++; continue; }
        
        // HR
        if (/^---+$/.test(line)) { html += '<hr>'; i++; continue; }
        
        // Normal line
        html += processInline(esc(line)) + '\n';
        i++;
    }
    
    // 3. Restore tokens (replace all at once)
    tokens.forEach((tok, idx) => {
        const placeholder = `%%TOKEN${idx}%%`;
        let replacement = '';
        if (tok.type === 'code') {
            const langClass = tok.lang ? `language-${tok.lang}` : '';
            replacement = `<div class="code-block-wrap"><pre><code class="${langClass}">${esc(tok.code)}</code></pre><button class="code-copy-btn" data-copy>📋 Copy</button></div>`;
        } else if (tok.type === 'blockmath') {
            if (typeof katex !== 'undefined') {
                try { replacement = '<div class="katex-display">' + katex.renderToString(tok.math, {displayMode:true,throwOnError:false}) + '</div>'; }
                catch(e) { replacement = '<pre class="math-fallback">$$' + esc(tok.math) + '$$</pre>'; }
            } else {
                replacement = '<pre class="math-fallback">$$' + esc(tok.math) + '$$</pre>';
            }
        } else if (tok.type === 'inlinemath') {
            if (typeof katex !== 'undefined') {
                try { replacement = katex.renderToString(tok.math, {displayMode:false,throwOnError:false}); }
                catch(e) { replacement = '<code class="math-fallback">$' + esc(tok.math) + '$</code>'; }
            } else {
                replacement = '<code class="math-fallback">$' + esc(tok.math) + '$</code>';
            }
        }
        html = html.split(placeholder).join(replacement);
    });
    
    return html;
}

function processInline(t) {
    // Order matters: code first, then others
    t = t.replace(/`([^`\n]+)`/g, (_, c) => '<code>' + c + '</code>');
    t = t.replace(/\*\*([^*\n]+)\*\*/g, (_, c) => '<strong>' + c + '</strong>');
    t = t.replace(/~~([^~\n]+)~~/g, (_, c) => '<del>' + c + '</del>');
    t = t.replace(/\*([^*\n]+)\*/g, (_, c) => '<em>' + c + '</em>');
    t = t.replace(/_([^_\n]+)_/g, (_, c) => '<em>' + c + '</em>');
    // Markdown images: ![alt](url)
    t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
        return '<img class="generated-image" src="' + url + '" alt="' + alt + '" loading="lazy" onclick="window.open(this.src)">';
    });
    // Regular links
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, l, u) => '<a href="' + u + '" target="_blank" rel="noopener">' + l + '</a>');
    // Bare image URLs (http(s) ending in image extension or data:image)
    t = t.replace(/(^|[^"(])(https?:\/\/[^\s<>"]+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s<>"]*)?)([^")\w]|$)/gi, (m, pre, url, post) => {
        return pre + '<img class="generated-image" src="' + url + '" loading="lazy" onclick="window.open(this.src)">' + post;
    });
    t = t.replace(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/g, (_, dataUrl) => {
        return '<img class="generated-image" src="' + dataUrl + '" loading="lazy" onclick="window.open(this.src)">';
    });
    return t;
}

function parseTable(headerLine, rows) {
    const parseCells = line => line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const headers = parseCells(headerLine);
    let html = '<table><thead><tr>' + headers.map(h => '<th>' + processInline(h.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')) + '</th>').join('') + '</tr></thead><tbody>';
    rows.forEach(row => {
        const cells = parseCells(row);
        html += '<tr>' + cells.map(c => '<td>' + processInline(c.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')) + '</td>').join('') + '</tr>';
    });
    html += '</tbody></table>';
    return html;
}

function parseNestedList(lines, startIdx, tag) {
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const isUl = tag === 'ul';
    const itemRe = isUl ? /^(\s*)([-*+])\s+(.*)$/ : /^(\s*)(\d+\.)\s+(.*)$/;
    
    // Parse all list items with their indent levels
    const items = [];
    let i = startIdx;
    while (i < lines.length) {
        const m = lines[i].match(itemRe);
        if (!m) break;
        items.push({ indent: m[1].length, text: m[3] });
        i++;
    }
    
    // Build nested HTML recursively
    function buildList(items, level, idx) {
        let html = '<' + tag + '>';
        while (idx < items.length) {
            const item = items[idx];
            const nextItem = items[idx + 1];
            
            // Calculate effective level (every 2 spaces = 1 level)
            const itemLevel = Math.floor(item.indent / 2);
            
            if (itemLevel < level) {
                // This item belongs to parent list
                break;
            }
            
            if (itemLevel > level) {
                // Skip - handled by recursion from previous item
                idx++;
                continue;
            }
            
            // This item is at our level
            html += '<li>' + processInline(esc(item.text));
            
            // Check if next item is nested under this one
            if (nextItem && Math.floor(nextItem.indent / 2) > level) {
                const nested = buildList(items, level + 1, idx + 1);
                html += nested.html;
                idx = nested.endIdx;
            } else {
                idx++;
            }
            
            html += '</li>';
        }
        html += '</' + tag + '>';
        return { html, endIdx: idx };
    }
    
    const result = buildList(items, 0, 0);
    return { html: result.html, endIndex: startIdx + items.length };
}

/* ====== Messages ====== */
function renderMessages() {
    const conv=activeConv(); els.messages.innerHTML='';
    if (!conv||!conv.messages.length) {
        els.messages.innerHTML='<div class="empty-state"><h1>Groovy Proxy</h1>'+
            '<p>Ask anything \u00b7 drop in images, code, PDFs</p></div>';
        els.title.textContent=conv?(conv.title||'New chat'):'New chat';
        return;
    }
    els.title.textContent=conv.title||'New chat';
    conv.messages.forEach((msg,idx)=>els.messages.appendChild(buildMsgEl(msg,idx,conv)));
    scrollToBottom();
}

function buildMsgEl(msg,idx,conv) {
    const w=document.createElement('div'); w.className='message';
    const av=document.createElement('div');
    av.className='avatar '+(msg.role==='user'?'user':'assistant');
    av.textContent=msg.role==='user'?'U':'AI';
    const bub=document.createElement('div'); bub.className='bubble';
    const rl=document.createElement('div'); rl.className='role';
    rl.textContent=msg.role==='user'?getUsername():'Assistant';
    // Add timestamp if available
    if (msg.timestamp) {
        const ts = document.createElement('span');
        ts.className = 'message-time';
        ts.textContent = ' · ' + formatTimestamp(msg.timestamp);
        rl.appendChild(ts);
    }
    const ct=document.createElement('div'); ct.className='content';
    let html='';
    if (msg.images?.length) msg.images.forEach(s=>{html+='<img class="msg-image" src="'+s+'" loading="lazy">';});
    html+=renderContent(msg.content||'');
    ct.innerHTML=html;
    
    // If this message has generated images stored in IndexedDB, load them
    if (msg.generatedImages?.length) {
        renderGeneratedImages(ct, msg.generatedImages);
    }
    
    const acts=document.createElement('div'); acts.className='msg-actions';
    acts.appendChild(makeBtn('\ud83d\udccb Copy',()=>navigator.clipboard.writeText(msg.content||'')));
    if (msg.role==='assistant') {
        acts.appendChild(makeBtn('\u21bb Regen',()=>regenerate(idx)));
        acts.appendChild(makeBtn('💬 Quote',()=>quoteMessage(msg.content||'')));
    }
    if (msg.role==='user') acts.appendChild(makeBtn('\u270e Edit',()=>editAndResend(idx)));
    bub.appendChild(rl); bub.appendChild(ct); bub.appendChild(acts);
    w.appendChild(av); w.appendChild(bub);
    return w;
}
function makeBtn(label,fn){const b=document.createElement('button');b.className='msg-action-btn';b.textContent=label;b.onclick=fn;return b;}
function scrollToBottom(){els.messages.scrollTop=els.messages.scrollHeight;}
function focusInput(){els.input.focus();}
function setSending(on){els.sendBtn.disabled=false;els.sendBtn.textContent=on?'\u25a0':'\u2191';els.sendBtn.title=on?'Stop':'Send';}

function regenerate(idx){
    const conv=activeConv();if(!conv)return;
    conv.messages=conv.messages.slice(0,idx);saveState();renderMessages();
    if(conv.messages.length&&conv.messages[conv.messages.length-1].role==='user'){
        const u=conv.messages.pop();saveState();sendMessage(u.content,u.images||[]);
    }
}
function editAndResend(idx){
    const conv=activeConv();if(!conv)return;
    const msg=conv.messages[idx];els.input.value=msg.content||'';autoResize();
    conv.messages=conv.messages.slice(0,idx);saveState();renderMessages();focusInput();
}

/* ====== Attachments ====== */
const TEXT_EXTS = /\.(txt|md|json|csv|tsv|log|xml|yaml|yml|ini|cfg|toml|py|js|ts|tsx|jsx|java|kt|go|rs|rb|php|c|h|cpp|hpp|cs|swift|sh|zsh|bash|sql|html|css|scss|less|vue|svelte)$/i;
function isTextFile(f){return TEXT_EXTS.test(f.name)||f.type.startsWith('text/');}
function isImageFile(f){return f.type.startsWith('image/');}
function isPDF(f){return f.type==='application/pdf'||f.name.endsWith('.pdf');}

function fileToDataUrl(file){
    return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
}

async function extractPdfText(file){
    if(typeof pdfjsLib==='undefined'){
        try{await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs');}catch{}
    }
    const lib=globalThis.pdfjsLib||window.pdfjsLib;
    if(!lib) throw new Error('PDF.js not loaded');
    lib.GlobalWorkerOptions.workerSrc='';
    const buf=await file.arrayBuffer();
    const doc=await lib.getDocument({data:buf}).promise;
    const pages=[];
    for(let i=1;i<=doc.numPages;i++){
        const pg=await doc.getPage(i);
        const tc=await pg.getTextContent();
        pages.push(tc.items.map(it=>it.str).join(' '));
    }
    return pages.join('\n\n');
}

async function processFile(file){
    if(file.size>MAX_FILE){alert(file.name+' exceeds 10 MB');return null;}
    if(isImageFile(file)){return{name:file.name,type:file.type,dataUrl:await fileToDataUrl(file),isImage:true};}
    if(isTextFile(file)){return{name:file.name,type:file.type,text:await file.text(),isImage:false};}
    if(isPDF(file)){
        try{return{name:file.name,type:'application/pdf',text:await extractPdfText(file),isImage:false};}
        catch(e){alert('PDF error: '+e.message);return null;}
    }
    alert('Unsupported: '+file.name);return null;
}

async function addFiles(fileList){
    for(const f of fileList){const r=await processFile(f);if(r)pendingFiles.push(r);}
    renderAttachments();
}
function renderAttachments(){
    els.attachments.innerHTML='';
    if(!pendingFiles.length){els.attachments.classList.add('hidden');return;}
    els.attachments.classList.remove('hidden');
    pendingFiles.forEach((f,i)=>{
        const th=document.createElement('div');th.className='attachment-thumb';
        if(f.isImage){const img=document.createElement('img');img.src=f.dataUrl;th.appendChild(img);}
        else{const ic=document.createElement('div');ic.className='file-icon';ic.textContent='\ud83d\udcc4';th.appendChild(ic);}
        const nm=document.createElement('div');nm.className='file-name';nm.textContent=f.name;th.appendChild(nm);
        const rm=document.createElement('button');rm.className='remove-btn';rm.textContent='\xd7';
        rm.onclick=()=>{pendingFiles.splice(i,1);renderAttachments();};
        th.appendChild(rm);
        els.attachments.appendChild(th);
    });
}

/* ====== Build API message content ====== */
function buildMessageContent(text, images, textFiles) {
    // If we have images, use multimodal content array format
    if (images.length) {
        const parts = [];
        images.forEach(url => parts.push({type:'image_url',image_url:{url}}));
        let fullText = text;
        textFiles.forEach(f => { fullText += '\n\n--- '+f.name+' ---\n'+f.text; });
        parts.push({type:'text',text:fullText});
        return parts;
    }
    // Text-only: inline file contents
    let fullText = text;
    textFiles.forEach(f => { fullText += '\n\n--- '+f.name+' ---\n```\n'+f.text+'\n```'; });
    return fullText;
}

/* ====== Streaming / Send ====== */
async function sendMessage(text, existingImages) {
    text = (text||'').trim();
    const images = existingImages || pendingFiles.filter(f=>f.isImage).map(f=>f.dataUrl);
    const textFiles = pendingFiles.filter(f=>!f.isImage);
    if (!text && !images.length && !textFiles.length) return;
    pendingFiles = []; renderAttachments();

    let conv = activeConv();
    if (!conv) { createConversation(); conv = activeConv(); }
    const model = els.modelSelect.value;
    if (!model||model.startsWith('(')) { alert('No model available'); return; }
    conv.model = model;
    if (!conv.messages.length) conv.title = text.length>40?text.slice(0,40)+'\u2026':text||'Image chat';

    const content = buildMessageContent(text, images, textFiles);
    conv.messages.push({role:'user',content:text,images:images.length?images:undefined,timestamp:Date.now()});
    const assistantMsg = {role:'assistant',content:'',timestamp:Date.now()};
    conv.messages.push(assistantMsg);
    saveState(); renderSidebar(); renderMessages();

    const lastEl = els.messages.lastElementChild;
    const contentEl = lastEl?.querySelector('.content');
    if(contentEl) contentEl.innerHTML='<span class="cursor"></span>';

    setSending(true);
    hideResponseStats();
    const controller = new AbortController();
    streamingAbort = controller;
    let acc = '';
    const startTime = Date.now();

    const applyChunk = delta => {
        if(!delta)return; acc+=delta; assistantMsg.content=acc;
        if(contentEl){contentEl.innerHTML=renderContent(acc)+'<span class="cursor"></span>';scrollToBottom();}
    };

    // Build messages array for API
    const apiMsgs = [];
    if (conv.systemPrompt) apiMsgs.push({role:'system',content:conv.systemPrompt});
    
    // Add folder context files first (if conversation is in a folder)
    const folderContext = getFolderContextFiles(conv.folderId);
    if (folderContext.length) {
        const folderImages = folderContext.filter(f => f.isImage).map(f => f.dataUrl);
        const folderText = folderContext.filter(f => !f.isImage);
        const folderContent = buildMessageContent('[Folder context files attached]', folderImages, folderText);
        apiMsgs.push({role:'user', content: folderContent});
        apiMsgs.push({role:'assistant', content: 'I\'ve received the folder context files. I\'ll use them to help with our conversation.'});
    }
    
    // Add conversation context files (if any)
    if (conv.contextFiles?.length) {
        const contextImages = conv.contextFiles.filter(f => f.isImage).map(f => f.dataUrl);
        const contextText = conv.contextFiles.filter(f => !f.isImage);
        const contextContent = buildMessageContent('[Context files attached]', contextImages, contextText);
        apiMsgs.push({role:'user', content: contextContent});
        apiMsgs.push({role:'assistant', content: 'I\'ve received the context files. I\'ll use them to help with our conversation.'});
    }
    conv.messages.slice(0,-1).forEach(m => {
        if(m.role==='user' && m.images?.length){
            apiMsgs.push({role:'user',content:buildMessageContent(m.content,m.images,[])});
        } else {
            apiMsgs.push({role:m.role,content:m.content});
        }
    });
    // Replace last user msg content with the rich version (images+files)
    if(apiMsgs.length && apiMsgs[apiMsgs.length-1].role==='user'){
        apiMsgs[apiMsgs.length-1].content = content;
    }

    const apiKey = getApiKey();
    try {
        const resp = await fetch('/api/v1/chat/completions',{
            method:'POST',
            headers:{
                'Content-Type':'application/json',
                'Accept':'text/event-stream',
                ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
            },
            body:JSON.stringify({model,stream:true,messages:apiMsgs}),
            signal:controller.signal,
        });
        if(!resp.ok){const e=await resp.text().catch(()=>'');throw new Error('HTTP '+resp.status+': '+(e||resp.statusText));}

        const ctype=(resp.headers.get('content-type')||'').toLowerCase();
        if(!ctype.includes('event-stream')&&!ctype.includes('text/plain')||!resp.body){
            const data=await resp.json();
            applyChunk(data.choices?.[0]?.message?.content??data.choices?.[0]?.text??'');
        } else {
            const reader=resp.body.getReader();
            const dec=new TextDecoder();
            let buf='',done=false;
            while(!done){
                const chunk=await reader.read();
                if(chunk.done)break;
                buf+=dec.decode(chunk.value,{stream:true});
                let nl;
                while((nl=buf.indexOf('\n'))!==-1){
                    const line=buf.slice(0,nl).replace(/\r$/,'').trim();
                    buf=buf.slice(nl+1);
                    if(!line||!line.startsWith('data:'))continue;
                    const payload=line.slice(5).trim();
                    if(payload==='[DONE]'){done=true;break;}
                    try{
                        const obj=JSON.parse(payload);
                        applyChunk(obj.choices?.[0]?.delta?.content??obj.choices?.[0]?.message?.content??obj.choices?.[0]?.text??'');
                    }catch{}
                }
            }
            if(buf.length){
                const line=buf.trim();
                if(line.startsWith('data:')&&line.slice(5).trim()!=='[DONE]'){
                    try{const obj=JSON.parse(line.slice(5).trim());applyChunk(obj.choices?.[0]?.delta?.content??'');}catch{}
                }
            }
        }
        if(!acc) applyChunk('_(empty response)_');
        assistantMsg.content=acc;
        if(contentEl) contentEl.innerHTML=renderContent(acc);
        highlightCode();
        
        // Show response stats
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const totalTokens = estimateTokens(acc);
        const tokensPerSec = parseFloat(elapsed) > 0 ? (totalTokens / parseFloat(elapsed)).toFixed(1) : 0;
        showResponseStats({
            model: model.split('/').pop(),
            tokens: totalTokens,
            time: elapsed,
            tokensPerSec
        });
        
        // Show continue button for long responses
        if (acc.length > 3000) {
            showContinueButton(conv.messages.length - 1);
        }
        
        saveState();
    } catch(err) {
        if(err.name==='AbortError') assistantMsg.content=acc||'_(stopped)_';
        else{console.error(err);assistantMsg.content=(acc?acc+'\n\n':'')+'**Error:** '+err.message;}
        if(contentEl) contentEl.innerHTML=renderContent(assistantMsg.content);
        saveState();
    } finally { streamingAbort=null; setSending(false); focusInput(); }
}

/* ====== Events ====== */
function autoResize(){els.input.style.height='auto';els.input.style.height=Math.min(els.input.scrollHeight,220)+'px';}

els.composer.addEventListener('submit', e => {
    e.preventDefault();
    if(streamingAbort){streamingAbort.abort();return;}
    const text=els.input.value; els.input.value=''; autoResize();
    if(imageMode) sendImageGeneration(text);
    else sendMessage(text);
});
els.input.addEventListener('keydown', e => {
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();els.composer.requestSubmit();}
});
els.input.addEventListener('input', () => {
    autoResize();
    els.charCounter.textContent = els.input.value.length + ' chars';
    updateTokenEstimate();
});

els.newChatBtn.addEventListener('click', createConversation);
els.clearBtn.addEventListener('click', () => {
    const c=activeConv(); if(c&&confirm('Delete this chat?')) deleteConversation(c.id);
});
els.modelSelect.addEventListener('change', () => {
    const model = els.modelSelect.value;
    localStorage.setItem(LS_MODEL, model);
    const c=activeConv(); if(c){c.model=model;saveState();}
    // Auto-switch mode based on model type
    updateModeForModel(model);
    updateModelPickerLabel();
});

// System prompt (now in settings modal)
els.systemInput?.addEventListener('input', () => {
    const c=activeConv(); if(c){c.systemPrompt=els.systemInput.value;saveState();}
});

// Context files
els.addContextBtn.addEventListener('click', () => els.contextFileInput.click());
els.contextFileInput.addEventListener('change', async () => {
    const files = els.contextFileInput.files;
    if (!files.length) return;
    const c = activeConv();
    if (!c) { createConversation(); }
    const conv = activeConv();
    if (!conv.contextFiles) conv.contextFiles = [];
    
    for (const f of files) {
        const result = await processFile(f);
        if (result) {
            conv.contextFiles.push(result);
        }
    }
    saveState();
    renderContextFiles();
    els.contextFileInput.value = '';
});

// Attach button + file input
els.attachBtn.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', () => {
    if(els.fileInput.files.length) addFiles(els.fileInput.files);
    els.fileInput.value='';
});

// Drag and drop
let dragCounter = 0;
document.addEventListener('dragenter', e => {
    e.preventDefault(); dragCounter++;
    els.dropOverlay.classList.remove('hidden');
});
document.addEventListener('dragleave', e => {
    e.preventDefault(); dragCounter--;
    if(dragCounter<=0){dragCounter=0;els.dropOverlay.classList.add('hidden');}
});
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
    e.preventDefault(); dragCounter=0; els.dropOverlay.classList.add('hidden');
    if(e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

// Paste image
els.input.addEventListener('paste', e => {
    const items = e.clipboardData?.items;
    if(!items) return;
    const files = [];
    for(const it of items){ if(it.kind==='file') files.push(it.getAsFile()); }
    if(files.length) addFiles(files);
});

// Copy code block (delegated)
document.addEventListener('click', e => {
    const btn = e.target.closest('[data-copy]');
    if(!btn) return;
    const pre = btn.closest('.code-block-wrap')?.querySelector('pre');
    if(!pre) return;
    navigator.clipboard.writeText(pre.textContent).then(() => {
        btn.textContent='\u2713 Copied!'; btn.classList.add('copied');
        setTimeout(()=>{btn.textContent='\ud83d\udccb Copy';btn.classList.remove('copied');},1500);
    });
});

// Rename conversation on double-click
els.title.addEventListener('dblclick', () => {
    const c=activeConv(); if(!c) return;
    els.title.contentEditable='true';
    els.title.focus();
    const range=document.createRange(); range.selectNodeContents(els.title);
    window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
});
els.title.addEventListener('blur', () => {
    els.title.contentEditable='false';
    const c=activeConv(); if(!c) return;
    const newTitle=els.title.textContent.trim();
    if(newTitle) c.title=newTitle;
    els.title.textContent=c.title;
    saveState(); renderSidebar();
});
els.title.addEventListener('keydown', e => {
    if(e.key==='Enter'){e.preventDefault();els.title.blur();}
    if(e.key==='Escape'){els.title.textContent=activeConv()?.title||'';els.title.blur();}
});

// Export - show modal (triggered from settings modal)

function showExportModal(conv) {
    // Remove existing
    document.getElementById('export-modal')?.remove();
    
    const modal = document.createElement('div');
    modal.id = 'export-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>📤 Export Chat</h3>
                <button class="modal-close ghost-btn">✕</button>
            </div>
            <div class="modal-body">
                <div class="export-options">
                    <button class="export-option" data-format="md">
                        <span class="export-icon">📝</span>
                        <span class="export-label">Markdown</span>
                        <span class="export-desc">.md file with formatting</span>
                    </button>
                    <button class="export-option" data-format="json">
                        <span class="export-icon">🔧</span>
                        <span class="export-label">JSON</span>
                        <span class="export-desc">Full data export</span>
                    </button>
                    <button class="export-option" data-format="txt">
                        <span class="export-icon">📄</span>
                        <span class="export-label">Plain Text</span>
                        <span class="export-desc">Simple text format</span>
                    </button>
                    <button class="export-option" data-format="html">
                        <span class="export-icon">🌐</span>
                        <span class="export-label">HTML</span>
                        <span class="export-desc">Standalone webpage</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.querySelectorAll('.export-option').forEach(btn => {
        btn.onclick = () => {
            exportConversation(conv, btn.dataset.format);
            modal.remove();
        };
    });
}

function exportConversation(conv, format) {
    const filename = (conv.title||'chat').replace(/[^a-zA-Z0-9 _-]/g,'');
    let content, mimeType, ext;
    
    switch(format) {
        case 'md':
            content = exportToMarkdown(conv);
            mimeType = 'text/markdown';
            ext = 'md';
            break;
        case 'json':
            content = exportToJSON(conv);
            mimeType = 'application/json';
            ext = 'json';
            break;
        case 'txt':
            content = exportToText(conv);
            mimeType = 'text/plain';
            ext = 'txt';
            break;
        case 'html':
            content = exportToHTML(conv);
            mimeType = 'text/html';
            ext = 'html';
            break;
        default:
            return;
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportToMarkdown(conv) {
    let md = '# ' + conv.title + '\n\n';
    md += `> Exported: ${new Date().toLocaleString()}\n\n`;
    if (conv.systemPrompt) md += '> **System Prompt:** ' + conv.systemPrompt + '\n\n---\n\n';
    conv.messages.forEach(m => {
        const ts = m.timestamp ? ` *(${formatTimestamp(m.timestamp)})*` : '';
        md += '### ' + (m.role==='user'?'You':'Assistant') + ts + '\n\n' + m.content + '\n\n';
    });
    return md;
}

function exportToJSON(conv) {
    return JSON.stringify({
        title: conv.title,
        model: conv.model,
        systemPrompt: conv.systemPrompt,
        messages: conv.messages,
        exportedAt: new Date().toISOString()
    }, null, 2);
}

function exportToText(conv) {
    let txt = conv.title + '\n' + '='.repeat(conv.title.length) + '\n\n';
    if (conv.systemPrompt) txt += 'System: ' + conv.systemPrompt + '\n\n';
    conv.messages.forEach(m => {
        txt += (m.role==='user'?'You':'Assistant') + ':\n' + m.content + '\n\n';
    });
    return txt;
}

function exportToHTML(conv) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${conv.title}</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #1f2415; color: #f3e9c8; }
        h1 { color: #e89346; }
        .message { margin: 20px 0; padding: 15px; border-radius: 12px; }
        .user { background: rgba(58, 42, 28, 0.92); border-left: 4px solid #d6622b; }
        .assistant { background: rgba(42, 48, 30, 0.92); border-left: 4px solid #b3bd5a; }
        .role { font-weight: bold; margin-bottom: 8px; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
        .user .role { color: #e89346; }
        .assistant .role { color: #b3bd5a; }
        pre { background: #14180b; padding: 12px; border-radius: 8px; overflow-x: auto; }
        code { font-family: monospace; }
        .meta { color: #a39773; font-size: 12px; margin-top: 10px; }
    </style>
</head>
<body>
    <h1>${conv.title}</h1>
    ${conv.systemPrompt ? `<p><strong>System:</strong> ${conv.systemPrompt}</p><hr>` : ''}
    ${conv.messages.map(m => `
        <div class="message ${m.role}">
            <div class="role">${m.role === 'user' ? 'You' : 'Assistant'}</div>
            <div class="content">${m.content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
            ${m.timestamp ? `<div class="meta">${new Date(m.timestamp).toLocaleString()}</div>` : ''}
        </div>
    `).join('')}
    <p class="meta">Exported: ${new Date().toLocaleString()}</p>
</body>
</html>`;
}

// Enhanced Keyboard shortcuts
document.addEventListener('keydown', e => {
    const meta = e.metaKey||e.ctrlKey;
    // Model picker
    if(meta&&e.key==='k'){e.preventDefault();els.modelPickerBtn?.click();}
    // New chat
    if(meta&&e.key==='n'){e.preventDefault();createConversation();}
    // Delete chat
    if(meta&&e.key==='Backspace'){e.preventDefault();const c=activeConv();if(c&&confirm('Delete?'))deleteConversation(c.id);}
    // Stop streaming
    if(e.key==='Escape'&&streamingAbort){streamingAbort.abort();}
    // Focus input
    if(meta&&e.key==='/'){e.preventDefault();focusInput();}
    // Toggle settings
    if(meta&&e.key===','){e.preventDefault();openSettingsModal();}
    // Export chat
    if(meta&&e.shiftKey&&e.key==='E'){e.preventDefault();showExportModal(activeConv());}
    // Toggle split view
    if(meta&&e.key==='\\'){e.preventDefault();document.getElementById('split-btn')?.click();}
    // Search conversations
    if(meta&&e.shiftKey&&e.key==='F'){e.preventDefault();openSearchModal();}
    // Navigate conversations (up/down)
    if(meta&&e.key==='ArrowUp'){e.preventDefault();navigateConversation(-1);}
    if(meta&&e.key==='ArrowDown'){e.preventDefault();navigateConversation(1);}
    // Copy last response
    if(meta&&e.shiftKey&&e.key==='C'){e.preventDefault();copyLastResponse();}
});

function navigateConversation(direction) {
    const idx = conversations.findIndex(c => c.id === activeId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < conversations.length) {
        activeId = conversations[newIdx].id;
        saveState();
        renderSidebar();
        renderMessages();
        syncSystemPanel();
    }
}

function copyLastResponse() {
    const conv = activeConv();
    if (!conv) return;
    const lastAssistant = [...conv.messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant?.content) {
        navigator.clipboard.writeText(lastAssistant.content);
    }
}

/* ====== Conversation Search ====== */
function openSearchModal() {
    document.getElementById('search-modal')?.remove();
    
    const modal = document.createElement('div');
    modal.id = 'search-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content search-modal">
            <div class="modal-header">
                <h3>🔍 Search Conversations</h3>
                <button class="modal-close ghost-btn">✕</button>
            </div>
            <div class="search-input-wrap">
                <input type="text" id="conv-search-input" placeholder="Search by title or content..." autofocus />
            </div>
            <div id="search-results" class="search-results"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = modal.querySelector('#conv-search-input');
    const results = modal.querySelector('#search-results');
    
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    input.oninput = () => {
        const query = input.value.toLowerCase().trim();
        if (!query) {
            results.innerHTML = '<div class="search-hint">Type to search...</div>';
            return;
        }
        
        const matches = [];
        conversations.forEach(conv => {
            // Search in title
            if (conv.title?.toLowerCase().includes(query)) {
                matches.push({ conv, type: 'title', preview: conv.title });
            }
            // Search in messages
            conv.messages?.forEach((msg, idx) => {
                if (msg.content?.toLowerCase().includes(query)) {
                    const start = Math.max(0, msg.content.toLowerCase().indexOf(query) - 30);
                    const preview = (start > 0 ? '...' : '') + msg.content.slice(start, start + 100) + '...';
                    matches.push({ conv, type: msg.role, msgIdx: idx, preview });
                }
            });
        });
        
        if (!matches.length) {
            results.innerHTML = '<div class="search-empty">No results found</div>';
            return;
        }
        
        results.innerHTML = matches.slice(0, 20).map((m, i) => `
            <div class="search-result" data-idx="${i}">
                <div class="search-result-title">${m.conv.title || 'Untitled'}</div>
                <div class="search-result-preview">${m.type === 'title' ? '📌 Title match' : (m.type === 'user' ? '👤' : '🤖') + ' ' + m.preview}</div>
            </div>
        `).join('');
        
        results.querySelectorAll('.search-result').forEach((el, i) => {
            el.onclick = () => {
                const match = matches[i];
                activeId = match.conv.id;
                saveState();
                renderSidebar();
                renderMessages();
                syncSystemPanel();
                modal.remove();
                // Scroll to message if applicable
                if (match.msgIdx !== undefined) {
                    setTimeout(() => {
                        const msgEl = els.messages.children[match.msgIdx];
                        if (msgEl) msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                }
            };
        });
    };
    
    input.onkeydown = (e) => {
        if (e.key === 'Escape') modal.remove();
        if (e.key === 'Enter') {
            const first = results.querySelector('.search-result');
            if (first) first.click();
        }
    };
    
    input.focus();
}

// Mode toggle (Chat / Image)
els.modeToggle.addEventListener('click', () => {
    imageMode = !imageMode;
    els.modeToggle.textContent = imageMode ? '🖼️ Image' : '💬 Chat';
    els.modeToggle.classList.toggle('image-mode', imageMode);
    els.input.placeholder = imageMode 
        ? 'Describe the image to generate...' 
        : 'Message…  (drop or paste files · Shift+Enter for newline)';
});

/* ====== Image Generation ====== */
async function sendImageGeneration(prompt) {
    prompt = (prompt||'').trim();
    if (!prompt) return;
    pendingFiles = []; renderAttachments();

    let conv = activeConv();
    if (!conv) { createConversation(); conv = activeConv(); }
    const model = els.modelSelect.value;
    if (!model||model.startsWith('(')) { alert('No model available'); return; }
    conv.model = model;
    if (!conv.messages.length) conv.title = prompt.length>40?prompt.slice(0,40)+'…':'Image: '+prompt;

    conv.messages.push({role:'user',content:prompt,timestamp:Date.now()});
    const assistantMsg = {role:'assistant',content:'_Generating image..._', generatedImages:[],timestamp:Date.now()};
    conv.messages.push(assistantMsg);
    saveState(); renderSidebar(); renderMessages();

    const lastEl = els.messages.lastElementChild;
    const contentEl = lastEl?.querySelector('.content');
    if(contentEl) contentEl.innerHTML='<em>Generating image...</em><span class="cursor"></span>';

    setSending(true);
    const controller = new AbortController();
    streamingAbort = controller;

    const apiKey = getApiKey();
    try {
        const resp = await fetch('/api/v1/images/generations',{
            method:'POST',
            headers:{
                'Content-Type':'application/json',
                ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
            },
            body:JSON.stringify({model, prompt, n:1, size:'1024x1024'}),
            signal:controller.signal,
        });
        if(!resp.ok){const e=await resp.text().catch(()=>'');throw new Error('HTTP '+resp.status+': '+(e||resp.statusText));}
        
        const data = await resp.json();
        console.log('Image generation response:', data);
        
        // Try multiple response formats
        const images = data.data || data.images || data.artifacts || [];
        const storedImageIds = [];
        
        // Process each image
        for (let idx = 0; idx < images.length; idx++) {
            const img = images[idx];
            // Try various URL field names
            const url = img.url || img.image_url || img.uri || img.link;
            const b64 = img.b64_json || img.base64 || img.image;
            
            if (url) {
                // External URL - store the URL directly (no localStorage issues)
                storedImageIds.push({ type: 'url', url });
            } else if (b64) {
                // Base64 - store in IndexedDB, keep only reference
                const mime = img.content_type || 'image/png';
                const dataUrl = `data:${mime};base64,${b64}`;
                const imageId = 'img_' + newId();
                try {
                    await storeImage(imageId, dataUrl);
                    storedImageIds.push({ type: 'idb', id: imageId });
                } catch (e) {
                    console.error('Failed to store image in IndexedDB:', e);
                    // Fallback: try to display inline but truncate for storage
                    storedImageIds.push({ type: 'url', url: dataUrl });
                }
            }
        }
        
        // Fallback: check if response itself has url/b64
        if (!storedImageIds.length && data.url) {
            storedImageIds.push({ type: 'url', url: data.url });
        }
        if (!storedImageIds.length && data.b64_json) {
            const dataUrl = `data:image/png;base64,${data.b64_json}`;
            const imageId = 'img_' + newId();
            try {
                await storeImage(imageId, dataUrl);
                storedImageIds.push({ type: 'idb', id: imageId });
            } catch (e) {
                storedImageIds.push({ type: 'url', url: dataUrl });
            }
        }
        
        if (storedImageIds.length) {
            // Store image references in the message (not the actual data)
            assistantMsg.generatedImages = storedImageIds;
            assistantMsg.content = `_Generated ${storedImageIds.length} image${storedImageIds.length>1?'s':''}_`;
            
            // Render images directly into the content element
            await renderGeneratedImages(contentEl, storedImageIds);
        } else {
            // No images found - show debug info
            assistantMsg.content = `_(No images found in response)_\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
            if(contentEl) contentEl.innerHTML = renderContent(assistantMsg.content);
        }
        
        saveState();
    } catch(err) {
        if(err.name==='AbortError') assistantMsg.content='_(stopped)_';
        else{console.error(err);assistantMsg.content='**Error:** '+err.message;}
        if(contentEl) contentEl.innerHTML=renderContent(assistantMsg.content);
        saveState();
    } finally { streamingAbort=null; setSending(false); focusInput(); }
}

/* ====== Render Generated Images ====== */
async function renderGeneratedImages(container, imageRefs) {
    if (!container || !imageRefs?.length) return;
    
    container.innerHTML = '';
    
    for (let i = 0; i < imageRefs.length; i++) {
        const ref = imageRefs[i];
        const wrapper = document.createElement('div');
        wrapper.className = 'generated-image-wrapper';
        
        const img = document.createElement('img');
        img.className = 'generated-image';
        img.alt = `Generated image ${i + 1}`;
        img.loading = 'lazy';
        
        if (ref.type === 'url') {
            img.src = ref.url;
        } else if (ref.type === 'idb') {
            // Load from IndexedDB
            try {
                const dataUrl = await getImage(ref.id);
                if (dataUrl) {
                    img.src = dataUrl;
                } else {
                    img.alt = 'Image not found (may have been cleared)';
                    img.style.display = 'none';
                    wrapper.innerHTML = '<em>Image expired or not found</em>';
                    container.appendChild(wrapper);
                    continue;
                }
            } catch (e) {
                console.error('Failed to load image from IndexedDB:', e);
                wrapper.innerHTML = '<em>Failed to load image</em>';
                container.appendChild(wrapper);
                continue;
            }
        }
        
        // Add click to open full size
        img.onclick = () => {
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(`<html><head><title>Generated Image</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a1a;}</style></head><body><img src="${img.src}" style="max-width:100%;max-height:100vh;"></body></html>`);
            }
        };
        img.style.cursor = 'pointer';
        
        wrapper.appendChild(img);
        
        // Add download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'image-download-btn';
        downloadBtn.textContent = '⬇ Download';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            const a = document.createElement('a');
            a.href = img.src;
            a.download = `generated-image-${Date.now()}.png`;
            a.click();
        };
        wrapper.appendChild(downloadBtn);
        
        container.appendChild(wrapper);
    }
}

/* ====== Model Settings Panel ====== */
function createModelSettingsPanel() {
    // Create the panel if it doesn't exist
    if (document.getElementById('model-settings-panel')) return;
    
    const panel = document.createElement('div');
    panel.id = 'model-settings-panel';
    panel.className = 'settings-modal hidden';
    panel.innerHTML = `
        <div class="settings-modal-content">
            <div class="settings-modal-header">
                <h3>⚙️ Settings</h3>
                <button id="close-model-settings" class="ghost-btn">✕</button>
            </div>
            <div class="settings-modal-body">
                <div class="settings-sidebar">
                    <button class="settings-nav-btn active" data-tab="general">🎨 General</button>
                    <button class="settings-nav-btn" data-tab="models">🤖 Models</button>
                    <button class="settings-nav-btn" data-tab="folders">📁 Folders</button>
                    <button class="settings-nav-btn" data-tab="files">📎 Files</button>
                    <button class="settings-nav-btn" data-tab="api">🔑 API</button>
                    <button class="settings-nav-btn" data-tab="export">📤 Export</button>
                </div>
                <div class="settings-main">
                    <!-- General Tab -->
                    <div class="settings-pane active" data-pane="general">
                        <h4>Appearance</h4>
                        <div class="settings-field">
                            <label>Theme</label>
                            <select id="panel-theme-select">
                                <option value="dark">🌙 Dark (Olive)</option>
                                <option value="light">☀️ Light (Sunburst)</option>
                            </select>
                        </div>
                        <div class="settings-field">
                            <label>Display Name</label>
                            <input type="text" id="panel-username-input" placeholder="Your name..." />
                        </div>
                        <h4>System Prompt</h4>
                        <div class="settings-field">
                            <textarea id="panel-system-input" rows="4" placeholder="Enter a system prompt for new conversations..."></textarea>
                        </div>
                    </div>
                    
                    <!-- Models Tab -->
                    <div class="settings-pane" data-pane="models">
                        <h4>Model Management</h4>
                        <div class="model-settings-search">
                            <input type="text" id="settings-model-search" placeholder="Search models..." />
                        </div>
                        <div class="model-settings-filters">
                            <label><input type="checkbox" id="panel-show-hidden-models"> Show hidden models</label>
                        </div>
                        <div id="settings-model-list" class="model-list"></div>
                        <div class="model-settings-stats">
                            <span id="model-stats"></span>
                        </div>
                    </div>
                    
                    <!-- Folders Tab -->
                    <div class="settings-pane" data-pane="folders">
                        <h4>Manage Folders</h4>
                        <div class="folder-create-row">
                            <input type="text" id="panel-new-folder-input" placeholder="New folder name..." />
                            <button id="panel-create-folder-btn" class="ghost-btn">+ Create</button>
                        </div>
                        <div id="panel-folder-list" class="folder-list"></div>
                        <div id="panel-folder-contents"></div>
                    </div>
                    
                    <!-- Files Tab -->
                    <div class="settings-pane" data-pane="files">
                        <h4>Context Files</h4>
                        <p class="muted small">Files added here will be included in all new messages.</p>
                        <div id="panel-context-files" class="context-files-list"></div>
                        <input type="file" id="panel-context-file-input" multiple hidden />
                        <button id="panel-add-context-btn" class="add-context-btn">+ Add Context Files</button>
                        
                        <h4>Pending Attachments</h4>
                        <p class="muted small">Files waiting to be sent with your next message.</p>
                        <div id="panel-pending-files" class="context-files-list"></div>
                    </div>
                    
                    <!-- API Tab -->
                    <div class="settings-pane" data-pane="api">
                        <h4>API Configuration</h4>
                        <div class="settings-field">
                            <label>API Key (optional)</label>
                            <div class="api-key-row">
                                <input type="password" id="panel-api-key-input" placeholder="sk-..." />
                                <button id="panel-toggle-api-key" class="ghost-btn small">👁</button>
                            </div>
                        </div>
                        <div class="settings-field">
                            <label>API Base URL (optional)</label>
                            <input type="text" id="panel-api-base-input" placeholder="https://api.example.com" />
                        </div>
                    </div>
                    
                    <!-- Export Tab -->
                    <div class="settings-pane" data-pane="export">
                        <h4>Export Current Conversation</h4>
                        <div class="export-buttons">
                            <button class="export-btn-large" data-format="json">
                                <span class="export-icon">📄</span>
                                <span>JSON</span>
                            </button>
                            <button class="export-btn-large" data-format="md">
                                <span class="export-icon">📝</span>
                                <span>Markdown</span>
                            </button>
                            <button class="export-btn-large" data-format="txt">
                                <span class="export-icon">📃</span>
                                <span>Plain Text</span>
                            </button>
                            <button class="export-btn-large" data-format="html">
                                <span class="export-icon">🌐</span>
                                <span>HTML</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    
    // Close button
    document.getElementById('close-model-settings').onclick = () => panel.classList.add('hidden');
    
    // Click outside to close
    panel.onclick = (e) => { if (e.target === panel) panel.classList.add('hidden'); };
    
    // Tab navigation
    panel.querySelectorAll('.settings-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            panel.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.toggle('active', b === btn));
            panel.querySelectorAll('.settings-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === target));
            
            // Render specific tab content
            if (target === 'models') renderSettingsModelList();
            if (target === 'folders') renderPanelFolderList();
            if (target === 'files') {
                renderPanelContextFiles();
                renderPanelPendingFiles();
            }
        });
    });
    
    // Search
    document.getElementById('settings-model-search').oninput = (e) => renderSettingsModelList(e.target.value);
    
    // Show hidden toggle
    document.getElementById('panel-show-hidden-models').onchange = () => renderSettingsModelList();
    
    // Theme select
    document.getElementById('panel-theme-select').onchange = (e) => {
        document.documentElement.setAttribute('data-theme', e.target.value);
        localStorage.setItem(LS_THEME, e.target.value);
    };
    
    // Username input
    document.getElementById('panel-username-input').oninput = (e) => {
        setUsername(e.target.value.trim());
        renderMessages();
    };
    
    // System prompt
    document.getElementById('panel-system-input').oninput = (e) => {
        const conv = activeConv();
        if (conv) {
            conv.systemPrompt = e.target.value;
            saveState();
        }
    };
    
    // Folder creation
    document.getElementById('panel-create-folder-btn').onclick = () => {
        const input = document.getElementById('panel-new-folder-input');
        const name = input?.value.trim();
        if (!name) return;
        folders.push({ id: newId(), name });
        saveFolders();
        populateFolderSelect();
        renderPanelFolderList();
        input.value = '';
    };
    
    // Context file upload
    document.getElementById('panel-add-context-btn').onclick = () => {
        document.getElementById('panel-context-file-input').click();
    };
    document.getElementById('panel-context-file-input').onchange = async (e) => {
        const conv = activeConv();
        if (!conv) return;
        if (!conv.contextFiles) conv.contextFiles = [];
        for (const file of e.target.files) {
            const result = await processFile(file);
            if (result) conv.contextFiles.push(result);
        }
        saveState();
        renderPanelContextFiles();
        e.target.value = '';
    };
    
    // API key toggle
    document.getElementById('panel-toggle-api-key').onclick = () => {
        const inp = document.getElementById('panel-api-key-input');
        const btn = document.getElementById('panel-toggle-api-key');
        if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
        else { inp.type = 'password'; btn.textContent = '👁'; }
    };
    
    // API settings save
    document.getElementById('panel-api-key-input').onchange = (e) => setApiKey(e.target.value.trim());
    document.getElementById('panel-api-base-input').onchange = (e) => setApiBase(e.target.value.trim());
    
    // Export buttons
    panel.querySelectorAll('.export-btn-large[data-format]').forEach(btn => {
        btn.onclick = () => {
            const conv = activeConv();
            if (conv && conv.messages.length) {
                exportConversation(conv, btn.dataset.format);
            } else {
                alert('No messages to export');
            }
        };
    });
}

// Folder list rendering for settings panel
let panelSelectedFolderId = null;
let panelShowingUnassigned = false;

function renderPanelFolderList() {
    const listEl = document.getElementById('panel-folder-list');
    if (!listEl) return;
    
    const unassignedCount = conversations.filter(c => !c.folderId).length;
    
    let html = `
        <div class="folder-item folder-item-unassigned ${panelShowingUnassigned ? 'active' : ''}" data-folder-id="__unassigned__">
            <div class="folder-item-name">
                <span>📄</span>
                <span>Unassigned Chats</span>
                <span class="folder-chat-count">${unassignedCount}</span>
            </div>
        </div>
    `;
    
    html += folders.map(f => {
        const chatCount = conversations.filter(c => c.folderId === f.id).length;
        return `
            <div class="folder-item ${panelSelectedFolderId === f.id ? 'active' : ''}" data-folder-id="${f.id}">
                <div class="folder-item-name">
                    <span>📂</span>
                    <span>${f.name}</span>
                    <span class="folder-chat-count">${chatCount}</span>
                </div>
                <div class="folder-item-actions">
                    <button class="rename-btn" title="Rename">✏️</button>
                    <button class="delete-btn" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    if (!folders.length) {
        html += '<p class="muted small" style="padding:12px">No folders yet. Create one above.</p>';
    }
    
    listEl.innerHTML = html;
    
    // Attach handlers
    listEl.querySelectorAll('.folder-item').forEach(item => {
        const folderId = item.dataset.folderId;
        
        item.querySelector('.folder-item-name').onclick = () => {
            if (folderId === '__unassigned__') {
                panelShowingUnassigned = true;
                panelSelectedFolderId = null;
            } else {
                panelShowingUnassigned = false;
                panelSelectedFolderId = folderId;
            }
            renderPanelFolderList();
            renderPanelFolderContents();
        };
        
        if (folderId !== '__unassigned__') {
            item.querySelector('.rename-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                renameFolder(folderId);
                renderPanelFolderList();
            });
            item.querySelector('.delete-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteFolder(folderId);
                renderPanelFolderList();
            });
        }
    });
    
    renderPanelFolderContents();
}

function renderPanelFolderContents() {
    let contentsEl = document.getElementById('panel-folder-contents');
    if (!contentsEl) return;
    
    if (!panelSelectedFolderId && !panelShowingUnassigned) {
        contentsEl.innerHTML = '<div class="folder-contents-empty"><p class="muted">Select a folder to view contents</p></div>';
        return;
    }
    
    if (panelShowingUnassigned) {
        const unassigned = conversations.filter(c => !c.folderId);
        contentsEl.innerHTML = `
            <div class="folder-contents">
                <div class="folder-contents-header">
                    <h4>📄 Unassigned Chats (${unassigned.length})</h4>
                </div>
                <div class="folder-chats-list">
                    ${unassigned.length ? unassigned.map(c => `
                        <div class="folder-chat-item" data-chat-id="${c.id}">
                            <span class="chat-title">${c.title || 'Untitled'}</span>
                            <select class="assign-folder-select" data-chat-id="${c.id}">
                                <option value="">— Move to folder —</option>
                                ${folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
                            </select>
                        </div>
                    `).join('') : '<p class="muted small">No unassigned chats</p>'}
                </div>
            </div>
        `;
        
        contentsEl.querySelectorAll('.assign-folder-select').forEach(select => {
            select.onchange = () => {
                if (select.value) {
                    moveConvToFolder(select.dataset.chatId, select.value);
                    renderPanelFolderList();
                    renderSidebar();
                }
            };
        });
    } else {
        const folder = folders.find(f => f.id === panelSelectedFolderId);
        if (!folder) return;
        
        const chatsInFolder = conversations.filter(c => c.folderId === panelSelectedFolderId);
        const folderContextFiles = folder.contextFiles || [];
        
        contentsEl.innerHTML = `
            <div class="folder-contents">
                <div class="folder-contents-header">
                    <h4>📂 ${folder.name} (${chatsInFolder.length})</h4>
                    <button class="add-chats-btn ghost-btn small" id="panel-add-chats-to-folder">+ Add Chats</button>
                </div>
                
                <!-- Folder Context Files Section -->
                <div class="folder-context-section">
                    <h5>📎 Folder Context Files</h5>
                    <p class="muted small">Files included in all chats in this folder</p>
                    <div class="folder-context-files" id="panel-folder-context-files">
                        ${folderContextFiles.length ? folderContextFiles.map((f, i) => `
                            <div class="context-file-thumb">
                                ${f.isImage ? `<img src="${f.dataUrl}" alt="${f.name}" />` : '<span class="file-icon">📄</span>'}
                                <span class="file-name">${f.name}</span>
                                <button class="remove-btn" data-folder-id="${folder.id}" data-index="${i}">×</button>
                            </div>
                        `).join('') : '<p class="muted small">No context files for this folder</p>'}
                    </div>
                    <input type="file" id="panel-folder-context-input" multiple hidden />
                    <button class="add-context-btn ghost-btn small" id="panel-add-folder-context">+ Add Folder Context Files</button>
                </div>
                
                <div class="folder-chats-list" id="panel-folder-chats-list">
                    <h5>💬 Chats in this folder</h5>
                    ${chatsInFolder.length ? chatsInFolder.map(c => `
                        <div class="folder-chat-item" data-chat-id="${c.id}">
                            <span class="chat-title">${c.title || 'Untitled'}</span>
                            <button class="remove-from-folder-btn ghost-btn small" data-chat-id="${c.id}" title="Remove from folder">✕</button>
                        </div>
                    `).join('') : '<p class="muted small">No chats in this folder</p>'}
                </div>
                <div class="add-chats-picker hidden" id="panel-add-chats-picker">
                    <h5>Select chats to add:</h5>
                    <div class="unassigned-chats-list" id="panel-unassigned-chats-list"></div>
                </div>
            </div>
        `;
        
        // Folder context file handlers
        document.getElementById('panel-add-folder-context')?.addEventListener('click', () => {
            document.getElementById('panel-folder-context-input').click();
        });
        
        document.getElementById('panel-folder-context-input')?.addEventListener('change', async (e) => {
            for (const file of e.target.files) {
                await addFolderContextFile(panelSelectedFolderId, file);
            }
            renderPanelFolderContents();
            e.target.value = '';
        });
        
        // Remove folder context file buttons
        contentsEl.querySelectorAll('.folder-context-files .remove-btn').forEach(btn => {
            btn.onclick = () => {
                removeFolderContextFile(btn.dataset.folderId, parseInt(btn.dataset.index));
                renderPanelFolderContents();
            };
        });
        
        contentsEl.querySelectorAll('.remove-from-folder-btn').forEach(btn => {
            btn.onclick = () => {
                moveConvToFolder(btn.dataset.chatId, null);
                renderPanelFolderList();
                renderSidebar();
            };
        });
        
        document.getElementById('panel-add-chats-to-folder')?.addEventListener('click', () => {
            const picker = document.getElementById('panel-add-chats-picker');
            const listEl = document.getElementById('panel-unassigned-chats-list');
            picker.classList.toggle('hidden');
            
            if (!picker.classList.contains('hidden')) {
                const unassigned = conversations.filter(c => !c.folderId);
                listEl.innerHTML = unassigned.length ? unassigned.map(c => `
                    <div class="folder-chat-item selectable" data-chat-id="${c.id}">
                        <span class="chat-title">${c.title || 'Untitled'}</span>
                        <button class="add-to-folder-btn ghost-btn small" data-chat-id="${c.id}">+ Add</button>
                    </div>
                `).join('') : '<p class="muted small">No unassigned chats available</p>';
                
                listEl.querySelectorAll('.add-to-folder-btn').forEach(btn => {
                    btn.onclick = () => {
                        moveConvToFolder(btn.dataset.chatId, panelSelectedFolderId);
                        renderPanelFolderList();
                        renderSidebar();
                    };
                });
            }
        });
    }
}

function renderPanelContextFiles() {
    const container = document.getElementById('panel-context-files');
    if (!container) return;
    
    const conv = activeConv();
    const files = conv?.contextFiles || [];
    
    if (!files.length) {
        container.innerHTML = '<p class="muted small">No context files added</p>';
        return;
    }
    
    container.innerHTML = files.map((f, i) => `
        <div class="context-file-thumb">
            ${f.type?.startsWith('image/') ? `<img src="${f.dataUrl}" alt="${f.name}" />` : '<span class="file-icon">📄</span>'}
            <span class="file-name">${f.name}</span>
            <button class="remove-btn" data-index="${i}">×</button>
        </div>
    `).join('');
    
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.onclick = () => {
            const conv = activeConv();
            if (conv?.contextFiles) {
                conv.contextFiles.splice(parseInt(btn.dataset.index), 1);
                saveState();
                renderPanelContextFiles();
            }
        };
    });
}

function renderPanelPendingFiles() {
    const container = document.getElementById('panel-pending-files');
    if (!container) return;
    
    if (!pendingFiles.length) {
        container.innerHTML = '<p class="muted small">No pending attachments</p>';
        return;
    }
    
    container.innerHTML = pendingFiles.map((f, i) => `
        <div class="context-file-thumb">
            ${f.type?.startsWith('image/') ? `<img src="${f.dataUrl}" alt="${f.name}" />` : '<span class="file-icon">📄</span>'}
            <span class="file-name">${f.name}</span>
            <button class="remove-btn" data-index="${i}">×</button>
        </div>
    `).join('');
    
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.onclick = () => {
            pendingFiles.splice(parseInt(btn.dataset.index), 1);
            renderAttachments();
            renderPanelPendingFiles();
        };
    });
}

function renderSettingsModelList(filter = '') {
    const list = document.getElementById('settings-model-list');
    const showHidden = document.getElementById('panel-show-hidden-models')?.checked;
    if (!list) return;
    
    filter = (filter || '').toLowerCase();
    const filtered = allModels.filter(id => {
        if (!showHidden && isHidden(id)) return false;
        return id.toLowerCase().includes(filter);
    });
    
    list.innerHTML = filtered.map(id => `
        <div class="model-item ${isHidden(id) ? 'hidden-model' : ''} ${isImageModel(id) ? 'image-model' : ''}">
            <span class="model-name">${isImageModel(id) ? '🖼️ ' : ''}${id}</span>
            <div class="model-actions">
                <button class="model-fav-btn ${isFavorite(id) ? 'active' : ''}" data-model="${id}" title="Favorite">⭐</button>
                <button class="model-hide-btn ${isHidden(id) ? 'active' : ''}" data-model="${id}" title="Hide">${isHidden(id) ? '👁️' : '🚫'}</button>
            </div>
        </div>
    `).join('');
    
    // Stats
    const stats = document.getElementById('model-stats');
    if (stats) {
        const visibleCount = allModels.filter(id => !isHidden(id)).length;
        const favCount = modelPrefs.favorites.length;
        stats.textContent = `${visibleCount} visible · ${favCount} favorites · ${allModels.length} total`;
    }
    
    // Attach handlers
    list.querySelectorAll('.model-fav-btn').forEach(btn => {
        btn.onclick = () => { toggleFavorite(btn.dataset.model); renderSettingsModelList(filter); populateModelSelect(); renderModelList(); };
    });
    list.querySelectorAll('.model-hide-btn').forEach(btn => {
        btn.onclick = () => { toggleHidden(btn.dataset.model); renderSettingsModelList(filter); populateModelSelect(); renderModelList(); };
    });
}

function openModelSettings() {
    createModelSettingsPanel();
    const panel = document.getElementById('model-settings-panel');
    panel.classList.remove('hidden');
    
    // Load current values
    const themeSelect = document.getElementById('panel-theme-select');
    if (themeSelect) themeSelect.value = getTheme();
    
    const usernameInput = document.getElementById('panel-username-input');
    if (usernameInput) usernameInput.value = getUsername() === 'You' ? '' : getUsername();
    
    const systemInput = document.getElementById('panel-system-input');
    const conv = activeConv();
    if (systemInput && conv) systemInput.value = conv.systemPrompt || '';
    
    const apiKeyInput = document.getElementById('panel-api-key-input');
    if (apiKeyInput) apiKeyInput.value = getApiKey();
    
    const apiBaseInput = document.getElementById('panel-api-base-input');
    if (apiBaseInput) apiBaseInput.value = getApiBase();
    
    // Reset to first tab
    panel.querySelectorAll('.settings-nav-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    panel.querySelectorAll('.settings-pane').forEach((p, i) => p.classList.toggle('active', i === 0));
    
    document.getElementById('settings-model-search').value = '';
}

function addModelControlButtons() {
    // Add settings button to sidebar footer
    const modelRow = document.querySelector('.model-row');
    if (!modelRow || document.getElementById('model-settings-btn')) return;
    
    // Create button row
    const btnRow = document.createElement('div');
    btnRow.className = 'model-btn-row';
    btnRow.innerHTML = `
        <button id="model-fav-quick" class="model-quick-btn" title="Toggle favorite for current model">⭐</button>
        <button id="model-settings-btn" class="model-quick-btn" title="Model settings">⚙️</button>
    `;
    modelRow.appendChild(btnRow);
    
    // Quick favorite current model
    document.getElementById('model-fav-quick').onclick = () => {
        const currentModel = els.modelSelect.value;
        if (currentModel && !currentModel.startsWith('(')) {
            toggleFavorite(currentModel);
            updateQuickFavBtn();
        }
    };
    
    // Open settings
    document.getElementById('model-settings-btn').onclick = openModelSettings;
    
    // Update button state on model change
    els.modelSelect.addEventListener('change', updateQuickFavBtn);
}

function updateQuickFavBtn() {
    const btn = document.getElementById('model-fav-quick');
    if (!btn) return;
    const currentModel = els.modelSelect.value;
    btn.classList.toggle('active', isFavorite(currentModel));
}

/* ====== Username ====== */
function getUsername() {
    return localStorage.getItem(LS_USERNAME) || 'You';
}
function setUsername(name) {
    localStorage.setItem(LS_USERNAME, name || 'You');
}

els.usernameInput.addEventListener('input', () => {
    setUsername(els.usernameInput.value.trim());
    renderMessages(); // Re-render to update labels
});

/* ====== Quote Message ====== */
function quoteMessage(content) {
    if (!content) return;
    // Truncate if too long
    const maxQuote = 500;
    let quote = content.length > maxQuote ? content.slice(0, maxQuote) + '...' : content;
    // Format as blockquote
    const quotedText = quote.split('\n').map(line => '> ' + line).join('\n');
    // Prepend to input
    const current = els.input.value;
    els.input.value = quotedText + '\n\n' + current;
    els.input.focus();
    autoResize();
    els.charCounter.textContent = els.input.value.length + ' chars';
}

/* ====== Theme ====== */
function getTheme() {
    return localStorage.getItem(LS_THEME) || 'light';
}
function setTheme(theme) {
    localStorage.setItem(LS_THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
}
function initTheme() {
    const theme = getTheme();
    document.documentElement.setAttribute('data-theme', theme);
    els.themeSelect.value = theme;
}

els.themeSelect.addEventListener('change', () => {
    setTheme(els.themeSelect.value);
});

/* ====== Split View ====== */
const LS_SPLIT = 'groovy-proxy::split-state';
let splitMode = false;
let splitPanes = [
    { id: 'pane1', conversationId: null },
    { id: 'pane2', conversationId: null }
];
let splitRatio = 50; // percentage for left pane

function loadSplitState() {
    try {
        const saved = JSON.parse(localStorage.getItem(LS_SPLIT) || '{}');
        if (saved.ratio) splitRatio = saved.ratio;
        if (saved.panes) splitPanes = saved.panes;
    } catch {}
}

function saveSplitState() {
    localStorage.setItem(LS_SPLIT, JSON.stringify({
        ratio: splitRatio,
        panes: splitPanes
    }));
}

function createSplitContainer() {
    // Remove existing if any
    const existing = document.getElementById('split-container');
    if (existing) existing.remove();
    
    const container = document.createElement('div');
    container.id = 'split-container';
    container.className = 'split-container';
    container.style.gridTemplateColumns = `${splitRatio}% 8px ${100 - splitRatio}%`;
    
    // Pane 1
    container.appendChild(createPane(0));
    
    // Resize handle
    const handle = document.createElement('div');
    handle.className = 'split-resize-handle';
    handle.addEventListener('mousedown', startResize);
    container.appendChild(handle);
    
    // Pane 2
    container.appendChild(createPane(1));
    
    return container;
}

function createPane(paneIndex) {
    const paneData = splitPanes[paneIndex];
    const pane = document.createElement('div');
    pane.className = 'chat-pane';
    pane.dataset.paneIndex = paneIndex;
    
    // Topbar
    const topbar = document.createElement('div');
    topbar.className = 'pane-topbar';
    
    // Conversation selector
    const select = document.createElement('select');
    select.className = 'pane-conv-select';
    populatePaneConvSelect(select, paneData.conversationId);
    select.onchange = () => {
        splitPanes[paneIndex].conversationId = select.value || null;
        saveSplitState();
        renderPaneMessages(pane, paneIndex);
    };
    topbar.appendChild(select);
    
    // Title
    const title = document.createElement('div');
    title.className = 'pane-title';
    const conv = conversations.find(c => c.id === paneData.conversationId);
    title.textContent = conv?.title || 'Select a chat';
    topbar.appendChild(title);
    
    // Close/unsplit button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'pane-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close split view';
    closeBtn.onclick = () => exitSplitMode();
    topbar.appendChild(closeBtn);
    
    pane.appendChild(topbar);
    
    // Messages area
    const messages = document.createElement('div');
    messages.className = 'pane-messages';
    pane.appendChild(messages);
    
    // Composer
    const composer = document.createElement('div');
    composer.className = 'pane-composer';
    const composerRow = document.createElement('div');
    composerRow.className = 'pane-composer-row';
    
    const input = document.createElement('textarea');
    input.className = 'pane-input';
    input.placeholder = 'Message...';
    input.rows = 1;
    input.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendPaneMessage(paneIndex);
        }
    };
    input.oninput = () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    };
    composerRow.appendChild(input);
    
    const sendBtn = document.createElement('button');
    sendBtn.className = 'pane-send-btn';
    sendBtn.textContent = '↑';
    sendBtn.onclick = () => sendPaneMessage(paneIndex);
    composerRow.appendChild(sendBtn);
    
    composer.appendChild(composerRow);
    pane.appendChild(composer);
    
    // Render messages
    renderPaneMessages(pane, paneIndex);
    
    return pane;
}

function populatePaneConvSelect(select, currentId) {
    select.innerHTML = '<option value="">— Select chat —</option>';
    conversations.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.title || 'Untitled';
        if (c.id === currentId) opt.selected = true;
        select.appendChild(opt);
    });
}

function renderPaneMessages(pane, paneIndex) {
    const messagesEl = pane.querySelector('.pane-messages');
    const titleEl = pane.querySelector('.pane-title');
    const convId = splitPanes[paneIndex].conversationId;
    const conv = conversations.find(c => c.id === convId);
    
    if (!conv) {
        messagesEl.innerHTML = '<div class="empty-state"><p>Select a conversation</p></div>';
        titleEl.textContent = 'Select a chat';
        return;
    }
    
    titleEl.textContent = conv.title || 'Untitled';
    messagesEl.innerHTML = '';
    
    if (!conv.messages.length) {
        messagesEl.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>';
        return;
    }
    
    conv.messages.forEach((msg, idx) => {
        messagesEl.appendChild(buildMsgEl(msg, idx));
    });
    
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    // Highlight code blocks in the pane
    highlightCode();
}

async function sendPaneMessage(paneIndex) {
    const pane = document.querySelector(`.chat-pane[data-pane-index="${paneIndex}"]`);
    if (!pane) return;
    
    const input = pane.querySelector('.pane-input');
    const text = (input.value || '').trim();
    if (!text) return;
    
    const convId = splitPanes[paneIndex].conversationId;
    if (!convId) {
        alert('Please select a conversation first');
        return;
    }
    
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    
    input.value = '';
    input.style.height = 'auto';
    
    // Add user message
    conv.messages.push({ role: 'user', content: text, timestamp: Date.now() });
    const assistantMsg = { role: 'assistant', content: '', timestamp: Date.now() };
    conv.messages.push(assistantMsg);
    saveState();
    renderPaneMessages(pane, paneIndex);
    renderSidebar();
    
    const messagesEl = pane.querySelector('.pane-messages');
    const lastEl = messagesEl.lastElementChild;
    const contentEl = lastEl?.querySelector('.content');
    if (contentEl) contentEl.innerHTML = '<span class="cursor"></span>';
    
    // Build API messages
    const apiMsgs = [];
    if (conv.systemPrompt) apiMsgs.push({ role: 'system', content: conv.systemPrompt });
    
    // Add folder context files first (if conversation is in a folder)
    const folderContext = getFolderContextFiles(conv.folderId);
    if (folderContext.length) {
        const folderImages = folderContext.filter(f => f.isImage).map(f => f.dataUrl);
        const folderText = folderContext.filter(f => !f.isImage);
        const folderContent = buildMessageContent('[Folder context files attached]', folderImages, folderText);
        apiMsgs.push({role:'user', content: folderContent});
        apiMsgs.push({role:'assistant', content: 'I\'ve received the folder context files. I\'ll use them to help with our conversation.'});
    }
    
    // Add conversation context files (if any)
    if (conv.contextFiles?.length) {
        const contextImages = conv.contextFiles.filter(f => f.isImage).map(f => f.dataUrl);
        const contextText = conv.contextFiles.filter(f => !f.isImage);
        const contextContent = buildMessageContent('[Context files attached]', contextImages, contextText);
        apiMsgs.push({role:'user', content: contextContent});
        apiMsgs.push({role:'assistant', content: 'I\'ve received the context files. I\'ll use them to help with our conversation.'});
    }
    
    conv.messages.slice(0, -1).forEach(m => apiMsgs.push({ role: m.role, content: m.content }));
    
    const model = conv.model || els.modelSelect.value;
    let acc = '';
    const apiKey = getApiKey();
    
    try {
        const resp = await fetch('/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
            },
            body: JSON.stringify({ model, stream: true, messages: apiMsgs })
        });
        
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            
            let nl;
            while ((nl = buf.indexOf('\n')) !== -1) {
                const line = buf.slice(0, nl).trim();
                buf = buf.slice(nl + 1);
                if (!line || !line.startsWith('data:')) continue;
                const payload = line.slice(5).trim();
                if (payload === '[DONE]') break;
                try {
                    const obj = JSON.parse(payload);
                    const delta = obj.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        acc += delta;
                        assistantMsg.content = acc;
                        if (contentEl) {
                            contentEl.innerHTML = renderContent(acc) + '<span class="cursor"></span>';
                            messagesEl.scrollTop = messagesEl.scrollHeight;
                        }
                    }
                } catch {}
            }
        }
        
        if (!acc) acc = '_(empty response)_';
        assistantMsg.content = acc;
        if (contentEl) contentEl.innerHTML = renderContent(acc);
        highlightCode();
        saveState();
        
    } catch (err) {
        assistantMsg.content = '**Error:** ' + err.message;
        if (contentEl) contentEl.innerHTML = renderContent(assistantMsg.content);
        saveState();
    }
}

// Resize handle drag
let resizing = false;
let startX = 0;
let startRatio = 50;

function startResize(e) {
    resizing = true;
    startX = e.clientX;
    startRatio = splitRatio;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.target.classList.add('dragging');
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

function doResize(e) {
    if (!resizing) return;
    const container = document.getElementById('split-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const deltaX = e.clientX - startX;
    const deltaPercent = (deltaX / rect.width) * 100;
    let newRatio = startRatio + deltaPercent;
    
    // Clamp between 25% and 75%
    newRatio = Math.max(25, Math.min(75, newRatio));
    splitRatio = newRatio;
    
    container.style.gridTemplateColumns = `${splitRatio}% 8px ${100 - splitRatio}%`;
}

function stopResize() {
    resizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    const handle = document.querySelector('.split-resize-handle');
    if (handle) handle.classList.remove('dragging');
    
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
    
    saveSplitState();
}

function enterSplitMode() {
    splitMode = true;
    
    // Initialize panes with current and a new conversation
    splitPanes[0].conversationId = activeId;
    splitPanes[1].conversationId = conversations.length > 1 
        ? conversations.find(c => c.id !== activeId)?.id || null 
        : activeId;
    
    // Hide main, show split container
    els.main = document.getElementById('main');
    els.main.classList.add('hidden');
    
    const container = createSplitContainer();
    document.getElementById('app').appendChild(container);
    
    // Update button
    const splitBtn = document.getElementById('split-btn');
    if (splitBtn) {
        splitBtn.textContent = '⊟';
        splitBtn.title = 'Exit split view';
    }
    
    saveSplitState();
}

function exitSplitMode() {
    splitMode = false;
    
    // Remove split container
    const container = document.getElementById('split-container');
    if (container) container.remove();
    
    // Show main
    const main = document.getElementById('main');
    main.classList.remove('hidden');
    
    // Update button
    const splitBtn = document.getElementById('split-btn');
    if (splitBtn) {
        splitBtn.textContent = '⊞';
        splitBtn.title = 'Split view';
    }
    
    // Restore active conversation
    if (splitPanes[0].conversationId) {
        activeId = splitPanes[0].conversationId;
        saveState();
    }
    
    renderMessages();
    renderSidebar();
}

function refreshSplitPanes() {
    if (!splitMode) return;
    
    const container = document.getElementById('split-container');
    if (!container) return;
    
    // Update conversation selectors
    container.querySelectorAll('.pane-conv-select').forEach((select, idx) => {
        populatePaneConvSelect(select, splitPanes[idx].conversationId);
    });
    
    // Re-render messages
    container.querySelectorAll('.chat-pane').forEach((pane, idx) => {
        renderPaneMessages(pane, idx);
    });
}

// Split button handler
document.getElementById('split-btn')?.addEventListener('click', () => {
    if (splitMode) exitSplitMode();
    else enterSplitMode();
});

// Override sidebar click to update split panes too
const originalRenderSidebar = renderSidebar;
renderSidebar = function() {
    originalRenderSidebar();
    refreshSplitPanes();
};

/* ====== Init ====== */
(async function init(){
    loadState(); 
    loadModelPrefs();
    loadSplitState();
    initTheme();
    initSettingsModal();
    initModelPicker();
    initFolders();
    await initImageDB().catch(e => console.warn('IndexedDB init failed:', e));
    // Load username into input
    if (els.usernameInput) els.usernameInput.value = getUsername() === 'You' ? '' : getUsername();
    renderSidebar(); renderMessages(); syncSystemPanel();
    await loadModels();
    addModelControlButtons();
    updateQuickFavBtn();
    updateModelPickerLabel();
    // Auto-detect image mode on init
    updateModeForModel(els.modelSelect.value);
    // Initialize char counter to 0 (not including placeholder)
    els.charCounter.textContent = '0 chars';
    els.tokenEstimate.textContent = '~0 tokens';
    focusInput();
})();
