document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    const API_URL = 'http://localhost:5000/api';
    let faceApiLoaded = false;
    let currentStream = null;
    let faceDetectionInterval = null;
    let activeRecords = []; 
    let projectsChartInstance = null;
    let employeesChartInstance = null;
    let notifications = [];
    let unreadCount = 0;
    let lastCheckedEntryId = null; 
    let notificationPollInterval = null;

    // --- UI Elements ---
    const loadingOverlay = document.getElementById('loading-overlay');
    const mainAppView = document.getElementById('main-app-view');
    const logoutBtn = document.getElementById('logout-btn');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const contentSections = document.querySelectorAll('main section');
    const alertModal = document.getElementById('alert-modal');
    const alertModalContent = document.getElementById('alert-modal-content');
    const faceModal = document.getElementById('face-modal');
    const faceModalTitle = document.getElementById('face-modal-title');
    const video = document.getElementById('video');
    const statusMessage = document.getElementById('status-message');
    const actionFaceBtn = document.getElementById('action-face-btn');
    const cancelFaceBtn = document.getElementById('cancel-face-btn');
    const pinModal = document.getElementById('pin-modal');
    const savePinBtn = document.getElementById('save-pin-btn');
    const cancelPinBtn = document.getElementById('cancel-pin-btn');
    const editUserModal = document.getElementById('edit-user-modal');
    const editUserForm = document.getElementById('edit-user-form');
    const cancelEditUserBtn = document.getElementById('cancel-edit-user-btn');
    const notificationBellBtn = document.getElementById('notification-bell-btn');
    const notificationBadge = document.getElementById('notification-badge');
    const notificationPanel = document.getElementById('notification-panel');
    const notificationList = document.getElementById('notification-list');
    const mainHeaderTitle = document.getElementById('main-header-title');
    const kioskIdInput = document.getElementById('kiosk-id-input');
    const saveKioskIdBtn = document.getElementById('save-kiosk-id-btn');
    const kioskQrCodeContainer = document.getElementById('kiosk-qrcode-container');
    const downloadQrBtn = document.getElementById('download-qr-btn');

    // --- API Communication Layer ---
    const api = {
        async request(endpoint, method = 'GET', body = null) {
            const token = localStorage.getItem('authToken');
             if (!token) {
                window.location.href = 'auth.html';
                return Promise.reject(new Error('No auth token found')); 
            }
            
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            try {
                const response = await fetch(`${API_URL}/${endpoint}`, {
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : null,
                });

                if (response.status === 204) {
                    return null;
                }
                
                const responseText = await response.text();

                if (!response.ok) {
                    if (response.status === 401) {
                        handleLogout();
                    }
                    let errorMessage = `Errore del server (${response.status})`;
                     try {
                        const errorJson = JSON.parse(responseText);
                        if (errorJson.message) {
                            errorMessage = errorJson.message;
                        }
                    } catch (e) {
                        // Not a JSON error, but still an error.
                    }
                    throw new Error(errorMessage);
                }
                
                try {
                     return JSON.parse(responseText);
                } catch(e) {
                     console.error("Risposta non JSON dal server:", responseText);
                     throw new Error("Il server ha restituito una risposta in un formato non valido.");
                }

            } catch (error) {
                if (error.message.includes('Failed to fetch')) {
                    showAlert('Connessione al server non riuscita. Assicurarsi che il server sia in esecuzione.');
                } else if (!error.message.includes('No auth token found')) {
                    showAlert(`Si è verificato un errore: ${error.message}`);
                }
                console.error(`${method} ${endpoint} failed:`, error);
                throw error;
            }
        },
        get(endpoint) { return this.request(endpoint); },
        post(endpoint, body) { return this.request(endpoint, 'POST', body); },
        put(endpoint, body) { return this.request(endpoint, 'PUT', body); },
        delete(endpoint) { return this.request(endpoint, 'DELETE'); }
    };

    // --- Authentication ---
    function handleLogout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('kioskId');
        if(notificationPollInterval) clearInterval(notificationPollInterval);
        window.location.href = 'auth.html';
    }
    
    async function verifyTokenAndStartup() {
        const token = localStorage.getItem('authToken');
        
        if (token) {
            loadingOverlay.classList.remove('hidden');
            try {
                await api.get('users/profile'); 
                showMainApp();
            } catch (error) {
                handleLogout();
            }
        } else {
            window.location.href = 'auth.html';
        }
    }
    
    // --- View Management ---
    async function showMainApp() {
        loadingOverlay.classList.add('hidden');
        mainAppView.classList.remove('hidden');
        
        handleNavigation({ preventDefault: () => {}, currentTarget: document.querySelector('[data-section="dashboard-section"]') });
        loadFaceApiModelsInBackground();
        startNotificationPolling();
    }

    function handleNavigation(e) {
        e.preventDefault();
        const sectionId = e.currentTarget.dataset.section;
        const sectionTitle = e.currentTarget.querySelector('span').textContent;

        mainHeaderTitle.textContent = sectionTitle;

        sidebarLinks.forEach(link => link.classList.remove('active'));
        e.currentTarget.classList.add('active');

        contentSections.forEach(section => {
            section.classList.toggle('hidden', section.id !== sectionId);
        });
        
        if (sectionId === 'dashboard-section') loadDashboardData();
        if (sectionId === 'employees-section') loadEmployeesData();
        if (sectionId === 'clients-section') loadClientsAndProjectsData();
        if (sectionId === 'reports-section') initReportsView();
        if (sectionId === 'users-section') loadUsersData();
        if (sectionId === 'settings-section') {
            loadHolidaysData();
            loadLeaveData();
            populateLeaveEmployeeSelect();
            loadSettingsData();
        }
    }

    // --- Modals ---
    function showAlert(message, isSuccess = false) {
         alertModalContent.innerHTML = `<p class="${isSuccess ? 'text-green-600' : 'text-red-600'}">${message}</p><div class="mt-4 flex justify-end"><button id="modal-ok-btn" class="bg-blue-600 text-white px-4 py-2 rounded-md">OK</button></div>`;
         document.getElementById('modal-ok-btn').onclick = hideAlert;
         alertModal.classList.remove('hidden');
         alertModal.classList.add('flex');
         setTimeout(() => alertModalContent.classList.remove('scale-95', 'opacity-0'), 10);
    }
    function hideAlert() {
        alertModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            alertModal.classList.add('hidden');
            alertModal.classList.remove('flex');
        }, 300);
    }

    // --- Face API ---
    async function loadFaceApiModelsInBackground() {
        if(faceApiLoaded) return;
        try {
            const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            faceApiLoaded = true;
            console.log("Modelli Face API caricati con successo.");
        } catch (error) {
            console.error("Errore durante il caricamento dei modelli face-api:", error);
        }
    }
    
    function showFaceModal(employeeName, employeeId) {
        if (!faceApiLoaded) {
            return showAlert("I modelli di riconoscimento facciale non sono ancora stati caricati. attendere prego.");
        }
        faceModalTitle.textContent = `Registra impronta per: ${employeeName}`;
        actionFaceBtn.dataset.employeeId = employeeId;
        faceModal.classList.remove('hidden');
        faceModal.classList.add('flex');
        startVideo();
    }
    
     function hideFaceModal() {
        stopVideo();
        faceModal.classList.add('hidden');
        faceModal.classList.remove('flex');
    }

    async function startVideo() {
        try {
            currentStream = await navigator.mediaDevices.getUserMedia({ video: {} });
            video.srcObject = currentStream;
            video.addEventListener('play', runFaceDetection);
        } catch (err) {
            showAlert("Impossibile accedere alla fotocamera. Si prega di concedere l'autorizzazione.");
            hideFaceModal();
        }
    }
    
    function stopVideo() {
        if (faceDetectionInterval) clearInterval(faceDetectionInterval);
        if (currentStream) currentStream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        statusMessage.textContent = "Punta il viso verso la fotocamera...";
        actionFaceBtn.disabled = true;
    }
    
    function runFaceDetection() {
         faceDetectionInterval = setInterval(async () => {
            const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
            if (detections) {
                statusMessage.textContent = "Viso rilevato. Pronto per registrare.";
                actionFaceBtn.disabled = false;
            } else {
                statusMessage.textContent = "Punta un solo viso verso la fotocamera.";
                actionFaceBtn.disabled = true;
            }
        }, 500);
    }

    async function handleFaceRegistration() {
         statusMessage.textContent = "Elaborazione immagine...";
         actionFaceBtn.disabled = true;
         
         const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

         if (!detection) {
             showAlert("Impossibile rilevare chiaramente il viso. Riprova.");
             stopVideo(); startVideo();
             return;
         }
         
         const employeeId = actionFaceBtn.dataset.employeeId;
         const descriptor = Array.from(detection.descriptor);

         try {
             await api.post(`employees/face`, { employeeId, descriptor });
             showAlert("Impronta facciale registrata con successo!", true);
             hideFaceModal();
             loadEmployeesData();
         } catch(error) {
             stopVideo(); startVideo();
         }
    }

    // --- PIN Management ---
    function showPinModal(employeeId, employeeName) {
        document.getElementById('pin-employee-name').textContent = `Per il dipendente: ${employeeName}`;
        savePinBtn.dataset.employeeId = employeeId;
        pinModal.classList.remove('hidden');
        pinModal.classList.add('flex');
    }

    function hidePinModal() {
        document.getElementById('pin-input').value = '';
        pinModal.classList.add('hidden');
        pinModal.classList.remove('flex');
    }

    async function handleSetPin() {
        const pin = document.getElementById('pin-input').value;
        if (!/^\d{4}$/.test(pin)) {
            return showAlert("Il PIN deve essere di 4 cifre.");
        }
        const employeeId = savePinBtn.dataset.employeeId;
        try {
            await api.put(`employees/${employeeId}/set-pin`, { pin });
            showAlert("Codice PIN impostato con successo!", true);
            hidePinModal();
        } catch(error) {}
    }

    // --- Dashboard Logic ---
    async function loadDashboardData() {
        loadingOverlay.classList.remove('hidden');

        if (projectsChartInstance) projectsChartInstance.destroy();
        if (employeesChartInstance) employeesChartInstance.destroy();

        try {
            const [employees, clients, projects, allTimesheets] = await Promise.all([
                api.get('employees'),
                api.get('clients'),
                api.get('projects'),
                api.get('timesheets')
            ]);

            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();

            const monthlyTimesheets = allTimesheets.filter(sheet => {
                const sheetDate = new Date(sheet.date);
                return sheetDate.getFullYear() === year && sheetDate.getMonth() === month;
            });
            
            document.getElementById('total-employees').textContent = employees.length;
            document.getElementById('total-clients').textContent = clients.length;
            document.getElementById('total-projects').textContent = projects.length;

            const employeeHours = {};
            const projectHours = {};
            let totalMonthHours = 0;

            employees.forEach(e => { employeeHours[e.name] = 0; });
            projects.forEach(p => { projectHours[p.name] = 0; });

            monthlyTimesheets.forEach(sheet => {
                totalMonthHours += sheet.totalHours || 0;
                if (employeeHours[sheet.employeeName] !== undefined) {
                    employeeHours[sheet.employeeName] += sheet.totalHours || 0;
                }
            });
            
            monthlyTimesheets.forEach(sheet => {
                const dailyProjects = [...new Set(sheet.entries.map(e => e.project).filter(Boolean))];
                if (dailyProjects.length > 0) {
                    const hoursPerProject = (sheet.totalHours || 0) / dailyProjects.length;
                    dailyProjects.forEach(projName => {
                        if(projectHours[projName] !== undefined) {
                            projectHours[projName] += hoursPerProject;
                        }
                    });
                }
            });

            document.getElementById('total-hours-month').textContent = totalMonthHours.toFixed(2);
            
            renderEmployeesChart(employeeHours);
            renderProjectsChart(projectHours);
            renderRecentActivity(allTimesheets);

        } catch(error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    function renderEmployeesChart(employeeHours) {
        const ctx = document.getElementById('employees-chart').getContext('2d');
        const labels = Object.keys(employeeHours);
        const data = Object.values(employeeHours);

        employeesChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ore Lavorate',
                    data: data,
                    backgroundColor: 'rgba(79, 70, 229, 0.8)',
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderProjectsChart(projectHours) {
         const ctx = document.getElementById('projects-chart').getContext('2d');
         const labels = Object.keys(projectHours).filter(p => projectHours[p] > 0);
         const data = Object.values(projectHours).filter(h => h > 0);
        
        const backgroundColors = labels.map((_, i) => `hsl(${i * 360 / labels.length}, 70%, 60%)`);

         projectsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ore per Progetto',
                    data: data,
                    backgroundColor: backgroundColors,
                    hoverOffset: 4
                }]
            },
             options: {
                responsive: true,
                maintainAspectRatio: false,
                 plugins: {
                     legend: {
                         position: 'top',
                     },
                 }
            }
        });
    }
    
    function renderRecentActivity(timesheets) {
        const list = document.getElementById('recent-activity-list');
        list.innerHTML = '';
        if(!timesheets || timesheets.length === 0) {
            list.innerHTML = '<li class="text-gray-500 text-center">Nessuna attività recente.</li>';
            return;
        }

        const recentEntries = [];
        timesheets.forEach(sheet => {
            sheet.entries.forEach(entry => {
                recentEntries.push({
                    employee: sheet.employeeName,
                    type: entry.type,
                    time: entry.time,
                    date: sheet.date
                });
            });
        });
        
        recentEntries.sort((a,b) => {
            const dateA = new Date(`${a.date.split('T')[0]}T${a.time}`);
            const dateB = new Date(`${b.date.split('T')[0]}T${b.time}`);
            return dateB - dateA;
        });

        recentEntries.slice(0, 5).forEach(entry => {
            const isCheckIn = entry.type === 'check-in';
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between p-2 bg-gray-50 rounded-md';
            li.innerHTML = `
                <div>
                    <p class="font-semibold">${entry.employee}</p>
                    <p class="text-sm text-gray-600">
                        ${isCheckIn ? 'ha effettuato una timbratura di' : 'ha effettuato una timbratura di'} 
                        <span class="font-bold ${isCheckIn ? 'text-green-600' : 'text-red-600'}">${isCheckIn ? 'entrata' : 'uscita'}</span>.
                    </p>
                </div>
                <div class="text-right text-sm text-gray-500">
                    <p>${new Date(entry.date.split('T')[0]).toLocaleDateString('it-IT')}</p>
                    <p>${entry.time}</p>
                </div>
            `;
            list.appendChild(li);
        });
    }

    // --- Notification Logic ---
    function startNotificationPolling() {
        if (notificationPollInterval) clearInterval(notificationPollInterval);
        initializeNotifications();
        notificationPollInterval = setInterval(checkForNewNotifications, 15000);
    }
    
    async function initializeNotifications() {
        try {
            const allTimesheets = await api.get('timesheets');
            const allEntries = [];
            allTimesheets.forEach(sheet => {
                sheet.entries.forEach(entry => {
                    allEntries.push({
                        ...entry,
                        employeeName: sheet.employeeName,
                        date: sheet.date,
                    });
                });
            });
            
            allEntries.sort((a, b) => new Date(`${b.date.split('T')[0]}T${b.time}`) - new Date(`${a.date.split('T')[0]}T${a.time}`));

            notifications = allEntries.slice(0, 10);
            if (notifications.length > 0) {
                lastCheckedEntryId = notifications[0]._id;
            }
            updateNotificationUI(false);
        } catch (error) {
            console.error("Failed to initialize notifications:", error);
        }
    }

    async function checkForNewNotifications() {
        try {
            const allTimesheets = await api.get('timesheets');
            const allEntries = [];
             allTimesheets.forEach(sheet => {
                sheet.entries.forEach(entry => {
                    allEntries.push({
                        ...entry,
                        employeeName: sheet.employeeName,
                        date: sheet.date
                    });
                });
            });

            allEntries.sort((a, b) => new Date(`${b.date.split('T')[0]}T${b.time}`) - new Date(`${a.date.split('T')[0]}T${a.time}`));

            let newNotifications = [];
            if (lastCheckedEntryId) {
                const lastKnownIndex = allEntries.findIndex(e => e._id === lastCheckedEntryId);
                if (lastKnownIndex > 0) {
                    newNotifications = allEntries.slice(0, lastKnownIndex);
                }
            } else if (allEntries.length > 0) {
                newNotifications = allEntries.slice(0, 5);
            }

            if (newNotifications.length > 0) {
                unreadCount += newNotifications.length;
                notifications = [...newNotifications, ...notifications].slice(0, 20);
                lastCheckedEntryId = notifications[0]._id;
                updateNotificationUI(true);
            }
        } catch(error) {
            console.error("Error polling for notifications:", error);
        }
    }

    function updateNotificationUI(isNew) {
        if (unreadCount > 0) {
            notificationBadge.textContent = unreadCount;
            notificationBadge.classList.remove('hidden');
        } else {
            notificationBadge.classList.add('hidden');
        }

        if (notifications.length > 0) {
            notificationList.innerHTML = notifications.map(entry => {
                const isCheckIn = entry.type === 'check-in';
                return `
                <li class="p-3 hover:bg-gray-100 cursor-pointer text-sm">
                    <p class="font-semibold">${entry.employeeName}</p>
                    <p class="text-gray-600">
                        Ha effettuato il <span class="font-bold ${isCheckIn ? 'text-green-600' : 'text-red-600'}">${isCheckIn ? 'check-in' : 'check-out'}</span>.
                    </p>
                    <p class="text-xs text-gray-400 mt-1">
                        ${new Date(`${entry.date.split('T')[0]}T${entry.time}`).toLocaleString('it-IT')}
                    </p>
                </li>
                `;
            }).join('');
        } else {
            notificationList.innerHTML = '<li class="p-4 text-center text-gray-500">Nessuna notifica.</li>';
        }
    }
    
    // --- Employee Logic ---
    const newEmployeeNameInput = document.getElementById('new-employee-name');
    const addEmployeeBtn = document.getElementById('add-employee-btn');
    const employeesTableBody = document.getElementById('employees-table-body');
    
    async function loadEmployeesData() {
        try {
            const employees = await api.get('employees');
            employeesTableBody.innerHTML = '';
            if (employees.length === 0) {
                employeesTableBody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-gray-500 border border-slate-300">Nessun dipendente ancora.</td></tr>';
                return;
            }
            employees.forEach(emp => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="p-3 font-semibold border border-slate-300">${emp.name}</td>
                    <td class="p-3 text-center border border-slate-300">${emp.hasFaceDescriptor ? '<span class="text-green-600 font-bold">Registrata</span>' : '<span class="text-red-600 font-bold">Non Registrata</span>'}</td>
                    <td class="p-3 text-center space-x-2 border border-slate-300">
                        <button class="text-indigo-600 hover:text-indigo-900 register-face-btn" title="Registra impronta facciale" data-id="${emp._id}" data-name="${emp.name}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <button class="text-gray-600 hover:text-gray-900 set-pin-btn" title="Imposta Codice PIN" data-id="${emp._id}" data-name="${emp.name}">
                             <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </button>
                        <button class="text-red-600 hover:text-red-900 delete-employee-btn" title="Elimina Dipendente" data-id="${emp._id}" data-name="${emp.name}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </td>
                `;
                employeesTableBody.appendChild(row);
            });
        } catch(error) {}
    }
    
    async function addEmployee() {
        const name = newEmployeeNameInput.value.trim().toUpperCase();
        if (!name) return showAlert("Il nome del dipendente è obbligatorio.");
        try {
            await api.post('employees', { name });
            showAlert("Dipendente aggiunto con successo", true);
            newEmployeeNameInput.value = '';
            loadEmployeesData();
        } catch(error) {}
    }
    
    async function deleteEmployee(id, name) {
         if(confirm(`Sei sicuro di voler eliminare il dipendente "${name}"? Tutti i suoi record verranno eliminati.`)) {
            try {
                await api.delete(`employees/${id}`);
                showAlert("Dipendente eliminato con successo", true);
                loadEmployeesData();
            } catch(error) {}
         }
    }
    
     employeesTableBody.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        if (button.classList.contains('register-face-btn')) {
            showFaceModal(button.dataset.name, button.dataset.id);
        } else if (button.classList.contains('delete-employee-btn')) {
            deleteEmployee(button.dataset.id, button.dataset.name);
        } else if (button.classList.contains('set-pin-btn')) {
            showPinModal(button.dataset.id, button.dataset.name);
        }
    });

    // --- User Management Logic ---
    const addUserForm = document.getElementById('add-user-form');
    const changePasswordForm = document.getElementById('change-password-form');
    const usersTableBody = document.getElementById('users-table-body');

    async function loadUsersData() {
         try {
            const users = await api.get('users');
            usersTableBody.innerHTML = '';
             if (users.length === 0) {
                 usersTableBody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-gray-500 border border-slate-300">Nessun utente.</td></tr>';
                 return;
            }
            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="p-3 border border-slate-300">${user.name}</td>
                    <td class="p-3 border border-slate-300">${user.email}</td>
                    <td class="p-3 text-center space-x-2 border border-slate-300">
                         <button class="text-blue-600 hover:text-blue-900 edit-user-btn" title="Modifica Utente" data-id="${user._id}" data-name="${user.name}" data-email="${user.email}">
                             <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                         </button>
                        <button class="text-red-600 hover:text-red-900 delete-user-btn" title="Elimina Utente" data-id="${user._id}" data-name="${user.name}">
                             <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                 <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </td>
                `;
                usersTableBody.appendChild(row);
            });
         } catch(error) {}
    }

    async function handleAddUser(e) {
        e.preventDefault();
        const name = document.getElementById('new-user-name').value.trim();
        const email = document.getElementById('new-user-email').value.trim();
        const password = document.getElementById('new-user-password').value;
        
        if (!name || !email || !password) {
            showAlert('Compila tutti i campi: Nome, Email, e Password.');
            return;
        }

        try {
            await api.post('users', { name, email, password, username: email });
            showAlert('Utente aggiunto con successo!', true);
            addUserForm.reset();
            loadUsersData();
        } catch (error) {}
    }

    async function handleChangePassword(e) {
        e.preventDefault();
        const password = document.getElementById('update-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        if (password !== confirmPassword) {
            return showAlert('Le password non corrispondono.');
        }
        try {
            await api.put('users/profile', { password });
            showAlert('Password aggiornata con successo!', true);
            changePasswordForm.reset();
        } catch (error) {}
    }

    function showEditUserModal(user) {
        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('edit-user-name').value = user.name;
        document.getElementById('edit-user-email').value = user.email;
        document.getElementById('edit-user-password').value = '';
        editUserModal.classList.remove('hidden');
        editUserModal.classList.add('flex');
    }

    function hideEditUserModal() {
        editUserModal.classList.add('hidden');
        editUserModal.classList.remove('flex');
    }
    
    async function handleUpdateUser(e) {
        e.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        const name = document.getElementById('edit-user-name').value;
        const password = document.getElementById('edit-user-password').value;
        
        const updateData = { name };
        if (password) {
            updateData.password = password;
        }

        try {
            await api.put(`users/${id}`, updateData);
            showAlert('Dati utente aggiornati con successo!', true);
            hideEditUserModal();
            loadUsersData();
        } catch (error) {}
    }

    async function deleteUser(id, name) {
         if(confirm(`Sei sicuro di voler eliminare l'utente "${name}"?`)) {
            try {
                await api.delete(`users/${id}`);
                showAlert("Utente eliminato con successo", true);
                loadUsersData();
            } catch(error) {}
         }
    }
    
    usersTableBody.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        if (button.classList.contains('delete-user-btn')) {
            deleteUser(button.dataset.id, button.dataset.name);
        } else if (button.classList.contains('edit-user-btn')) {
            showEditUserModal({
                id: button.dataset.id,
                name: button.dataset.name,
                email: button.dataset.email
            });
        }
    });

    // --- Reports Logic ---
    const reportEmployeeSelect = document.getElementById('report-employee-select');
    const reportMonthSelect = document.getElementById('report-month-select');
    const reportYearSelect = document.getElementById('report-year-select');
    const generateReportBtn = document.getElementById('generate-report-btn');
    const reportOutput = document.getElementById('report-output');
    const reportActions = document.getElementById('report-actions');
    const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

    function getAdjustedTime(timeStr, direction) {
        if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return '';
        let [hours, minutes] = timeStr.split(':').map(Number);

        if (direction === 'up') {
            const roundedMinutes = Math.ceil(minutes / 30) * 30;
            if (roundedMinutes === 60) {
                minutes = 0;
                hours = (hours + 1) % 24;
            } else {
                minutes = roundedMinutes;
            }
        } else {
            const roundedMinutes = Math.floor(minutes / 30) * 30;
            minutes = roundedMinutes;
        }
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    async function initReportsView() {
        try {
            const employees = await api.get('employees');
            reportEmployeeSelect.innerHTML = '<option value="">-- Seleziona Dipendente --</option>';
            employees.forEach(emp => {
                reportEmployeeSelect.innerHTML += `<option value="${emp.name}">${emp.name}</option>`;
            });

            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            
            reportMonthSelect.innerHTML = months.map((m, i) => `<option value="${i}" ${i === currentMonth ? 'selected' : ''}>${m}</option>`).join('');
            reportYearSelect.innerHTML = '';
            for (let y = currentYear; y >= currentYear - 5; y--) {
                reportYearSelect.innerHTML += `<option value="${y}">${y}</option>`;
            }
        } catch (error) {}
    }

    async function generateReport() {
        const employeeName = reportEmployeeSelect.value;
        const month = parseInt(reportMonthSelect.value);
        const year = parseInt(reportYearSelect.value);
        if (!employeeName) return showAlert('Seleziona un dipendente.');

        const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
        
        reportOutput.innerHTML = '<div class="loader"></div>';
        reportActions.classList.add('hidden');

        try {
            const [records, holidays, leaveRecords] = await Promise.all([
                api.get(`timesheets?employeeName=${employeeName.toUpperCase()}&startDate=${startDate}&endDate=${endDate}`),
                api.get('holidays'),
                api.get(`leave?employeeName=${employeeName.toUpperCase()}`)
            ]);
            
            activeRecords = records;

            const holidaysMap = new Map(holidays.map(h => [h.date.split('T')[0], h.name]));
            
            const leaveDatesSet = new Set();
            if(leaveRecords) {
                leaveRecords.forEach(leave => {
                    let currentDate = new Date(leave.startDate);
                    const lastDate = new Date(leave.endDate);
                    while (currentDate <= lastDate) {
                        leaveDatesSet.add(currentDate.toISOString().split('T')[0]);
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                });
            }
            
            displayReport(records, employeeName, months[month], year, holidaysMap, leaveDatesSet);
        } catch (error) {
            reportOutput.innerHTML = `<p class="text-center text-red-500">Errore nel caricamento del report: ${error.message}</p>`;
        }
    }

    function displayReport(records, employeeName, monthName, year, holidaysMap, leaveDatesSet) {
        const monthNumber = months.indexOf(monthName);
        const daysInMonth = new Date(year, monthNumber + 1, 0).getDate();
        const italianDays = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];
        const companyLogo = localStorage.getItem('companyLogo');
        const companyName = localStorage.getItem('companyName') || 'Evolution Mec Srls';

        let tableRows = '';
        let totalOrd = 0, totalStraord = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateForDay = new Date(Date.UTC(year, monthNumber, day));
            const dateString = dateForDay.toISOString().split('T')[0];
            const dayName = italianDays[dateForDay.getUTCDay()];
            const formattedDate = `${String(day).padStart(2, '0')}/${String(monthNumber + 1).padStart(2, '0')}`;
            
            const record = records.find(r => r.date.startsWith(dateString));
            const holidayName = holidaysMap.get(dateString);
            const isOnLeave = leaveDatesSet.has(dateString);
            
            const actionsCell = record ? `<td class="p-2 border no-print"><button class="text-blue-600 edit-day-btn" data-timesheet-id="${record._id}">Modifica</button></td>` : `<td class="p-2 border no-print"></td>`;

            let rowHtml = '';
            if (holidayName) {
                const holidayCells = `<td class="p-2 border font-semibold" colspan="11">${holidayName}</td>`;
                rowHtml = `<tr class="bg-blue-50 text-center">
                    <td class="p-2 border">${formattedDate}</td>
                    <td class="p-2 border">${dayName}</td>
                    ${holidayCells}
                    ${actionsCell}
                </tr>`;
            } else if (isOnLeave) {
                const leaveCells = `<td class="p-2 border font-semibold" colspan="11">Permesso / Ferie</td>`;
                rowHtml = `<tr class="bg-green-50 text-center">
                    <td class="p-2 border">${formattedDate}</td>
                    <td class="p-2 border">${dayName}</td>
                    ${leaveCells}
                    ${actionsCell}
                </tr>`;
            } else if (record) {
                totalOrd += record.regularHours || 0;
                totalStraord += record.overtimeHours || 0;
                const checkIns = record.entries.filter(e => e.type === 'check-in');
                const checkOuts = record.entries.filter(e => e.type === 'check-out');

                const adjustedCheckIn1 = getAdjustedTime(checkIns[0]?.time, 'up');
                const adjustedCheckOut1 = getAdjustedTime(checkOuts[0]?.time, 'down');
                const adjustedCheckIn2 = getAdjustedTime(checkIns[1]?.time, 'up');
                const adjustedCheckOut2 = getAdjustedTime(checkOuts[1]?.time, 'down');
                
                const locationsAndActualTimes = record.entries.map(e => {
                    const locationName = e.location?.name || 'N/D';
                    const entryType = e.type === 'check-in' ? 'E' : 'U';
                    return `${locationName} - ${e.time} (${entryType})`;
                }).join('<br>');
                const projectsHtml = [...new Set(record.entries.map(e => e.project).filter(Boolean))].join(', ');
                const descriptionsHtml = [...new Set(record.entries.map(e => e.description).filter(Boolean))].join(', ');

                rowHtml = `<tr class="text-center border-b">
                    <td class="p-2 border">${formattedDate}</td>
                    <td class="p-2 border">${dayName}</td>
                    <td class="p-2 border">${projectsHtml}</td>
                    <td class="p-2 border">${descriptionsHtml}</td>
                    <td class="p-2 border align-top text-left">${locationsAndActualTimes}</td>
                    <td class="p-2 border">${adjustedCheckIn1 || ''}</td>
                    <td class="p-2 border">${adjustedCheckOut1 || ''}</td>
                    <td class="p-2 border">${adjustedCheckIn2 || ''}</td>
                    <td class="p-2 border">${adjustedCheckOut2 || ''}</td>
                    <td class="p-2 border">${(record.regularHours || 0).toFixed(2)}</td>
                    <td class="p-2 border text-red-600">${(record.overtimeHours || 0).toFixed(2)}</td>
                    <td class="p-2 border font-bold">${(record.totalHours || 0).toFixed(2)}</td>
                    ${actionsCell}
                </tr>`;
            } else {
                const emptyCells = '<td class="p-2 border">&nbsp;</td>'.repeat(11);
                rowHtml = `<tr class="bg-gray-50">
                    <td class="p-2 border">${formattedDate}</td>
                    <td class="p-2 border">${dayName}</td>
                    ${emptyCells}
                    ${actionsCell}
                </tr>`;
            }
            tableRows += rowHtml;
        }
        
        reportOutput.innerHTML = `
            <div id="employee-report-to-export" class="bg-white p-6 printable-area">
                <header class="flex justify-between items-start pb-4 border-b mb-6">
                     <div class="w-1/4">
                         ${companyLogo ? `<img src="${companyLogo}" alt="Logo Aziendale" class="h-16">` : ''}
                     </div>
                    <div class="w-1/2 text-center">
                        <h2 class="text-2xl font-bold text-gray-800">${companyName}</h2>
                        <p class="text-gray-500">Riepilogo Ore Lavorative</p>
                    </div>
                    <div class="w-1/4 text-right text-sm">
                        <p><strong>Dipendente:</strong> ${employeeName}</p>
                        <p><strong>Mese:</strong> ${monthName} ${year}</p>
                        <p><strong>Data Stampa:</strong> ${new Date().toLocaleDateString('it-IT')}</p>
                    </div>
                </header>
                <main>
                    <div class="report-table-container">
                        <table class="w-full text-xs" id="employee-report-table">
                            <thead class="bg-gray-100">
                                <tr>
                                    <th class="p-2 border">Data</th><th class="p-2 border">Giorno</th><th class="p-2 border">Commessa</th>
                                    <th class="p-2 border">Descrizione</th><th class="p-2 border">Luogo (GPS) e Orari Effettivi</th>
                                    <th class="p-2 border">Entrata</th><th class="p-2 border">Uscita</th>
                                    <th class="p-2 border">Entrata</th><th class="p-2 border">Uscita</th>
                                    <th class="p-2 border">Ord.</th><th class="p-2 border">Straord.</th><th class="p-2 border">Totale</th>
                                    <th class="p-2 border no-print">Azione</th>
                                </tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                </main>
                <footer class="mt-8 pt-4 border-t text-sm">
                    <div class="flex justify-between items-end">
                        <div class="font-bold">
                            <p>Totale Ore Ordinarie: <span class="text-blue-700">${totalOrd.toFixed(2)}</span></p>
                            <p>Totale Ore Straordinario: <span class="text-red-700">${totalStraord.toFixed(2)}</span></p>
                        </div>
                        <div class="text-center">
                            <p class="mb-12">Firma del Dipendente</p>
                            <p class="border-t pt-2">_________________________</p>
                        </div>
                    </div>
                </footer>
            </div>
        `;
        reportActions.classList.remove('hidden');
    }
    
    function handleExportPNG() {
        const reportElement = document.getElementById('employee-report-to-export');
        const employeeName = reportEmployeeSelect.value;
        if (reportElement) {
            html2canvas(reportElement, {
                scale: 3,
                useCORS: true,
                windowWidth: reportElement.scrollWidth,
                windowHeight: reportElement.scrollHeight,
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `Riepilogo-${employeeName}-${new Date().toISOString().slice(0, 10)}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            });
        }
    }

    function handleExportPDF() {
        const { jsPDF } = window.jspdf;
        const reportElement = document.getElementById('employee-report-table');
        if (!reportElement) return;

        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });
        
        const monthName = reportMonthSelect.options[reportMonthSelect.selectedIndex].text;
        const year = reportYearSelect.value;
        const employeeName = reportEmployeeSelect.value;
        const companyName = localStorage.getItem('companyName') || 'Evolution Mec Srls';


        doc.autoTable({
            html: '#employee-report-table',
            startY: 42,
            theme: 'grid',
            margin: { top: 42, right: 10, bottom: 40, left: 10 },
            headStyles: { fillColor: [230, 230, 230], textColor: [30, 30, 30], fontStyle: 'bold', lineWidth: 0.1, lineColor: [200, 200, 200] },
            styles: { fontSize: 7, cellPadding: 1.5, lineWidth: 0.1, lineColor: [200, 200, 200], valign: 'middle' },
            columnStyles: {
                2: { overflow: 'linebreak' }, 3: { overflow: 'linebreak' }, 4: { overflow: 'linebreak', halign: 'left', cellWidth: 50 },
                10: { fontStyle: 'bold', textColor: [200, 0, 0] }, 11: { fontStyle: 'bold' }
            },
            didDrawPage: (data) => {
                const companyLogo = localStorage.getItem('companyLogo');
                if(companyLogo){
                    try { doc.addImage(companyLogo, 'PNG', 14, 15, 30, 15); } catch(e) { console.error("Error adding logo to PDF:", e); }
                }
                doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(companyName, 148, 20, { align: 'center' });
                doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.text('Riepilogo Ore Lavorative', 148, 28, { align: 'center' });
                doc.setFontSize(10);
                doc.text(`Dipendente: ${employeeName}`, 287, 20, { align: 'right' });
                doc.text(`Mese: ${monthName} ${year}`, 287, 26, { align: 'right' });
                doc.text(`Data Stampa: ${new Date().toLocaleDateString('it-IT')}`, 287, 32, { align: 'right' });
                doc.setLineWidth(0.5); doc.line(10, 38, 287, 38);
            },
             didParseCell: function (data) {
                if (data.cell.section === 'body' && (data.column.index === 4) && data.cell.raw) {
                     data.cell.text = data.cell.raw.innerText.split('\n');
                }
            }
        });

        const finalY = doc.lastAutoTable.finalY > 160 ? 160 : doc.lastAutoTable.finalY;
        const totalsElement = document.querySelector('#employee-report-to-export footer .font-bold');
        const totalOrdText = totalsElement.children[0].textContent;
        const totalStraordText = totalsElement.children[1].textContent;
        
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text(totalOrdText, 14, finalY + 15);
        doc.text(totalStraordText, 14, finalY + 22);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text('Firma del Dipendente', 287, finalY + 20, { align: 'right' });
        doc.setLineWidth(0.2); doc.line(224, finalY + 30, 287, finalY + 30);

        doc.save(`Riepilogo-${employeeName}-${monthName}-${year}.pdf`);
    }

    // --- Holiday and Leave Logic ---
    async function loadHolidaysData() {
        const tbody = document.getElementById('holidays-table-body');
        try {
            const holidays = await api.get('holidays');
            tbody.innerHTML = holidays.map(h => `
                <tr>
                    <td class="p-2 border border-slate-300">${h.name}</td>
                    <td class="p-2 border border-slate-300">${new Date(h.date).toLocaleDateString('it-IT')}</td>
                    <td class="p-2 text-center border border-slate-300"><button class="text-red-500 delete-holiday-btn" data-id="${h._id}">Elimina</button></td>
                </tr>
            `).join('');
        } catch(e) { tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-red-500">Errore nel caricamento.</td></tr>'; }
    }

    async function handleAddHoliday() {
        const name = document.getElementById('holiday-name-input').value.trim();
        const date = document.getElementById('holiday-date-input').value;
        if (!name || !date) return showAlert("Nome e data sono obbligatori.");
        try {
            await api.post('holidays', { name, date });
            showAlert("Festività aggiunta con successo!", true);
            loadHolidaysData();
            document.getElementById('holiday-name-input').value = '';
            document.getElementById('holiday-date-input').value = '';
        } catch(e) {}
    }

    async function handleDeleteHoliday(e) {
        if (!e.target.classList.contains('delete-holiday-btn')) return;
        if (!confirm("Sei sicuro di voler eliminare questa festività?")) return;
        try {
            await api.delete(`holidays/${e.target.dataset.id}`);
            showAlert("Festività eliminata!", true);
            loadHolidaysData();
        } catch(e) {}
    }

    async function populateLeaveEmployeeSelect() {
        const select = document.getElementById('leave-employee-select');
        try {
            const employees = await api.get('employees');
            select.innerHTML = '<option value="">-- Seleziona --</option>' + employees.map(e => `<option value="${e.name}">${e.name}</option>`).join('');
        } catch(e) {}
    }

    async function loadLeaveData() {
         const tbody = document.getElementById('leave-table-body');
         try {
            const leaves = await api.get('leave');
            tbody.innerHTML = leaves.map(l => `
                <tr>
                    <td class="p-2 border border-slate-300">${l.employeeName}</td>
                    <td class="p-2 border border-slate-300">${l.leaveType}</td>
                    <td class="p-2 border border-slate-300">${new Date(l.startDate).toLocaleDateString('it-IT')}</td>
                    <td class="p-2 border border-slate-300">${new Date(l.endDate).toLocaleDateString('it-IT')}</td>
                    <td class="p-2 text-center border border-slate-300"><button class="text-red-500 delete-leave-btn" data-id="${l._id}">Elimina</button></td>
                </tr>
            `).join('');
         } catch(e) {tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-500">Errore nel caricamento.</td></tr>'; }
    }
    
    async function handleAddLeave() {
        const employeeName = document.getElementById('leave-employee-select').value;
        const leaveType = document.getElementById('leave-type-input').value.trim();
        const startDate = document.getElementById('leave-start-date-input').value;
        const endDate = document.getElementById('leave-end-date-input').value;
        if (!employeeName || !leaveType || !startDate || !endDate) return showAlert("Tutti i campi sono obbligatori.");
         try {
            await api.post('leave', { employeeName, leaveType, startDate, endDate });
            showAlert("Permesso/Ferie aggiunto con successo!", true);
            loadLeaveData();
         } catch(e){}
    }

    async function handleDeleteLeave(e) {
        if (!e.target.classList.contains('delete-leave-btn')) return;
        if (!confirm("Sei sicuro di voler eliminare questo record?")) return;
        try {
            await api.delete(`leave/${e.target.dataset.id}`);
            showAlert("Record eliminato!", true);
            loadLeaveData();
        } catch(e) {}
    }
    
    // --- Edit Day Logic ---
    const editDayModal = document.getElementById('edit-day-modal');
    const editEntriesContainer = document.getElementById('edit-entries-container');

    function showEditDayModal(timesheetId) {
        const record = activeRecords.find(r => r._id === timesheetId);
        if (!record) return;
        
        const date = new Date(record.date);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() + userTimezoneOffset);

        document.getElementById('edit-day-modal-title').textContent = `Modifica Orari del Giorno: ${localDate.toLocaleDateString('it-IT')}`;
        
        editEntriesContainer.innerHTML = '';
        if(record.entries.length > 0) {
            record.entries.forEach(entry => addEntryRowToModal(entry));
        } else {
            addEntryRowToModal();
        }
        document.getElementById('save-day-edits-btn').dataset.timesheetId = timesheetId;
        editDayModal.classList.remove('hidden');
        editDayModal.classList.add('flex');
    }

    function addEntryRowToModal(entry = {}) {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'grid grid-cols-5 gap-3 items-center border-b pb-3';
        entryDiv.dataset.entryId = entry._id || `new_${Date.now()}`;
        entryDiv.innerHTML = `
            <select class="p-1 border rounded edit-type"><option value="check-in" ${entry.type === 'check-in' ? 'selected' : ''}>Entrata</option><option value="check-out" ${entry.type === 'check-out' ? 'selected' : ''}>Uscita</option></select>
            <div><input type="time" value="${entry.time || ''}" class="w-full p-1 border rounded edit-time"></div>
            <div><input type="text" value="${entry.project || ''}" class="w-full p-1 border rounded edit-project" placeholder="Progetto"></div>
            <div><input type="text" value="${entry.description || ''}" class="w-full p-1 border rounded edit-description" placeholder="Descrizione"></div>
            <button class="text-red-500 remove-entry-row-btn p-1 rounded hover:bg-red-100">Rimuovi</button>
        `;
        editEntriesContainer.appendChild(entryDiv);
    }

    function hideEditDayModal() { 
        editDayModal.classList.add('hidden');
        editDayModal.classList.remove('flex');
    }

    async function handleSaveDayEdits() {
        const timesheetId = document.getElementById('save-day-edits-btn').dataset.timesheetId;
        const record = activeRecords.find(r => r._id === timesheetId);
        const newEntries = Array.from(editEntriesContainer.children).map(div => {
            const entryId = div.dataset.entryId;
            const originalEntry = record.entries.find(e => e._id === entryId) || {};
            return { 
                _id: entryId.startsWith('new_') ? undefined : entryId, 
                type: div.querySelector('.edit-type').value, 
                time: div.querySelector('.edit-time').value, 
                project: div.querySelector('.edit-project').value, 
                description: div.querySelector('.edit-description').value, 
                location: originalEntry.location || {name: "Modifica Manuale"} 
            };
        }).filter(e => e.time);
        try {
            await api.put(`timesheets/${timesheetId}`, { entries: newEntries });
            showAlert('Modifiche salvate con successo!', true);
            hideEditDayModal();
            generateReport();
        } catch (error) { showAlert('Salvataggio fallito: ' + error.message); }
    }

    // --- Client/Project Logic ---
    async function loadClientsAndProjectsData() { 
        try {
            const [clients, projects] = await Promise.all([api.get('clients'), api.get('projects')]);
            
            const clientsTableBody = document.getElementById('clients-table-body');
            clientsTableBody.innerHTML = '';
            if (clients.length > 0) {
                clients.forEach(c => {
                    clientsTableBody.innerHTML += `<tr><td class="p-2 border border-slate-300">${c.name}</td><td class="p-2 border border-slate-300">${c.email || ''}</td><td class="p-2 border border-slate-300"><button class="text-red-500 delete-client-btn" data-id="${c._id}" data-name="${c.name}">Elimina</button></td></tr>`;
                });
            } else {
                clientsTableBody.innerHTML = `<tr><td colspan="3" class="text-center p-4 border border-slate-300">Nessun cliente</td></tr>`;
            }

            const projectsTableBody = document.getElementById('projects-table-body');
            projectsTableBody.innerHTML = '';
            if (projects.length > 0) {
                projects.forEach(p => {
                     projectsTableBody.innerHTML += `<tr><td class="p-2 border border-slate-300">${p.name}</td><td class="p-2 border border-slate-300">${p.clientName}</td><td class="p-2 border border-slate-300"><button class="text-red-500 delete-project-btn" data-id="${p._id}" data-name="${p.name}">Elimina</button></td></tr>`;
                });
            } else {
                projectsTableBody.innerHTML = `<tr><td colspan="3" class="text-center p-4 border border-slate-300">Nessun progetto</td></tr>`;
            }

            const projectClientSelect = document.getElementById('project-client-select');
            projectClientSelect.innerHTML = '<option value="">-- Seleziona Cliente --</option>';
            clients.forEach(c => {
                 projectClientSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
            });
        } catch(e){}
     }
     
    function loadSettingsData(){
        const logoPreview = document.getElementById('logo-preview');
        const companyNameInput = document.getElementById('company-name-input');
        const companyLogo = localStorage.getItem('companyLogo');
        const companyName = localStorage.getItem('companyName');

        if(companyLogo){
            logoPreview.src = companyLogo;
        } else {
            logoPreview.src = "";
        }
        if(companyName) {
            companyNameInput.value = companyName;
        }
        // Aggiunta: Carica il Kiosk ID
        const currentKioskId = localStorage.getItem('kioskId');
        if (kioskIdInput && currentKioskId) {
            kioskIdInput.value = currentKioskId;
        }
    }
     
    document.getElementById('logo-upload-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(file){
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('logo-preview').src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('save-settings-btn').addEventListener('click', () => {
        const logoSrc = document.getElementById('logo-preview').src;
        const companyName = document.getElementById('company-name-input').value.trim();

        if (companyName) {
            localStorage.setItem('companyName', companyName);
        } else {
            localStorage.removeItem('companyName');
        }

        if(logoSrc && !logoSrc.endsWith('#') && logoSrc.startsWith('data:image')){
            localStorage.setItem('companyLogo', logoSrc);
        }
        showAlert('Impostazioni salvate con successo!', true);
    });

    document.getElementById('remove-logo-btn').addEventListener('click', () => {
        localStorage.removeItem('companyLogo');
        document.getElementById('logo-preview').src = "";
        showAlert('Logo rimosso.', true);
    });

    // --- QR Code Logic ---
    async function handleUpdateAndGenerateQr() {
        const newKioskId = kioskIdInput.value.trim();
        if (!newKioskId) {
            return showAlert('Il Kiosk ID non può essere vuoto.');
        }

        localStorage.setItem('kioskId', newKioskId);
        showAlert('Kiosk ID aggiornato con successo!', true);

        kioskQrCodeContainer.innerHTML = '';
        kioskQrCodeContainer.classList.remove('text-gray-400')
        new QRCode(kioskQrCodeContainer, {
            text: newKioskId,
            width: 256,
            height: 256,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });

        setTimeout(() => {
            downloadQrBtn.classList.remove('hidden');
        }, 300);
    }

    function handleDownloadQrCode() {
        const qrImg = kioskQrCodeContainer.querySelector('img');
        if (!qrImg) {
            return showAlert('Nessun QR code generato da scaricare.');
        }
        const link = document.createElement('a');
        link.download = `kiosk-ID-${kioskIdInput.value.trim()}.png`;
        link.href = qrImg.src;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- Initial Load ---
    function startup() {
        logoutBtn.addEventListener('click', handleLogout);
        sidebarLinks.forEach(link => link.addEventListener('click', (e) => handleNavigation(e)));
        addEmployeeBtn.addEventListener('click', addEmployee);
        cancelFaceBtn.addEventListener('click', hideFaceModal);
        actionFaceBtn.addEventListener('click', handleFaceRegistration);
        addUserForm.addEventListener('submit', handleAddUser);
        changePasswordForm.addEventListener('submit', handleChangePassword);
        generateReportBtn.addEventListener('click', generateReport);
        savePinBtn.addEventListener('click', handleSetPin);
        cancelPinBtn.addEventListener('click', hidePinModal);
        editUserForm.addEventListener('submit', handleUpdateUser);
        cancelEditUserBtn.addEventListener('click', hideEditUserModal);
        saveKioskIdBtn.addEventListener('click', handleUpdateAndGenerateQr);
        downloadQrBtn.addEventListener('click', handleDownloadQrCode);

        notificationBellBtn.addEventListener('click', () => {
            notificationPanel.classList.toggle('hidden');
            if(!notificationPanel.classList.contains('hidden')) {
                unreadCount = 0;
                updateNotificationUI(false);
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!notificationBellBtn.contains(e.target) && !notificationPanel.contains(e.target)) {
                notificationPanel.classList.add('hidden');
            }
        });

        document.getElementById('print-report-btn').addEventListener('click', () => window.print());
        document.getElementById('export-png-btn').addEventListener('click', handleExportPNG);
        document.getElementById('export-pdf-btn').addEventListener('click', handleExportPDF);
        
        document.getElementById('clients-table-body').addEventListener('click', async e => {
         if(e.target.classList.contains('delete-client-btn')){
             const {id, name} = e.target.dataset;
             if(confirm(`Sei sicuro di eliminare il cliente "${name}" e tutti i suoi progetti?`)){
                 await api.delete(`clients/${id}`);
                 loadClientsAndProjectsData();
             }
         }
        });
        document.getElementById('projects-table-body').addEventListener('click', async e => {
         if(e.target.classList.contains('delete-project-btn')){
             const {id, name} = e.target.dataset;
             if(confirm(`Sei sicuro di eliminare il progetto "${name}"?`)){
                 await api.delete(`projects/${id}`);
                 loadClientsAndProjectsData();
             }
         }
        });

        document.getElementById('add-client-btn').addEventListener('click', async () => {
            const name = document.getElementById('client-name-input').value;
            const email = document.getElementById('client-email-input').value;
            if(!name) return showAlert('Il nome del cliente è obbligatorio.');
            await api.post('clients', {name, email});
            loadClientsAndProjectsData();
            document.getElementById('client-name-input').value = '';
            document.getElementById('client-email-input').value = '';
        });

         document.getElementById('add-project-btn').addEventListener('click', async () => {
            const name = document.getElementById('project-name-input').value;
            const clientName = document.getElementById('project-client-select').value;
            const rate = document.getElementById('project-rate-input').value;
            if(!name || !clientName || !rate) return showAlert('Tutti i campi del progetto sono obbligatori.');
            await api.post('projects', {name, clientName, rate});
            loadClientsAndProjectsData();
             document.getElementById('project-name-input').value = '';
             document.getElementById('project-client-select').value = '';
             document.getElementById('project-rate-input').value = '';
        });

        // Edit Modal Listeners
        reportOutput.addEventListener('click', (e) => {
            const button = e.target.closest('.edit-day-btn');
            if (button) {
                showEditDayModal(button.dataset.timesheetId);
            }
        });
        document.getElementById('cancel-edit-day-btn').addEventListener('click', hideEditDayModal);
        document.getElementById('save-day-edits-btn').addEventListener('click', handleSaveDayEdits);
        document.getElementById('add-entry-row-btn').addEventListener('click', () => addEntryRowToModal());
        editEntriesContainer.addEventListener('click', e => {
            if (e.target.classList.contains('remove-entry-row-btn')) {
                e.target.parentElement.remove();
            }
        });

        // Holiday/Leave Listeners
        document.getElementById('add-holiday-btn').addEventListener('click', handleAddHoliday);
        document.getElementById('holidays-table-body').addEventListener('click', handleDeleteHoliday);
        document.getElementById('add-leave-btn').addEventListener('click', handleAddLeave);
        document.getElementById('leave-table-body').addEventListener('click', handleDeleteLeave);

        verifyTokenAndStartup();
    }

    startup();
});

