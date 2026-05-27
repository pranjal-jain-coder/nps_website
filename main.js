document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    
    // Initial fetch based on default tab
    fetchAnnouncements();
    fetchSuggestions();
    fetchHousePoints();
    
    // Form submissions
    document.getElementById('suggestion-form').addEventListener('submit', handleSuggestionSubmit);
    document.getElementById('upload-form').addEventListener('submit', handleFileUpload);
    document.getElementById('upload-grade').addEventListener('change', handleGradeChange);
    
    // Init Admin features
    initAdminAuth();
    fetchCalendarEvents();
});

const gradeData = {
    '9': { subjects: ['English', 'Hindi', 'French', 'Sanskrit', 'Kannada', 'Math', 'Science', 'Social Science'], exams: ['PT 1', 'Half-Yearly', 'PT 3', 'Annual-Exam'] },
    '10': { subjects: ['English', 'Hindi', 'French', 'Sanskrit', 'Kannada', 'Math', 'Science', 'Social Science'], exams: ['PT 1', 'Half-Yearly', 'Pre-board 1', 'PT 3', 'Pre-board 2'] },
    '11': { subjects: ['English', 'Math', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Economics', 'Psychology', 'Accountancy', 'Business Studies', 'Applied Mathematics', 'Entrepreneurship', 'Informatics Practices', 'History'], exams: ['UT 1', 'UT 2', 'Half-Yearly', 'UT 3', 'UT 4', 'Annual-Exam'] },
    '12': { subjects: ['English', 'Math', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Economics', 'Psychology', 'Accountancy', 'Business Studies', 'Applied Mathematics', 'Entrepreneurship', 'Informatics Practices', 'History'], exams: ['UT 1', 'UT 2', 'Half-Yearly', 'UT 3', 'UT 4', 'Annual-Exam'] }
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

// --- Navigation Logic ---
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            navBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            
            // Refresh data based on tab
            if(targetId === 'announcements') fetchAnnouncements();
            if(targetId === 'fixit-portal') fetchSuggestions();
            if(targetId === 'house-points') fetchHousePoints();
        });
    });
}

// --- Announcements (Campus Pulse Board) ---
async function fetchAnnouncements() {
    const container = document.getElementById('announcements-container');
    try {
        const response = await fetch('/.netlify/functions/getAnnouncements');
        if (!response.ok) throw new Error('Failed to fetch announcements');
        const data = await response.json();
        
        container.innerHTML = ''; // Clear loading
        
        if(data.length === 0) {
            container.innerHTML = '<p>No announcements at this time.</p>';
            return;
        }

        data.forEach(item => {
            const card = document.createElement('div');
            card.className = `announcement-card priority-${item.Priority}`;
            
            let attachmentHtml = '';
            if(item.Attachment_URL) {
                attachmentHtml = `<a href="${item.Attachment_URL}" target="_blank" class="attachment-link">Download Attachment</a>`;
            }

            card.innerHTML = `
                <div class="announcement-meta">
                    <span class="date">${item.Date}</span>
                    <span class="priority-badge">${item.Priority} Priority</span>
                </div>
                <h3>${item.Title}</h3>
                <p>${item.Content}</p>
                ${attachmentHtml}
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="status-message error" style="display:block">Could not load announcements. Please check Netlify configuration.</p>';
    }
}

// --- Fix-It Portal (Suggestions) ---
async function fetchSuggestions() {
    try {
        const response = await fetch('/.netlify/functions/getSuggestions');
        if (!response.ok) throw new Error('Failed to fetch suggestions');
        const data = await response.json();
        
        // Clear lanes
        ['submitted', 'under-review', 'resolved'].forEach(lane => {
            document.getElementById(`lane-${lane}`).innerHTML = '';
        });

        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            card.innerHTML = `
                <span class="cat-badge">${item.Category}</span>
                <p>${item.Description}</p>
                <small style="color: var(--text-secondary); margin-top: 8px; display: block;">${new Date(item.Timestamp).toLocaleDateString()}</small>
            `;
            
            // Map status to lane ID
            let laneId = 'lane-submitted';
            if(item.Status === 'Under Review' || item.Status === 'Discussing with Administration') laneId = 'lane-under-review';
            if(item.Status === 'Resolved') laneId = 'lane-resolved';
            
            const lane = document.getElementById(laneId);
            if(lane) lane.appendChild(card);
        });
    } catch (error) {
        console.error(error);
    }
}

async function handleSuggestionSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const statusDiv = document.getElementById('suggestion-status');
    
    // Basic Rate Limiting
    const lastSubmit = localStorage.getItem('lastSuggestionTime');
    if (lastSubmit && (Date.now() - parseInt(lastSubmit)) < 60000) {
        statusDiv.textContent = 'Please wait a minute before submitting another suggestion.';
        statusDiv.className = 'status-message error';
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    
    const category = document.getElementById('sugg-category').value;
    const description = document.getElementById('sugg-description').value;

    try {
        const response = await fetch('/.netlify/functions/submitSuggestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, description })
        });

        if (!response.ok) throw new Error('Failed to submit');
        
        statusDiv.textContent = 'Suggestion submitted anonymously!';
        statusDiv.className = 'status-message success';
        e.target.reset();
        localStorage.setItem('lastSuggestionTime', Date.now().toString());
        
        // Refresh board
        fetchSuggestions();
    } catch (error) {
        console.error(error);
        statusDiv.textContent = 'Error submitting suggestion. Ensure backend is configured.';
        statusDiv.className = 'status-message error';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Anonymous Suggestion';
    }
}

// --- House Points ---
async function fetchHousePoints() {
    const container = document.getElementById('house-chart');
    const lastUpdated = document.getElementById('house-last-updated');
    const historyTable = document.getElementById('admin-house-history');
    
    try {
        const response = await fetch('/.netlify/functions/getHousePoints');
        if (!response.ok) throw new Error('Failed to fetch house points');
        const data = await response.json();
        
        container.innerHTML = ''; 
        
        const maxScore = Math.max(...data.leaderboard.map(d => parseInt(d.Current_Score) || 0), 100);
        let latestUpdate = new Date(0);

        data.leaderboard.forEach(item => {
            const score = parseInt(item.Current_Score) || 0;
            const percentage = (score / maxScore) * 100;
            const houseVar = `var(--house-${item.House_Name.toLowerCase()})`;
            
            const updatedDate = new Date(item.Last_Updated);
            if(updatedDate > latestUpdate) latestUpdate = updatedDate;

            const row = document.createElement('div');
            row.className = 'house-bar-wrapper';
            row.innerHTML = `
                <div class="house-label">${item.House_Name}</div>
                <div class="house-bar-container">
                    <div class="house-bar" style="background-color: ${houseVar}; width: 0%;">
                        <span class="house-score">${score} pts</span>
                    </div>
                </div>
            `;
            container.appendChild(row);

            setTimeout(() => {
                row.querySelector('.house-bar').style.width = `${percentage}%`;
            }, 100);
        });

        lastUpdated.textContent = `Last updated: ${latestUpdate.toLocaleString()}`;

        if (historyTable && data.history) {
            historyTable.innerHTML = '';
            data.history.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(item.Date).toLocaleDateString()}</td>
                    <td>${item.House}</td>
                    <td style="color: ${item.Points >= 0 ? '#4ade80' : '#f87171'}">${item.Points > 0 ? '+' : ''}${item.Points}</td>
                    <td>${item.Reason}</td>
                `;
                historyTable.appendChild(tr);
            });
        }

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="status-message error" style="display:block">Could not load house points. Please check Netlify configuration.</p>';
    }
}

// --- File Upload ---
async function handleFileUpload(e) {
    e.preventDefault();
    const statusDiv = document.getElementById('upload-status');
    const fileInput = document.getElementById('upload-file');
    const file = fileInput.files[0];
    
    if(!file) return;

    if (file.size > 20 * 1024 * 1024) { // 20MB limit
        statusDiv.textContent = 'File exceeds 20MB limit.';
        statusDiv.className = 'status-message error';
        return;
    }

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    const subject = document.getElementById('upload-subject').value;
    const year = document.getElementById('upload-year').value;
    const grade = document.getElementById('upload-grade').value;
    const type = document.getElementById('upload-type').value;

    try {
        const base64 = await fileToBase64(file);
        
        const response = await fetch('/.netlify/functions/uploadResource', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name,
                mimeType: file.type,
                base64: base64.split(',')[1], // Remove data URL prefix
                subject,
                year,
                grade,
                type
            })
        });

        if (!response.ok) throw new Error('Upload failed');
        
        statusDiv.textContent = 'Document uploaded successfully for review!';
        statusDiv.className = 'status-message success';
        e.target.reset();
    } catch (error) {
        console.error(error);
        statusDiv.textContent = 'Error uploading file. Ensure backend is configured.';
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
        reader.onerror = error => reject(error);
    });
}

// --- Calendar Logic ---
async function fetchCalendarEvents() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    // 1. Draw the empty calendar grid first
    grid.innerHTML = '';
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    // Create headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(d => {
        const header = document.createElement('div');
        header.className = 'calendar-cell header';
        header.textContent = d;
        grid.appendChild(header);
    });

    // Calculate days in month
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty cells for padding
    for(let i=0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-cell';
        empty.style.background = 'transparent';
        empty.style.border = 'none';
        grid.appendChild(empty);
    }

    // Create cells for each day
    const dayCells = {};
    for(let i=1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        if(i === today.getDate()) {
            cell.style.borderColor = 'var(--accent-color)';
            cell.style.background = 'rgba(59, 130, 246, 0.1)';
        }
        
        const dateLabel = document.createElement('div');
        dateLabel.className = 'calendar-date';
        dateLabel.textContent = i;
        cell.appendChild(dateLabel);
        
        grid.appendChild(cell);
        dayCells[i] = cell;
    }

    // 2. Fetch and add events
    try {
        const response = await fetch('/.netlify/functions/getCalendarEvents');
        if (!response.ok) throw new Error('Failed to fetch calendar');
        const events = await response.json();

        events.forEach(event => {
            const eventDate = new Date(event.Date);
            if (eventDate.getFullYear() === year && eventDate.getMonth() === month) {
                const day = eventDate.getDate();
                if (dayCells[day]) {
                    const eventDiv = document.createElement('div');
                    eventDiv.className = `calendar-event event-${event.Type}`;
                    eventDiv.textContent = event.Name;
                    eventDiv.title = `ID: ${event.ID}`;
                    dayCells[day].appendChild(eventDiv);
                }
            }
        });

    } catch(err) {
        console.error('Failed to load calendar events:', err);
        // Calendar remains visible, just empty
    }
}

// --- Admin Authentication & Dashboard ---
function initAdminAuth() {
    const loginBtn = document.getElementById('admin-login-btn');
    const logoutBtn = document.getElementById('admin-logout-btn');
    const modal = document.getElementById('login-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const loginForm = document.getElementById('login-form');
    
    // Forms
    document.getElementById('admin-announcement-form')?.addEventListener('submit', handleAdminAnnouncement);
    document.getElementById('admin-calendar-form')?.addEventListener('submit', handleAdminCalendar);
    document.getElementById('admin-house-form')?.addEventListener('submit', handleAdminHousePoints);
    document.getElementById('refresh-submissions-btn')?.addEventListener('click', fetchAdminSubmissions);

    const token = localStorage.getItem('adminToken');
    if (token) {
        showAdminUI();
    }

    loginBtn?.addEventListener('click', () => {
        if (localStorage.getItem('adminToken')) return;
        modal.classList.add('active');
    });

    closeBtn?.addEventListener('click', () => modal.classList.remove('active'));

    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('adminToken');
        location.reload();
    });

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = document.getElementById('login-password').value;
        const status = document.getElementById('login-status');
        
        try {
            const response = await fetch('/.netlify/functions/adminAuth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
            });
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('adminToken', data.token);
                modal.classList.remove('active');
                showAdminUI();
            } else {
                status.textContent = data.error || 'Invalid password';
                status.className = 'status-message error';
            }
        } catch (err) {
            status.textContent = 'Server error';
            status.className = 'status-message error';
        }
    });
}

function showAdminUI() {
    document.getElementById('admin-dashboard-nav').style.display = 'block';
    document.getElementById('admin-login-btn').parentElement.style.display = 'none';
    fetchAdminSubmissions();
}

async function adminApiCall(endpoint, method, body) {
    const token = localStorage.getItem('adminToken');
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(`/.netlify/functions/${endpoint}`, options);
    if (response.status === 401) {
        localStorage.removeItem('adminToken');
        location.reload();
    }
    return response;
}

async function handleAdminAnnouncement(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const status = document.getElementById('admin-ann-status');
    
    try {
        const body = {
            title: document.getElementById('admin-ann-title').value,
            content: document.getElementById('admin-ann-content').value,
            priority: document.getElementById('admin-ann-priority').value,
            eventId: document.getElementById('admin-ann-event-id').value,
            url: document.getElementById('admin-ann-url').value
        };
        const response = await adminApiCall('addAnnouncement', 'POST', body);
        if(!response.ok) throw new Error('Failed');
        status.textContent = 'Posted!';
        status.className = 'status-message success';
        e.target.reset();
        fetchAnnouncements();
    } catch(err) {
        status.textContent = 'Error posting.';
        status.className = 'status-message error';
    } finally {
        btn.disabled = false;
    }
}

async function handleAdminCalendar(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const status = document.getElementById('admin-cal-status');
    
    try {
        const body = {
            date: document.getElementById('admin-cal-date').value,
            name: document.getElementById('admin-cal-name').value,
            type: document.getElementById('admin-cal-type').value
        };
        const response = await adminApiCall('addCalendarEvent', 'POST', body);
        if(!response.ok) throw new Error('Failed');
        status.textContent = 'Event Added!';
        status.className = 'status-message success';
        e.target.reset();
        fetchCalendarEvents();
    } catch(err) {
        status.textContent = 'Error adding event.';
        status.className = 'status-message error';
    } finally {
        btn.disabled = false;
    }
}

async function handleAdminHousePoints(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const status = document.getElementById('admin-house-status');
    
    try {
        const body = {
            house: document.getElementById('admin-house-name').value,
            points: parseInt(document.getElementById('admin-house-points').value),
            reason: document.getElementById('admin-house-reason').value
        };
        const response = await adminApiCall('addHousePoints', 'POST', body);
        if(!response.ok) throw new Error('Failed');
        status.textContent = 'Points Updated!';
        status.className = 'status-message success';
        e.target.reset();
        fetchHousePoints();
    } catch(err) {
        status.textContent = 'Error updating points.';
        status.className = 'status-message error';
    } finally {
        btn.disabled = false;
    }
}

async function fetchAdminSubmissions() {
    const list = document.getElementById('admin-submissions-list');
    if (!list) return;
    
    try {
        list.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
        const response = await adminApiCall('getSubmissions', 'GET');
        const data = await response.json();
        
        list.innerHTML = '';
        data.forEach(sub => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(sub.Date).toLocaleDateString()}</td>
                <td>Grade ${sub.Grade}</td>
                <td>${sub.Subject}</td>
                <td>${sub.Type}</td>
                <td><a href="https://drive.google.com/file/d/${sub.FileID}/view" target="_blank" class="attachment-link">View File</a></td>
            `;
            list.appendChild(tr);
        });
    } catch (err) {
        list.innerHTML = '<tr><td colspan="5" style="color:red;">Error loading submissions.</td></tr>';
    }
}
