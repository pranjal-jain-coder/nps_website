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
});

const gradeData = {
    '9': { subjects: ['Math', 'Science', 'English', 'History', 'Geography'], exams: ['Midterm', 'Final', 'Unit Test'] },
    '10': { subjects: ['Math', 'Science', 'English', 'History', 'Geography'], exams: ['Midterm', 'Final', 'Board Prep'] },
    '11': { subjects: ['Physics', 'Chemistry', 'Math', 'Biology', 'Computer Science', 'Economics', 'Accountancy', 'Business Studies'], exams: ['Unit Test', 'Midterm', 'Final'] },
    '12': { subjects: ['Physics', 'Chemistry', 'Math', 'Biology', 'Computer Science', 'Economics', 'Accountancy', 'Business Studies'], exams: ['Pre-Board', 'Board Exam', 'Unit Test'] }
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
    
    try {
        const response = await fetch('/.netlify/functions/getHousePoints');
        if (!response.ok) throw new Error('Failed to fetch house points');
        const data = await response.json();
        
        container.innerHTML = ''; // Clear loading
        
        // Find max score for proportional width
        const maxScore = Math.max(...data.map(d => parseInt(d.Current_Score) || 0), 100);
        let latestUpdate = new Date(0);

        data.forEach(item => {
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

            // Animate bar
            setTimeout(() => {
                row.querySelector('.house-bar').style.width = `${percentage}%`;
            }, 100);
        });

        lastUpdated.textContent = `Last updated: ${latestUpdate.toLocaleString()}`;

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
