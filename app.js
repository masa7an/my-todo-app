document.addEventListener('DOMContentLoaded', () => {
    const todoInput = document.getElementById('todo-input');
    const categorySelect = document.getElementById('category-select');
    const addBtn = document.getElementById('add-btn');
    const todoList = document.getElementById('todo-list');
    const emptyState = document.getElementById('empty-state');
    const dateDisplay = document.getElementById('date-display');
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = themeToggle.querySelector('.sun-icon');
    const moonIcon = themeToggle.querySelector('.moon-icon');


    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateDisplay.textContent = new Date().toLocaleDateString('ja-JP', options);

    // Undo State
    let deletedTask = null;
    let deletedTaskIndex = -1;
    let undoTimeout = null;
    const undoNotification = document.getElementById('undo-notification');
    const undoBtn = document.getElementById('undo-btn');
    const historyPanel = document.getElementById('history-panel');
    const historyToggleBtn = document.getElementById('history-toggle-btn');
    const closeHistoryBtn = document.getElementById('close-history-btn');
    const historyList = document.getElementById('history-list');

    undoBtn.addEventListener('click', undoDelete);
    historyToggleBtn.addEventListener('click', () => historyPanel.classList.add('open'));
    closeHistoryBtn.addEventListener('click', () => historyPanel.classList.remove('open'));

    // Close history panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!historyPanel.contains(e.target) && !historyToggleBtn.contains(e.target) && historyPanel.classList.contains('open')) {
            historyPanel.classList.remove('open');
        }
    });

    // Theme Management
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');

        if (isLight) {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
            localStorage.setItem('theme', 'light');
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
            localStorage.setItem('theme', 'dark');
        }
    });

    // Load tasks from local storage
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let deletedTasks = JSON.parse(localStorage.getItem('deletedTasks')) || [];

    function saveDeletedTasks() {
        localStorage.setItem('deletedTasks', JSON.stringify(deletedTasks));
        renderHistoryList();
    }

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        updateEmptyState();
    }

    function updateEmptyState() {
        if (tasks.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }
    }

    function renderTask(task) {
        const li = document.createElement('li');
        li.className = `todo-item ${task.completed ? 'completed' : ''}`;
        li.dataset.id = task.id;
        li.draggable = true;

        li.addEventListener('dragstart', () => {
            li.classList.add('dragging');
        });

        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            updateTasksOrder();
        });

        li.innerHTML = `
            <div class="checkbox-wrapper" draggable="false">
                <input type="checkbox" ${task.completed ? 'checked' : ''} draggable="false">
                <div class="custom-checkbox" draggable="false">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            </div>
            ${task.category && task.category !== 'none' ? `<span class="category-badge category-${task.category}">${getCategoryName(task.category)}</span>` : ''}
            <span class="task-text">${escapeHtml(task.text)}</span>
            <button class="edit-btn" aria-label="Edit task">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 4H4C3.44772 4 3 4.44772 3 5V20C3 20.5523 3.44772 21 4 21H19C19.5523 21 20 20.5523 20 20V13M18.5 2.5C19.3284 3.32843 19.3284 4.67157 18.5 5.5L12 12L8 13L9 9L15.5 2.5C16.3284 1.67157 17.6716 1.67157 18.5 2.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <button class="delete-btn" aria-label="Delete task">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        `;

        // Event Listeners
        // Event Listeners
        const checkboxWrapper = li.querySelector('.checkbox-wrapper');
        checkboxWrapper.addEventListener('dragstart', (e) => e.preventDefault());
        checkboxWrapper.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        const checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => toggleTask(task.id));

        const editBtn = li.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => startEditing(task.id, li));

        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteTask(task.id, li));

        return li;
    }

    function startEditing(id, li) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        const span = li.querySelector('.task-text');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = task.text;

        // Hide span, show input
        span.style.display = 'none';
        li.insertBefore(input, span);
        input.focus();

        // Disable drag while editing to prevent conflicts
        li.draggable = false;

        function saveEdit() {
            const newText = input.value.trim();
            if (newText) {
                task.text = newText;
                span.textContent = newText; // Update text logic handled next render mostly, but update for now
                saveTasks();
            }
            // Cleanup UI
            input.remove();
            span.style.display = '';
            li.draggable = true;
        }

        function cancelEdit() {
            input.remove();
            span.style.display = '';
            li.draggable = true;
        }

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveEdit();
            } else if (e.key === 'Escape') {
                cancelEdit();
            }
        });
    }

    function addTask() {
        const text = todoInput.value.trim();
        const category = categorySelect.value;
        if (text === '') return;

        const newTask = {
            id: Date.now(),
            text: text,
            completed: false,
            category: category
        };

        tasks.push(newTask);
        saveTasks();

        const taskElement = renderTask(newTask);
        todoList.prepend(taskElement);

        todoInput.value = '';
        todoInput.focus();
    }

    function toggleTask(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveTasks();

            // Re-render list to sort or just update class? 
            // For simplicity, just update class
            const li = document.querySelector(`li[data-id="${id}"]`);
            if (li) {
                li.classList.toggle('completed');
            }
        }
    }

    function getCategoryName(category) {
        const categories = {
            'none': 'タグ色変更',
            'work': '仕事',
            'personal': '私用',
            'shopping': '買い物',
            'important': '重要',
            'other': 'その他'
        };
        return categories[category] || '';
    }

    function deleteTask(id, element) {
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex === -1) return;

        // Backup for undo
        deletedTask = tasks[taskIndex];
        deletedTaskIndex = taskIndex;

        element.style.animation = 'slideOut 0.3s ease forwards';
        element.addEventListener('animationend', () => {
            element.remove();
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();

            // Add to history
            addToHistory(deletedTask);

            showUndoNotification();
        });
    }

    function addToHistory(task) {
        // Add to beginning of history
        deletedTasks.unshift({ ...task, deletedAt: Date.now() });

        // Limit to 100 items
        if (deletedTasks.length > 100) {
            deletedTasks.pop();
        }

        saveDeletedTasks();
    }

    function renderHistoryList() {
        historyList.innerHTML = '';

        deletedTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'history-item';

            li.innerHTML = `
                <span>${escapeHtml(task.text)}</span>
                <button class="restore-btn" aria-label="復元">復元</button>
            `;

            const restoreBtn = li.querySelector('.restore-btn');
            restoreBtn.addEventListener('click', () => restoreHistoryTask(task.id));

            historyList.appendChild(li);
        });
    }

    function restoreHistoryTask(id) {
        const taskIndex = deletedTasks.findIndex(t => t.id === id);
        if (taskIndex === -1) return;

        const taskToRestore = deletedTasks[taskIndex];

        // Restore to main list
        tasks.push({
            id: taskToRestore.id,
            text: taskToRestore.text,
            completed: taskToRestore.completed,
            category: taskToRestore.category
        });
        saveTasks();

        // Render in main list (puts it at top because of prepend logic)
        todoList.prepend(renderTask(tasks[tasks.length - 1]));

        // Remove from history
        deletedTasks.splice(taskIndex, 1);
        saveDeletedTasks();

        // If the task restored is the same as the one in undo buffer, clear undo
        if (deletedTask && deletedTask.id === id) {
            undoNotification.classList.add('hidden');
            deletedTask = null;
        }
    }

    function showUndoNotification() {
        // Clear existing timeout
        if (undoTimeout) {
            clearTimeout(undoTimeout);
        }

        undoNotification.classList.remove('hidden');

        // Set timeout to hide
        undoTimeout = setTimeout(() => {
            undoNotification.classList.add('hidden');
            deletedTask = null; // Clear backup after timeout
        }, 3000);
    }

    function undoDelete() {
        if (!deletedTask) return;

        // Stop the timeout so notification doesn't vanish while we are restoring logic (though it's fast)
        if (undoTimeout) {
            clearTimeout(undoTimeout);
        }

        // Restore task to array
        // We want to restore it to the same index if possible, but since we are displaying in reverse order (prepend),
        // and 'tasks' array is in appended order, exact index restoration is nice but
        // simply pushing it back (to become latest) or splicing it back is fine.
        // Let's splice it back to original position in the backing array.
        if (deletedTaskIndex >= 0 && deletedTaskIndex <= tasks.length) {
            tasks.splice(deletedTaskIndex, 0, deletedTask);
        } else {
            tasks.push(deletedTask);
        }

        saveTasks();

        // Restore to DOM
        const taskElement = renderTask(deletedTask);

        // Since we are prepending for display (reverse order of array), 
        // to restore visually in correct place is hard without full re-render or complex logic.
        // Simple approach: Prepend it (as if it was just added/modified) OR Re-render entire list.
        // Re-rendering entire list is safest to ensure order is correct.
        todoList.innerHTML = '';
        // Since we are prepending for display (reverse order of array)
        todoList.innerHTML = '';
        tasks.forEach(task => {
            todoList.prepend(renderTask(task));
        });

        // Hide notification
        undoNotification.classList.add('hidden');

        // If we undo a deletion, we should probably remove it from history as well to avoid duplicates logic
        // or just accept it's in history too. Let's remove it from history if it's the most recent one.
        if (deletedTasks.length > 0 && deletedTasks[0].id === deletedTask.id) {
            deletedTasks.shift();
            saveDeletedTasks();
        }

        deletedTask = null;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initial Render
    // Display tasks in reverse order (newest first) to match 'prepend' behavior in addTask
    tasks.forEach(task => {
        todoList.prepend(renderTask(task));
    });
    renderHistoryList();
    updateEmptyState();

    // Global Listeners
    addBtn.addEventListener('click', addTask);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    // Drag and Drop Logic
    todoList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(todoList, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) {
            todoList.appendChild(draggable);
        } else {
            todoList.insertBefore(draggable, afterElement);
        }
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.todo-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function updateTasksOrder() {
        const newOrderIds = [...todoList.children].map(li => parseInt(li.dataset.id));

        // Reorder tasks array based on DOM
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        tasks = newOrderIds.map(id => taskMap.get(id)).filter(t => t !== undefined);

        saveTasks();
    }
});
