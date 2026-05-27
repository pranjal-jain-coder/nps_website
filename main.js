let calendarEvents = [];
let displayedYear = new Date().getFullYear();
let displayedMonth = new Date().getMonth();
const MAX_UPLOAD_BYTES = Math.floor(4.5 * 1024 * 1024);

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();

    fetchAnnouncements();
    fetchSuggestions();
    fetchHousePoints();

    document.getElementById('suggestion-form').addEventListener('submit', handleSuggestionSubmit);
    document.getElementById('upload-form').addEventListener('submit', handleFileUpload);
    document.getElementById('upload-grade').addEventListener('change', handleGradeChange);

    document.getElementById('admin-announcement-form').addEventListener('submit', handleAdminAnnouncement);
    document.getElementById('admin-calendar-form').addEventListener('submit', handleAdminCalendar);
    document.getElementById('refresh-submissions-btn').addEventListener('click', fetchAdminSubmissions);

    document.getElementById('cal-prev').addEventListener('click', () => {
        displayedMonth--;
        if (displayedMonth < 0) { displayedMonth = 11; displayedYear--; }
        renderCalendarGrid();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
        displayedMonth++;
        if (displayedMonth > 11) { displayedMonth = 0; displayedYear++; }
        renderCalendarGrid();
    });

    document.getElementById('sugg-modal-close').addEventListener('click', () => closeModal('suggestion-modal'));
    document.getElementById('edit-modal-close').addEventListener('click', () => closeModal('edit-modal'));
    document.getElementById('suggestion-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('suggestion-modal'); });
    document.getElementById('edit-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('edit-modal'); });

    initAdminAuth();
    fetchCalendarEvents();
});

const gradeData = {
    '9':  { subjects: ['English', 'Hindi', 'French', 'Sanskrit', 'Kannada', 'Math', 'Science', 'Social Science'], exams: ['PT 1', 'Half-Yearly', 'PT 3', 'Annual-Exam'] },
    '10': { subjects: ['English', 'Hindi', 'French', 'Sanskrit', 'Kannada', 'Math', 'Science', 'Social Science'], exams: ['PT 1', 'Half-Yearly', 'Pre-board 1', 'PT 3', 'Pre-board 2'] },
    '11': { subjects: ['English', 'Math', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Economics', 'Psychology', 'Accountancy', 'Business Studies', 'Applied Mathematics', 'Entrepreneurship', 'Informatics Practices', 'History'], exams: ['UT 1', 'UT 2', 'Half-Yearly', 'UT 3', 'UT 4', 'Annual-Exam'] },
    '12': { subjects: ['English', 'Math', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Economics', 'Psychology', 'Accountancy', 'Business Studies', 'Applied Mathematics', 'Entrepreneurship', 'Informatics Practices', 'History'], exams: ['UT 1', 'UT 2', 'Half-Yearly', 'UT 3', 'UT 4', 'Annual-Exam'] }
};

const CATEGORY_COLORS = {
    Infrastructure: { bg: 'rgba(249,115,22,0.15)', border: '#f97316', text: '#fb923c' },
    Academics:      { bg: 'rgba(59,130,246,0.15)',  border: '#3b82f6', text: '#60a5fa' },
    Culture:        { bg: 'rgba(236,72,153,0.15)',  border: '#ec4899', text: '#f472b6' },
    Sports:         { bg: 'rgba(16,185,129,0.15)',  border: '#10b981', text: '#34d399' },
    General:        { bg: 'rgba(139,92,246,0.15)',  border: '#8b5cf6', text: '#a78bfa' },
};

const ANN_TYPE_COLORS = {
    General:      '#64748b',
    Academic:     '#f59e0b',
    'Inter-School': '#3b82f6',
    MUN:          '#8b5cf6',
    'Inter-House':'#f97316',
    Sports:       '#10b981',
};

function handleGradeChange(e) {
    const grade = e.target.value;
    const subjectSelect = document.getElementById('upload-subject');
    const examSelect = document.getElementById('upload-type');
    if (!grade) {
        subjectSelect.innerHTML = '<option value="">Select Grade First</option>';
        subjectSelect.disabled = true;
        examSelect.innerHTML = '<option value="">Select Grade First</option>';
        examSelect.disabled = true;
        return;
    }
    const data = gradeData[grade] || { subjects: ['General'], exams: ['General'] };
    subjectSelect.innerHTML = '<option value="">Select Subject</option>' + data.subjects.map(s => `<option value="${s}">${s}</option>`).join('');
    subjectSelect.disabled = false;
    examSelect.innerHTML = '<option value="">Select Exam</option>' + data.exams.map(ex => `<option value="${ex}">${ex}</option>`).join('');
    examSelect.disabled = false;
}

function isAdmin() { return !!localStorage.getItem('adminToken'); }

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// --- Navigation ---
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            if (!targetId) return;
            navBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(targetId).classList.add('active');
            if (targetId === 'announcements') fetchAnnouncements();
            if (targetId === 'fixit-portal') fetchSuggestions();
            if (targetId === 'house-points') fetchHousePoints();
        });
    });
}

// --- Announcements ---
async function fetchAnnouncements() {
    const container = document.getElementById('announcements-container');
    try {
        const response = await fetch('/.netlify/functions/getAnnouncements');
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();

        container.innerHTML = '';
        if (data.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No announcements at this time.</p>';
            return;
        }

        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'announcement-card';
            const typeColor = ANN_TYPE_COLORS[item.Type] || ANN_TYPE_COLORS.General;
            card.style.borderLeft = `4px solid ${typeColor}`;

            let eventsHtml = '';
            if (item.Event_IDs && item.Event_IDs.length > 0) {
                const linked = calendarEvents.filter(e => item.Event_IDs.includes(e.ID));
                if (linked.length > 0) {
                    eventsHtml = `<div class="linked-events">${linked.map(e =>
                        `<span class="event-chip event-chip-${e.Type.toLowerCase()}">${e.Name} · ${new Date(e.Date).toLocaleDateString()}</span>`
                    ).join('')}</div>`;
                }
            }

            let attachmentHtml = item.Attachment_URL
                ? `<a href="${item.Attachment_URL}" target="_blank" class="attachment-link">View Attachment</a>` : '';

            const adminControls = isAdmin() && item.ID ? `
                <div class="ann-admin-controls">
                    <button class="sugg-btn sugg-forward" onclick="openAnnouncementEdit(${JSON.stringify(item).replace(/"/g, '&quot;')})">Edit</button>
                    <button class="sugg-btn sugg-delete" onclick="deleteAnnouncementById('${item.ID}')">Delete</button>
                </div>` : '';

            card.innerHTML = `
                <div class="announcement-meta">
                    <span class="date">${item.Date}</span>
                    <span class="ann-type-badge" style="background:${typeColor}20;color:${typeColor};border:1px solid ${typeColor}40">${item.Type}</span>
                </div>
                <h3>${item.Title}</h3>
                <p>${item.Content}</p>
                ${eventsHtml}
                ${attachmentHtml}
                ${adminControls}
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="status-message error" style="display:block">Could not load announcements.</p>';
    }
}

async function handleAdminAnnouncement(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const status = document.getElementById('admin-ann-status');
    const fileStatus = document.getElementById('admin-ann-file-status');

    try {
        // Upload attachment if provided
        let attachmentUrl = '';
        const fileInput = document.getElementById('admin-ann-file');
        if (fileInput.files[0]) {
            fileStatus.textContent = 'Uploading attachment…';
            fileStatus.className = 'status-message success';
            const file = fileInput.files[0];
            if (file.size > MAX_UPLOAD_BYTES) throw new Error('Attachment exceeds 4.5MB limit.');
            const base64 = await fileToBase64(file);
            const uploadRes = await adminApiCall('uploadAttachment', 'POST', {
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                base64: base64.split(',')[1]
            });
            const uploadData = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok) throw new Error(uploadData.error || 'Attachment upload failed');
            attachmentUrl = uploadData.url;
            fileStatus.textContent = 'Attachment uploaded.';
        }

        const checkedBoxes = document.querySelectorAll('#admin-event-picker input[name="event-ids"]:checked');
        const body = {
            title: document.getElementById('admin-ann-title').value,
            content: document.getElementById('admin-ann-content').value,
            type: document.getElementById('admin-ann-type').value,
            eventIds: Array.from(checkedBoxes).map(cb => cb.value),
            attachmentUrl
        };
        const res = await adminApiCall('addAnnouncement', 'POST', body);
        if (!res.ok) throw new Error('Failed');
        status.textContent = 'Posted!';
        status.className = 'status-message success';
        e.target.reset();
        fileStatus.textContent = '';
        fileStatus.className = 'status-message';
        document.querySelectorAll('#admin-event-picker input').forEach(cb => cb.checked = false);
        fetchAnnouncements();
    } catch (err) {
        status.textContent = `Error: ${err.message || 'Could not post announcement.'}`;
        status.className = 'status-message error';
    } finally { btn.disabled = false; }
}

function openAnnouncementEdit(item) {
    const checkedIds = item.Event_IDs || [];
    const annTypes = ['General','Academic','Inter-School','MUN','Inter-House','Sports'];
    const eventPickerHtml = calendarEvents.length === 0
        ? '<p style="color:var(--text-secondary);font-size:14px;">No calendar events yet.</p>'
        : calendarEvents.map(e => `
            <label class="event-picker-item">
                <input type="checkbox" name="edit-event-ids" value="${e.ID}" ${checkedIds.includes(e.ID) ? 'checked' : ''}>
                <span class="event-chip event-chip-${e.Type.toLowerCase()}">${e.Name}</span>
                <span class="event-picker-date">${new Date(e.Date).toLocaleDateString()}</span>
            </label>`).join('');

    const currentAttachment = item.Attachment_URL
        ? `<p style="font-size:12px;color:var(--text-secondary);margin-top:6px;">Current: <a href="${item.Attachment_URL}" target="_blank" style="color:var(--accent-color);">View file</a></p>` : '';

    document.getElementById('edit-modal-body').innerHTML = `
        <h2 style="margin-bottom:1.5rem;">Edit Announcement</h2>
        <form id="edit-ann-form">
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="edit-ann-title" required value="${escHtml(item.Title)}">
            </div>
            <div class="form-group">
                <label>Content</label>
                <textarea id="edit-ann-content" required rows="3">${escHtml(item.Content)}</textarea>
            </div>
            <div class="form-group">
                <label>Type</label>
                <select id="edit-ann-type">
                    ${annTypes.map(t => `<option value="${t}" ${item.Type===t?'selected':''}>${t}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Link Calendar Events</label>
                <div class="event-picker">${eventPickerHtml}</div>
            </div>
            <div class="form-group">
                <label>Replace Attachment (optional, &lt;4.5MB)</label>
                <input type="file" id="edit-ann-file" accept=".pdf,.png,.jpg,.jpeg,.docx,.pptx">
                ${currentAttachment}
                <div id="edit-ann-file-status" class="status-message"></div>
            </div>
            <div style="display:flex;gap:12px;margin-top:8px;">
                <button type="submit" class="primary-btn" style="flex:1;">Save Changes</button>
                <button type="button" class="primary-btn" style="flex:1;background:rgba(239,68,68,0.2);color:#f87171;border:1px solid #f87171;" onclick="deleteAnnouncementById('${item.ID}')">Delete</button>
            </div>
            <div id="edit-ann-status" class="status-message"></div>
        </form>
    `;
    document.getElementById('edit-ann-form').addEventListener('submit', async e2 => {
        e2.preventDefault();
        const btn = e2.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        const st = document.getElementById('edit-ann-status');
        const fileSt = document.getElementById('edit-ann-file-status');
        try {
            let attachmentUrl = item.Attachment_URL || '';
            const fileInput = document.getElementById('edit-ann-file');
            if (fileInput.files[0]) {
                fileSt.textContent = 'Uploading…';
                fileSt.className = 'status-message success';
                const file = fileInput.files[0];
                if (file.size > MAX_UPLOAD_BYTES) throw new Error('Attachment exceeds 4.5MB limit.');
                const base64 = await fileToBase64(file);
                const uploadRes = await adminApiCall('uploadAttachment', 'POST', {
                    fileName: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    base64: base64.split(',')[1]
                });
                const uploadData = await uploadRes.json().catch(() => ({}));
                if (!uploadRes.ok) throw new Error(uploadData.error || 'Attachment upload failed');
                attachmentUrl = uploadData.url;
            }
            const checked = document.querySelectorAll('#edit-modal-body input[name="edit-event-ids"]:checked');
            const res = await adminApiCall('editAnnouncement', 'POST', {
                id: item.ID,
                title: document.getElementById('edit-ann-title').value,
                content: document.getElementById('edit-ann-content').value,
                type: document.getElementById('edit-ann-type').value,
                eventIds: Array.from(checked).map(cb => cb.value),
                attachmentUrl
            });
            if (!res.ok) throw new Error('Failed');
            st.textContent = 'Saved!';
            st.className = 'status-message success';
            fetchAnnouncements();
            setTimeout(() => closeModal('edit-modal'), 800);
        } catch (err) {
            st.textContent = `Error: ${err.message}`;
            st.className = 'status-message error';
        } finally { btn.disabled = false; }
    });
    openModal('edit-modal');
}

async function deleteAnnouncementById(id) {
    if (!confirm('Delete this announcement permanently?')) return;
    closeModal('edit-modal');
    try {
        const res = await adminApiCall('deleteAnnouncement', 'POST', { id });
        if (!res.ok) throw new Error('Failed');
        fetchAnnouncements();
    } catch { alert('Failed to delete announcement.'); }
}

// --- Calendar ---
async function fetchCalendarEvents() {
    try {
        const res = await fetch('/.netlify/functions/getCalendarEvents');
        if (!res.ok) throw new Error('Failed');
        calendarEvents = await res.json();
    } catch (err) {
        console.error('Failed to load calendar events:', err);
    }
    renderCalendarGrid();
    renderEventPicker();
}

function renderCalendarGrid() {
    const grid = document.getElementById('calendar-grid');
    const titleEl = document.getElementById('calendar-title');
    if (!grid) return;

    const year = displayedYear;
    const month = displayedMonth;
    const today = new Date();

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    if (titleEl) titleEl.textContent = `${monthNames[month]} ${year}`;

    grid.innerHTML = '';

    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
        const h = document.createElement('div');
        h.className = 'calendar-cell header';
        h.textContent = d;
        grid.appendChild(h);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-cell';
        empty.style.cssText = 'background:transparent;border:none;';
        grid.appendChild(empty);
    }

    const dayCells = {};
    for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        if (isToday) {
            cell.style.borderColor = 'var(--accent-color)';
            cell.style.background = 'rgba(59,130,246,0.1)';
        }
        const lbl = document.createElement('div');
        lbl.className = 'calendar-date';
        lbl.textContent = i;
        cell.appendChild(lbl);
        grid.appendChild(cell);
        dayCells[i] = cell;
    }

    calendarEvents.forEach(event => {
        const d = new Date(event.Date);
        if (d.getFullYear() === year && d.getMonth() === month) {
            const day = d.getDate();
            if (dayCells[day]) {
                const ev = document.createElement('div');
                ev.className = `calendar-event event-${event.Type}`;
                ev.textContent = event.Name;
                if (isAdmin()) {
                    ev.style.cursor = 'pointer';
                    ev.title = 'Click to edit';
                    ev.addEventListener('click', e => { e.stopPropagation(); openCalendarEventEdit(event); });
                }
                dayCells[day].appendChild(ev);
            }
        }
    });
}

function renderEventPicker() {
    const picker = document.getElementById('admin-event-picker');
    if (!picker) return;
    picker.innerHTML = '';
    if (calendarEvents.length === 0) {
        picker.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">No calendar events yet — add one on the left.</p>';
        return;
    }
    calendarEvents.forEach(event => {
        const label = document.createElement('label');
        label.className = 'event-picker-item';
        label.innerHTML = `
            <input type="checkbox" name="event-ids" value="${event.ID}">
            <span class="event-chip event-chip-${event.Type.toLowerCase()}">${event.Name}</span>
            <span class="event-picker-date">${new Date(event.Date).toLocaleDateString()}</span>
        `;
        picker.appendChild(label);
    });
}

async function handleAdminCalendar(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const status = document.getElementById('admin-cal-status');
    try {
        const res = await adminApiCall('addCalendarEvent', 'POST', {
            date: document.getElementById('admin-cal-date').value,
            name: document.getElementById('admin-cal-name').value,
            type: document.getElementById('admin-cal-type').value
        });
        if (!res.ok) throw new Error('Failed');
        status.textContent = 'Event added!';
        status.className = 'status-message success';
        e.target.reset();
        fetchCalendarEvents();
    } catch {
        status.textContent = 'Error adding event.';
        status.className = 'status-message error';
    } finally { btn.disabled = false; }
}

function openCalendarEventEdit(event) {
    document.getElementById('edit-modal-body').innerHTML = `
        <h2 style="margin-bottom:1.5rem;">Edit Calendar Event</h2>
        <form id="edit-cal-form">
            <div class="form-group">
                <label>Event Name</label>
                <input type="text" id="edit-cal-name" required value="${escHtml(event.Name)}">
            </div>
            <div class="form-group">
                <label>Date</label>
                <input type="date" id="edit-cal-date" required value="${event.Date ? event.Date.substring(0,10) : ''}">
            </div>
            <div class="form-group">
                <label>Type</label>
                <select id="edit-cal-type">
                    ${['Academic','Cultural','Sports','Holiday'].map(t => `<option value="${t}" ${event.Type===t?'selected':''}>${t}</option>`).join('')}
                </select>
            </div>
            <div style="display:flex;gap:12px;margin-top:8px;">
                <button type="submit" class="primary-btn" style="flex:1;">Save Changes</button>
                <button type="button" class="primary-btn" style="flex:1;background:rgba(239,68,68,0.2);color:#f87171;border:1px solid #f87171;" onclick="deleteCalendarEventById('${event.ID}')">Delete</button>
            </div>
            <div id="edit-cal-status" class="status-message"></div>
        </form>
    `;
    document.getElementById('edit-cal-form').addEventListener('submit', async e2 => {
        e2.preventDefault();
        const btn = e2.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        const st = document.getElementById('edit-cal-status');
        try {
            const res = await adminApiCall('editCalendarEvent', 'POST', {
                id: event.ID,
                date: document.getElementById('edit-cal-date').value,
                name: document.getElementById('edit-cal-name').value,
                type: document.getElementById('edit-cal-type').value
            });
            if (!res.ok) throw new Error('Failed');
            st.textContent = 'Saved!';
            st.className = 'status-message success';
            fetchCalendarEvents();
            setTimeout(() => closeModal('edit-modal'), 800);
        } catch {
            st.textContent = 'Error saving.';
            st.className = 'status-message error';
        } finally { btn.disabled = false; }
    });
    openModal('edit-modal');
}

async function deleteCalendarEventById(id) {
    if (!confirm('Delete this calendar event?')) return;
    closeModal('edit-modal');
    try {
        const res = await adminApiCall('deleteCalendarEvent', 'POST', { id });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 409 && Array.isArray(data.linkedAnnouncements)) {
                const titles = data.linkedAnnouncements.map(item => `- ${item.title || item.id}`).join('\n');
                alert(`This event is still linked to announcement posts. Edit those posts and remove the event before deleting it:\n\n${titles}`);
                return;
            }
            throw new Error(data.error || 'Failed');
        }
        fetchCalendarEvents();
    } catch (err) { alert(err.message || 'Failed to delete event.'); }
}

// --- Suggestions ---
async function fetchSuggestions() {
    try {
        const res = await fetch('/.netlify/functions/getSuggestions');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();

        ['submitted', 'under-review', 'resolved'].forEach(lane => {
            document.getElementById(`lane-${lane}`).innerHTML = '';
        });

        data.forEach(item => {
            const colors = CATEGORY_COLORS[item.Category] || CATEGORY_COLORS.General;
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            card.style.cssText = `background:${colors.bg};border-left:3px solid ${colors.border};cursor:pointer;`;
            card.innerHTML = `
                <div class="sugg-card-title">${item.Title}</div>
                <div class="sugg-card-meta">
                    <span class="cat-badge" style="color:${colors.text};background:rgba(255,255,255,0.07)">${item.Category}</span>
                    <span style="color:var(--text-secondary);font-size:11px;">${new Date(item.Timestamp).toLocaleDateString()}</span>
                </div>
            `;
            card.addEventListener('click', () => openSuggestionDetail(item));

            let laneId = 'lane-submitted';
            if (item.Status === 'Under Review' || item.Status === 'Discussing with Administration') laneId = 'lane-under-review';
            if (item.Status === 'Resolved') laneId = 'lane-resolved';

            const lane = document.getElementById(laneId);
            if (lane) lane.appendChild(card);
        });
    } catch (error) { console.error(error); }
}

function openSuggestionDetail(item) {
    const colors = CATEGORY_COLORS[item.Category] || CATEGORY_COLORS.General;
    const adminSection = isAdmin() ? `
        <div style="border-top:1px solid var(--border-color);margin-top:1.5rem;padding-top:1.5rem;">
            <h3 class="admin-subheading" style="margin-bottom:1rem;">Admin Actions</h3>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1.5rem;">
                ${item.Status !== 'Submitted' ? `<button class="sugg-btn sugg-back" onclick="moveSuggestion('${item.ID}','${prevStatus(item.Status)}')">◀ Back to ${prevStatus(item.Status)}</button>` : ''}
                ${item.Status !== 'Resolved' ? `<button class="sugg-btn sugg-forward" onclick="moveSuggestion('${item.ID}','${nextStatus(item.Status)}')">Move to ${nextStatus(item.Status)} ▶</button>` : ''}
                <button class="sugg-btn sugg-delete" onclick="deleteSuggestionById('${item.ID}')">✕ Delete</button>
            </div>
            <h3 class="admin-subheading" style="margin-bottom:1rem;">Edit Suggestion</h3>
            <form id="edit-sugg-form">
                <div class="form-group">
                    <label>Category</label>
                    <select id="edit-sugg-cat">
                        ${['Infrastructure','Academics','Culture','Sports','General'].map(c => `<option value="${c}" ${item.Category===c?'selected':''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" id="edit-sugg-title" required value="${escHtml(item.Title)}">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="edit-sugg-desc" required rows="3">${escHtml(item.Description)}</textarea>
                </div>
                <button type="submit" class="primary-btn" style="width:auto;padding:10px 24px;">Save Changes</button>
                <div id="edit-sugg-status" class="status-message"></div>
            </form>
        </div>
    ` : '';

    document.getElementById('suggestion-modal-body').innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:1.5rem;">
            <span class="cat-badge" style="color:${colors.text};background:${colors.bg};border:1px solid ${colors.border};font-size:13px;padding:4px 12px;">${item.Category}</span>
            <span style="color:var(--text-secondary);font-size:13px;">${new Date(item.Timestamp).toLocaleDateString()}</span>
            <span style="margin-left:auto;font-size:12px;color:var(--text-secondary);background:rgba(255,255,255,0.07);padding:3px 10px;border-radius:12px;">${item.Status}</span>
        </div>
        <h2 style="margin-bottom:1rem;font-size:22px;">${item.Title}</h2>
        <p style="color:var(--text-secondary);line-height:1.7;">${item.Description}</p>
        ${adminSection}
    `;

    if (isAdmin()) {
        document.getElementById('edit-sugg-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            const st = document.getElementById('edit-sugg-status');
            try {
                const res = await adminApiCall('editSuggestion', 'POST', {
                    id: item.ID,
                    category: document.getElementById('edit-sugg-cat').value,
                    title: document.getElementById('edit-sugg-title').value,
                    description: document.getElementById('edit-sugg-desc').value
                });
                if (!res.ok) throw new Error('Failed');
                st.textContent = 'Saved!';
                st.className = 'status-message success';
                fetchSuggestions();
            } catch {
                st.textContent = 'Error saving.';
                st.className = 'status-message error';
            } finally { btn.disabled = false; }
        });
    }

    openModal('suggestion-modal');
}

function nextStatus(s) {
    if (s === 'Submitted') return 'Under Review';
    if (s === 'Under Review' || s === 'Discussing with Administration') return 'Resolved';
    return s;
}
function prevStatus(s) {
    if (s === 'Resolved') return 'Under Review';
    if (s === 'Under Review' || s === 'Discussing with Administration') return 'Submitted';
    return s;
}

async function moveSuggestion(id, newStatus) {
    try {
        const res = await adminApiCall('updateSuggestion', 'POST', { id, status: newStatus });
        if (!res.ok) throw new Error('Failed');
        closeModal('suggestion-modal');
        fetchSuggestions();
    } catch { console.error('Failed to move suggestion'); }
}

async function deleteSuggestionById(id) {
    if (!confirm('Delete this suggestion permanently?')) return;
    closeModal('suggestion-modal');
    try {
        const res = await adminApiCall('deleteSuggestion', 'POST', { id });
        if (!res.ok) throw new Error('Failed');
        fetchSuggestions();
    } catch { console.error('Failed to delete suggestion'); }
}

async function handleSuggestionSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const statusDiv = document.getElementById('suggestion-status');

    const lastSubmit = localStorage.getItem('lastSuggestionTime');
    if (lastSubmit && (Date.now() - parseInt(lastSubmit)) < 60000) {
        statusDiv.textContent = 'Please wait a minute before submitting another suggestion.';
        statusDiv.className = 'status-message error';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
        const res = await fetch('/.netlify/functions/submitSuggestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: document.getElementById('sugg-category').value,
                title: document.getElementById('sugg-title').value,
                description: document.getElementById('sugg-description').value
            })
        });
        if (!res.ok) throw new Error('Failed');
        statusDiv.textContent = 'Suggestion submitted anonymously!';
        statusDiv.className = 'status-message success';
        e.target.reset();
        localStorage.setItem('lastSuggestionTime', Date.now().toString());
        fetchSuggestions();
    } catch {
        statusDiv.textContent = 'Error submitting. Ensure backend is configured.';
        statusDiv.className = 'status-message error';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Anonymous Suggestion';
    }
}

// --- House Points ---
const HOUSES = ['Challengers', 'Explorers', 'Pioneers', 'Voyagers'];

async function fetchHousePoints() {
    const container = document.getElementById('house-points-content');
    if (!container) return;
    try {
        const res = await fetch('/.netlify/functions/getHousePoints');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();

        const totals = {};
        data.leaderboard.forEach(h => { totals[h.House_Name] = h.Current_Score; });

        const totalsHtml = HOUSES.map(h => `
            <div class="house-total-card" style="border-top:3px solid var(--house-${h.toLowerCase()})">
                <div class="house-total-name" style="color:var(--house-${h.toLowerCase()})">${h}</div>
                <div class="house-total-score">${totals[h] || 0}</div>
                <div class="house-total-label">points</div>
            </div>`).join('');

        const historyRows = data.history.length === 0
            ? `<tr><td colspan="${HOUSES.length+2}" style="text-align:center;padding:2rem;color:var(--text-secondary);">No history yet.</td></tr>`
            : data.history.map(row => `
                <tr>
                    <td>${new Date(row.Date).toLocaleDateString()}</td>
                    <td>${row.Reason}</td>
                    ${HOUSES.map(h => h === row.House
                        ? `<td class="${row.Points >= 0 ? 'pts-pos' : 'pts-neg'}">${row.Points > 0 ? '+' : ''}${row.Points}</td>`
                        : '<td class="pts-empty">—</td>'
                    ).join('')}
                </tr>`).join('');

        const adminForm = isAdmin() ? `
            <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border-color);">
                <h3 class="admin-subheading" style="margin-bottom:1rem;">Add Points Entry</h3>
                <form id="admin-house-form">
                    <div class="house-entry-grid">
                        <div class="form-group" style="margin-bottom:0;grid-column:1/-1;">
                            <label for="admin-house-reason">Reason</label>
                            <input type="text" id="admin-house-reason" required placeholder="e.g. Sports Day victory">
                        </div>
                        ${HOUSES.map(h => `
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="color:var(--house-${h.toLowerCase()})">${h}</label>
                                <input type="number" id="admin-house-${h.toLowerCase()}" placeholder="0" autocomplete="off" step="1">
                            </div>`).join('')}
                    </div>
                    <div style="margin-top:1rem;">
                        <button type="submit" class="primary-btn" style="width:auto;padding:12px 32px;">Add Entry</button>
                    </div>
                    <div id="admin-house-status" class="status-message"></div>
                </form>
            </div>` : '';

        container.innerHTML = `
            <div class="house-totals">${totalsHtml}</div>
            <div style="overflow-x:auto;margin-top:1.5rem;">
                <table class="house-ledger-table">
                    <thead>
                        <tr>
                            <th>Date</th><th>Reason</th>
                            ${HOUSES.map(h => `<th style="color:var(--house-${h.toLowerCase()})">${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>${historyRows}</tbody>
                </table>
            </div>
            ${adminForm}`;

        document.getElementById('admin-house-form')?.addEventListener('submit', handleAdminHousePoints);
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="status-message error" style="display:block">Could not load house points.</p>';
    }
}

async function handleAdminHousePoints(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const status = document.getElementById('admin-house-status');
    const reason = document.getElementById('admin-house-reason').value.trim();

    const entries = [];
    for (const h of HOUSES) {
        const raw = (document.getElementById(`admin-house-${h.toLowerCase()}`)?.value ?? '').trim();
        if (raw === '') continue;
        const points = parseInt(raw, 10);
        if (!Number.isFinite(points) || points === 0) continue;
        entries.push({ house: h, points });
    }

    if (entries.length === 0) {
        status.textContent = 'Enter a point change for at least one house.';
        status.className = 'status-message error';
        btn.disabled = false;
        return;
    }
    try {
        await Promise.all(entries.map(en => adminApiCall('addHousePoints', 'POST', { house: en.house, points: en.points, reason })));
        fetchHousePoints();
    } catch {
        status.textContent = 'Error updating points.';
        status.className = 'status-message error';
        btn.disabled = false;
    }
}

// --- File Upload ---
async function handleFileUpload(e) {
    e.preventDefault();
    const statusDiv = document.getElementById('upload-status');
    const file = document.getElementById('upload-file').files[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
        statusDiv.textContent = 'File exceeds 4.5MB limit.';
        statusDiv.className = 'status-message error';
        return;
    }
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Uploading...';
    try {
        const base64 = await fileToBase64(file);
        const res = await fetch('/.netlify/functions/uploadResource', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name, mimeType: file.type,
                base64: base64.split(',')[1],
                subject: document.getElementById('upload-subject').value,
                year: document.getElementById('upload-year').value,
                grade: document.getElementById('upload-grade').value,
                type: document.getElementById('upload-type').value
            })
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server error ${res.status}`);
        }
        statusDiv.textContent = 'Document uploaded successfully for review!';
        statusDiv.className = 'status-message success';
        e.target.reset();
    } catch (err) {
        statusDiv.textContent = `Upload failed: ${err.message}`;
        statusDiv.className = 'status-message error';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Upload Document';
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
    });
}

// --- Admin Auth ---
function initAdminAuth() {
    const loginBtn = document.getElementById('admin-login-btn');
    const logoutBtn = document.getElementById('admin-logout-btn');
    const modal = document.getElementById('login-modal');

    if (localStorage.getItem('adminToken')) showAdminUI();

    loginBtn?.addEventListener('click', () => { if (!isAdmin()) openModal('login-modal'); });
    document.getElementById('close-modal-btn')?.addEventListener('click', () => closeModal('login-modal'));
    document.getElementById('login-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('login-modal'); });

    logoutBtn?.addEventListener('click', () => { localStorage.removeItem('adminToken'); location.reload(); });

    document.getElementById('login-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const pwd = document.getElementById('login-password').value;
        const status = document.getElementById('login-status');
        try {
            const res = await fetch('/.netlify/functions/adminAuth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('adminToken', data.token);
                closeModal('login-modal');
                showAdminUI();
            } else {
                status.textContent = data.error || 'Invalid password';
                status.className = 'status-message error';
            }
        } catch {
            status.textContent = 'Server error';
            status.className = 'status-message error';
        }
    });
}

function showAdminUI() {
    document.body.classList.add('is-admin');
    fetchAnnouncements();
    fetchSuggestions();
    fetchHousePoints();
    fetchCalendarEvents();
    fetchAdminSubmissions();
}

async function adminApiCall(endpoint, method, body) {
    const token = localStorage.getItem('adminToken');
    const options = {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`/.netlify/functions/${endpoint}`, options);
    if (res.status === 401) { localStorage.removeItem('adminToken'); location.reload(); }
    return res;
}

async function fetchAdminSubmissions() {
    const list = document.getElementById('admin-submissions-list');
    if (!list) return;
    try {
        list.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading...</td></tr>';
        const res = await adminApiCall('getSubmissions', 'GET');
        const data = await res.json();
        if (data.length === 0) {
            list.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);">No submissions yet.</td></tr>';
            return;
        }
        list.innerHTML = '';
        data.forEach(sub => {
            const suffixInputId = `suffix-${sub.FileID}`;
            const statusId = `approve-status-${sub.FileID}`;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(sub.Date).toLocaleDateString()}</td>
                <td>Grade ${escHtml(sub.Grade)}</td>
                <td>${escHtml(sub.Subject)}</td>
                <td>${escHtml(sub.Type)}</td>
                <td><input type="text" id="${suffixInputId}" class="table-input" value="${escHtml(sub.Suffix || '')}" aria-label="Paper suffix"></td>
                <td><a href="https://drive.google.com/file/d/${sub.FileID}/view" target="_blank" class="attachment-link">View File</a></td>
                <td>
                    <button class="secondary-btn table-action-btn" onclick="approveSubmission('${sub.FileID}', this)">Approve PDF</button>
                    <div id="${statusId}" class="table-status"></div>
                </td>
            `;
            list.appendChild(tr);
        });
    } catch {
        list.innerHTML = '<tr><td colspan="7" style="color:#f87171;text-align:center;">Error loading submissions.</td></tr>';
    }
}

async function approveSubmission(fileId, btn) {
    const input = document.getElementById(`suffix-${fileId}`);
    const status = document.getElementById(`approve-status-${fileId}`);
    const suffix = input?.value.trim();
    if (!suffix) {
        if (status) {
            status.textContent = 'Enter a suffix.';
            status.className = 'table-status error';
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Approving...';
    }
    if (status) {
        status.textContent = '';
        status.className = 'table-status';
    }

    try {
        const res = await adminApiCall('approveSubmission', 'POST', { fileId, suffix });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
        fetchAdminSubmissions();
    } catch (err) {
        if (status) {
            status.textContent = err.message || 'Approval failed.';
            status.className = 'table-status error';
        } else {
            alert(err.message || 'Approval failed.');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Approve PDF';
        }
    }
}

// Utility: escape html for inline attributes
function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
