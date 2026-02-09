const form = document.getElementById('applicant-form');
const applicants = [];
const tableBody = document.querySelector('#applicant-table tbody');
const runButton = document.getElementById('run-allocation');
const resultContainer = document.getElementById('result');
const uploadInput = document.getElementById('json-upload');
const roomsUploadInput = document.getElementById('rooms-upload');
const roomsHint = document.getElementById('rooms-hint');
const availableRooms = [];
const rawApiBase = window.API_BASE || '';
const apiBase = rawApiBase.replace(/\/$/, '');
const apiUrl = apiBase ? `${apiBase}/api/assign` : '/api/assign';

const renderApplicants = () => {
  tableBody.innerHTML = '';
  for (const applicant of applicants) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${applicant.name}</td>
      <td>${applicant.currentRoom}</td>
      <td>${applicant.currentRoomType}</td>
      <td>${applicant.seniority}</td>
      <td>${applicant.preferences.join(', ')}</td>
    `;
    tableBody.appendChild(row);
  }
  runButton.disabled = applicants.length === 0;
};

const renderAvailableRooms = () => {
  if (availableRooms.length === 0) {
    roomsHint.textContent = 'Ledige rom: ingen lastet inn.';
    return;
  }
  roomsHint.textContent = `Ledige rom: ${availableRooms.join(', ')}`;
};

const parsePreferences = (rawValue) => {
  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, 8);
};

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = document.getElementById('name').value.trim();
  const currentRoom = document.getElementById('current-room-number').value.trim();
  const currentRoomType = document.getElementById('current-room').value;
  const seniority = Number(document.getElementById('seniority').value);
  const preferences = parsePreferences(document.getElementById('preferences').value);

  if (!name || !currentRoom || !currentRoomType || Number.isNaN(seniority) || preferences.length === 0) {
    alert('Fyll ut alle felter og minst ett \u00f8nsket rom.');
    return;
  }

  applicants.push({ name, currentRoom, currentRoomType, seniority, preferences });
  form.reset();
  renderApplicants();
});

const normalizeApplicant = (item) => {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const name = String(item.name || '').trim();
  const currentRoom = String(item.currentRoom || '').trim();
  const currentRoomType = String(item.currentRoomType || '').trim();
  const seniority = Number(item.seniority);
  const preferences = Array.isArray(item.preferences) ? item.preferences : [];
  const cleanedPreferences = preferences
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)
    .slice(0, 8);

  if (!name || !currentRoom || !currentRoomType || Number.isNaN(seniority) || cleanedPreferences.length === 0) {
    return null;
  }

  return {
    name,
    currentRoom,
    currentRoomType,
    seniority,
    preferences: cleanedPreferences,
  };
};

uploadInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new Error('JSON must be an array');
    }

    const parsed = data.map(normalizeApplicant).filter((item) => item !== null);
    if (parsed.length === 0) {
      alert('Ingen gyldige s\u00f8kere funnet i JSON.');
      uploadInput.value = '';
      return;
    }

    applicants.length = 0;
    applicants.push(...parsed);
    renderApplicants();
    uploadInput.value = '';
  } catch (error) {
    alert('Kunne ikke lese JSON-filen.');
    uploadInput.value = '';
  }
});

const normalizeRooms = (data) => {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);
};

roomsUploadInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const parsedRooms = normalizeRooms(data);
    if (parsedRooms.length === 0) {
      alert('Ingen gyldige ledige rom funnet i JSON.');
      roomsUploadInput.value = '';
      return;
    }

    availableRooms.length = 0;
    availableRooms.push(...parsedRooms);
    renderAvailableRooms();
    roomsUploadInput.value = '';
  } catch (error) {
    alert('Kunne ikke lese JSON-filen for ledige rom.');
    roomsUploadInput.value = '';
  }
});

runButton.addEventListener('click', async () => {
  resultContainer.innerHTML = '';

  if (availableRooms.length === 0) {
    alert('Last opp minst ett ledig rom.');
    return;
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicants, availableRooms }),
    });

    if (!response.ok) {
      throw new Error('Serverfeil');
    }

    const data = await response.json();
    const assignmentList = document.createElement('div');
    assignmentList.className = 'result-list';

    const assignments = data.assignments || [];
    const unassigned = data.unassigned || [];

    for (const assignment of assignments) {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.textContent = `${assignment.name} -> ${assignment.assignedRoom} (${assignment.note})`;
      assignmentList.appendChild(item);
    }

    for (const missing of unassigned) {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.textContent = `${missing.name} -> ikke tildelt (${missing.note})`;
      assignmentList.appendChild(item);
    }

    if (assignments.length === 0 && unassigned.length === 0) {
      assignmentList.textContent = 'Ingen data.';
    }

    resultContainer.appendChild(assignmentList);
  } catch (error) {
    resultContainer.textContent = 'Kunne ikke hente fordeling fra serveren.';
  }
});

renderApplicants();
renderAvailableRooms();



