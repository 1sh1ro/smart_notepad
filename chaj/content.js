let floatingNotepad = null;
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'toggleFloat') {
        if (request.floating) {
            createFloatingNotepad();
        } else {
            removeFloatingNotepad();
        }
    }
});

function createFloatingNotepad() {
    if (floatingNotepad) {
        return;
    }

    floatingNotepad = document.createElement('div');
    floatingNotepad.className = 'floating-notepad';
    floatingNotepad.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        background: white;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        z-index: 10000;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-height: 600px;
    `;

    // 加载便签内容
    chrome.storage.local.get(['notes'], function(result) {
        const notes = result.notes || [];
        
        const content = `
            <div class="floating-header" style="
                padding: 10px;
                background: #2196F3;
                color: white;
                cursor: move;
                user-select: none;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span>便签记事本</span>
                <button id="floatingClose" style="
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 5px;
                ">✕</button>
            </div>
            <div class="floating-input" style="
                padding: 10px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                gap: 8px;
            ">
                <input type="text" id="floatingNoteInput" placeholder="输入新的便签..." style="
                    flex: 1;
                    padding: 8px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    font-size: 14px;
                ">
                <button id="floatingAddNote" style="
                    background: #2196F3;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">添加</button>
            </div>
            <div class="floating-notes" style="
                flex: 1;
                overflow-y: auto;
                padding: 10px;
            ">
                <div id="floatingNotesList" style="
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                "></div>
            </div>
        `;
        
        floatingNotepad.innerHTML = content;
        document.body.appendChild(floatingNotepad);

        // 渲染便签列表
        renderFloatingNotes();

        // 设置事件监听
        setupFloatingEvents();
    });
}

function setupFloatingEvents() {
    const header = floatingNotepad.querySelector('.floating-header');
    const input = floatingNotepad.querySelector('#floatingNoteInput');
    const addButton = floatingNotepad.querySelector('#floatingAddNote');
    const closeButton = floatingNotepad.querySelector('#floatingClose');

    // 拖拽功能
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    // 添加便签
    addButton.addEventListener('click', addFloatingNote);
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addFloatingNote();
        }
    });

    // 关闭按钮
    closeButton.addEventListener('click', removeFloatingNotepad);
}

function addFloatingNote() {
    const input = floatingNotepad.querySelector('#floatingNoteInput');
    const content = input.value.trim();
    
    if (content) {
        const note = {
            id: Date.now(),
            content: content,
            time: new Date().toLocaleString('zh-CN')
        };

        chrome.storage.local.get(['notes'], function(result) {
            const notes = result.notes || [];
            notes.unshift(note);
            chrome.storage.local.set({ 'notes': notes }, function() {
                input.value = '';
                renderFloatingNotes();
            });
        });
    }
}

function renderFloatingNotes() {
    const notesList = floatingNotepad.querySelector('#floatingNotesList');
    
    chrome.storage.local.get(['notes'], function(result) {
        const notes = result.notes || [];
        notesList.innerHTML = '';
        
        notes.forEach(note => {
            const noteElement = document.createElement('div');
            noteElement.style.cssText = `
                background: white;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                gap: 5px;
            `;
            
            noteElement.innerHTML = `
                <div style="word-break: break-word;">${note.content}</div>
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 5px;
                ">
                    <span style="
                        font-size: 12px;
                        color: #888;
                    ">${note.time}</span>
                    <div style="display: flex; gap: 5px;">
                        <button class="edit-btn" style="
                            color: #666;
                            padding: 3px 6px;
                            font-size: 12px;
                            background: #f5f5f5;
                            border: none;
                            border-radius: 3px;
                            cursor: pointer;
                        ">编辑</button>
                        <button class="delete-btn" style="
                            color: #666;
                            padding: 3px 6px;
                            font-size: 12px;
                            background: #f5f5f5;
                            border: none;
                            border-radius: 3px;
                            cursor: pointer;
                        ">删除</button>
                    </div>
                </div>
            `;

            const editBtn = noteElement.querySelector('.edit-btn');
            const deleteBtn = noteElement.querySelector('.delete-btn');

            editBtn.addEventListener('click', () => editFloatingNote(note.id, noteElement));
            deleteBtn.addEventListener('click', () => deleteFloatingNote(note.id));

            notesList.appendChild(noteElement);
        });
    });
}

function editFloatingNote(id, noteElement) {
    const contentDiv = noteElement.querySelector('div');
    const originalContent = contentDiv.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalContent;
    input.style.cssText = `
        width: 100%;
        padding: 4px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    `;
    
    contentDiv.textContent = '';
    contentDiv.appendChild(input);
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
                        renderFloatingNotes();
                    });
                }
            });
        } else {
            contentDiv.textContent = originalContent;
        }
    }

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveEdit();
        }
    });
}

function deleteFloatingNote(id) {
    chrome.storage.local.get(['notes'], function(result) {
        const notes = result.notes || [];
        const updatedNotes = notes.filter(note => note.id !== id);
        chrome.storage.local.set({ 'notes': updatedNotes }, function() {
            renderFloatingNotes();
        });
    });
}

function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target.closest('.floating-header')) {
        isDragging = true;
    }
}

function drag(e) {
    if (isDragging) {
        e.preventDefault();
        
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, floatingNotepad);
    }
}

function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
}

function removeFloatingNotepad() {
    if (floatingNotepad && floatingNotepad.parentNode) {
        floatingNotepad.parentNode.removeChild(floatingNotepad);
        floatingNotepad = null;
    }
}
