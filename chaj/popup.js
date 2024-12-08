document.addEventListener('DOMContentLoaded', function() {
    const noteInput = document.getElementById('noteInput');
    const addNoteBtn = document.getElementById('addNote');
    const notesList = document.getElementById('notesList');
    const toggleFloatBtn = document.getElementById('toggleFloat');
    const toggleVoiceBtn = document.getElementById('toggleVoice');
    const statusElement = document.getElementById('status');
    const searchInput = document.getElementById('searchInput');
    const categorySelect = document.getElementById('categorySelect');
    const noteCategory = document.getElementById('noteCategory');
    const noteCountElement = document.getElementById('noteCount');
    
    let isRecording = false;
    let recognition = null;
    let searchTimeout;

    // 加载保存的便签
    loadNotes();

    // 搜索功能
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            renderNotes();
        }, 300);
    });

    // 分类筛选
    categorySelect.addEventListener('change', renderNotes);

    // 添加便签事件
    addNoteBtn.addEventListener('click', addNewNote);
    noteInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addNewNote();
        }
    });

    // 添加新便签
    function addNewNote() {
        const content = noteInput.value.trim();
        if (content) {
            const note = {
                id: Date.now(),
                content: content,
                category: noteCategory.value,
                time: new Date().toLocaleString('zh-CN'),
                pinned: false
            };
            
            saveNote(note);
            noteInput.value = '';
            updateStatus('已添加');
        }
    }

    // 保存便签
    function saveNote(note) {
        chrome.storage.local.get(['notes'], function(result) {
            const notes = result.notes || [];
            notes.unshift(note);
            chrome.storage.local.set({ 'notes': notes }, function() {
                renderNotes();
            });
        });
    }

    // 更新状态
    function updateStatus(message) {
        statusElement.textContent = message;
        setTimeout(() => {
            statusElement.textContent = '就绪';
        }, 1000);
    }

    // 加载便签
    function loadNotes() {
        chrome.storage.local.get(['notes'], function(result) {
            if (result.notes) {
                renderNotes();
            }
        });
    }

    // 删除便签
    function deleteNote(id) {
        chrome.storage.local.get(['notes'], function(result) {
            const notes = result.notes || [];
            const updatedNotes = notes.filter(note => note.id !== id);
            chrome.storage.local.set({ 'notes': updatedNotes }, function() {
                renderNotes();
                updateStatus('已删除');
            });
        });
    }

    // 编辑便签
    function editNote(id) {
        const noteElement = document.querySelector(`[data-id="${id}"]`);
        const contentElement = noteElement.querySelector('.note-content');
        const originalContent = contentElement.textContent;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalContent;
        input.style.width = '100%';
        input.style.padding = '4px';
        input.style.border = '1px solid #ddd';
        input.style.borderRadius = '4px';
        
        contentElement.textContent = '';
        contentElement.appendChild(input);
        input.focus();

        function saveEdit() {
            const newContent = input.value.trim();
            if (newContent && newContent !== originalContent) {
                chrome.storage.local.get(['notes'], function(result) {
                    const notes = result.notes || [];
                    const noteIndex = notes.findIndex(note => note.id === id);
                    if (noteIndex !== -1) {
                        notes[noteIndex].content = newContent;
                        notes[noteIndex].time = new Date().toLocaleString('zh-CN') + ' (已编辑)';
                        chrome.storage.local.set({ 'notes': notes }, function() {
                            renderNotes();
                            updateStatus('已更新');
                        });
                    }
                });
            } else {
                contentElement.textContent = originalContent;
            }
        }

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                saveEdit();
            }
        });
    }

    // 过滤便签
    function filterNotes(notes) {
        const searchText = searchInput.value.toLowerCase();
        const category = categorySelect.value;
        const now = new Date();
        
        return notes.filter(note => {
            // 搜索文本过滤
            const matchesSearch = note.content.toLowerCase().includes(searchText);
            
            // 时间过滤
            const noteDate = new Date(note.time.split(' ')[0]);
            const daysDiff = Math.floor((now - noteDate) / (1000 * 60 * 60 * 24));
            
            let matchesCategory = true;
            switch(category) {
                case 'today':
                    matchesCategory = daysDiff === 0;
                    break;
                case 'week':
                    matchesCategory = daysDiff <= 7;
                    break;
                case 'month':
                    matchesCategory = daysDiff <= 30;
                    break;
                default:
                    matchesCategory = true;
            }
            
            return matchesSearch && matchesCategory;
        });
    }

    // 渲染便签列表
    function renderNotes() {
        chrome.storage.local.get(['notes'], function(result) {
            const allNotes = result.notes || [];
            const filteredNotes = filterNotes(allNotes);
            
            // 根据置顶状态排序
            filteredNotes.sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return 0;
            });
            
            notesList.innerHTML = '';
            
            filteredNotes.forEach(note => {
                const noteElement = document.createElement('div');
                noteElement.className = 'note-item';
                noteElement.setAttribute('data-id', note.id);
                noteElement.setAttribute('data-pinned', note.pinned);
                
                const categoryDot = `<div class="note-category category-${note.category || 'default'}"></div>`;
                const pinnedIcon = note.pinned ? '📌 ' : '';
                
                noteElement.innerHTML = `
                    ${categoryDot}
                    <div class="note-content">${pinnedIcon}${note.content}</div>
                    <div class="note-actions">
                        <button class="pin-btn" title="${note.pinned ? '取消置顶' : '置顶'}">${note.pinned ? '📌' : '📍'}</button>
                        <button class="edit-btn">编辑</button>
                        <button class="delete-btn">删除</button>
                    </div>
                    <div class="note-time">${note.time}</div>
                `;

                const pinBtn = noteElement.querySelector('.pin-btn');
                const editBtn = noteElement.querySelector('.edit-btn');
                const deleteBtn = noteElement.querySelector('.delete-btn');

                pinBtn.addEventListener('click', () => togglePin(note.id));
                editBtn.addEventListener('click', () => editNote(note.id));
                deleteBtn.addEventListener('click', () => deleteNote(note.id));

                notesList.appendChild(noteElement);
            });

            noteCountElement.textContent = `共 ${filteredNotes.length} 条便签`;
        });
    }

    // 切换便签置顶状态
    function togglePin(id) {
        chrome.storage.local.get(['notes'], function(result) {
            const notes = result.notes || [];
            const noteIndex = notes.findIndex(note => note.id === id);
            
            if (noteIndex !== -1) {
                notes[noteIndex].pinned = !notes[noteIndex].pinned;
                chrome.storage.local.set({ 'notes': notes }, function() {
                    renderNotes();
                    updateStatus(notes[noteIndex].pinned ? '已置顶' : '已取消置顶');
                });
            }
        });
    }

    // 悬浮窗口功能
    toggleFloatBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleFloat',
                floating: true
            });
        });
        window.close();
    });

    // 语音识别功能
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';

        recognition.onstart = function() {
            updateStatus('正在录音...');
            toggleVoiceBtn.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
        };

        recognition.onend = function() {
            updateStatus('录音已停止');
            toggleVoiceBtn.style.backgroundColor = '';
            isRecording = false;
        };

        recognition.onresult = function(event) {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                noteInput.value = finalTranscript;
                addNewNote();
            }
            
            if (interimTranscript) {
                updateStatus('正在识别: ' + interimTranscript);
            }
        };

        recognition.onerror = function(event) {
            updateStatus('错误: ' + event.error);
            toggleVoiceBtn.style.backgroundColor = '';
            isRecording = false;
        };

        toggleVoiceBtn.addEventListener('click', function() {
            if (!recognition) {
                updateStatus('您的浏览器不支持语音识别');
                return;
            }

            if (!isRecording) {
                recognition.start();
                isRecording = true;
            } else {
                recognition.stop();
                isRecording = false;
                updateStatus('就绪');
            }
        });
    } else {
        toggleVoiceBtn.style.display = 'none';
        updateStatus('您的浏览器不支持语音识别');
    }
});
