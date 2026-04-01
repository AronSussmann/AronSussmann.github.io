const form = document.getElementById('applicant-form');
const applicants = [];
const tableBody = document.querySelector('#applicant-table tbody');
const runButton = document.getElementById('run-allocation');
const resultContainer = document.getElementById('result');
const uploadInput = document.getElementById('json-upload');
const roomsUploadInput = document.getElementById('rooms-upload');
const roomsHint = document.getElementById('rooms-hint');
const appStatus = document.getElementById('app-status');
const roomsList = document.getElementById('rooms-list');
const roomInput = document.getElementById('room-input');
const roomAddButton = document.getElementById('room-add');
const roomsManualInput = document.getElementById('rooms-manual');
const roomsApplyButton = document.getElementById('rooms-apply');
const roomsClearButton = document.getElementById('rooms-clear');
const availableRooms = [];
const rawApiBase = window.API_BASE || '';
const apiBase = rawApiBase.replace(/\/$/, '');
const apiUrl = apiBase ? `${apiBase}/api/assign` : '/api/assign';

if (appStatus) {
  appStatus.textContent = 'Status: script lastet.';
}

window.addEventListener('error', (event) => {
  if (appStatus) {
    appStatus.textContent = `Status: JS-feil - ${event.message}`;
  }
});

const parsePreferenceList = (values) => {
  const cleaned = [];
  const seen = new Set();
  for (const rawValue of values) {
    const value = String(rawValue).trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    cleaned.push(value);
    if (cleaned.length >= 8) {
      break;
    }
  }
  return cleaned;
};

const normalizeRoom = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase();
};

const parseRoomList = (rawValue) => {
  return rawValue
    .split(/[\n,;]+/)
    .map(normalizeRoom)
    .filter((value) => value.length > 0);
};

const appendCell = (row, value) => {
  const cell = document.createElement('td');
  cell.textContent = value;
  row.appendChild(cell);
};

const renderApplicants = () => {
  if (!tableBody) {
    return;
  }
  tableBody.innerHTML = '';
  for (const applicant of applicants) {
    const row = document.createElement('tr');
    appendCell(row, applicant.name);
    appendCell(row, applicant.currentRoom);
    appendCell(row, applicant.currentRoomType);
    appendCell(row, String(applicant.seniority));
    appendCell(row, applicant.preferences.join(', '));
    tableBody.appendChild(row);
  }
  if (runButton) {
    runButton.disabled = applicants.length === 0;
  }
};

const addRooms = (roomValues, replace = false) => {
  const normalized = roomValues
    .map(normalizeRoom)
    .filter((value) => value.length > 0);

  if (normalized.length === 0) {
    return false;
  }

  const next = replace ? [] : [...availableRooms];
  const seen = new Set(next);
  for (const room of normalized) {
    if (!seen.has(room)) {
      next.push(room);
      seen.add(room);
    }
  }

  availableRooms.length = 0;
  availableRooms.push(...next);
  renderAvailableRooms();
  return true;
};

const removeRoom = (room) => {
  const index = availableRooms.indexOf(room);
  if (index < 0) {
    return;
  }
  availableRooms.splice(index, 1);
  renderAvailableRooms();
};

const renderAvailableRooms = () => {
  if (roomsList) {
    roomsList.innerHTML = '';
  }
  if (availableRooms.length === 0) {
    if (roomsHint) {
      roomsHint.textContent = 'Ledige rom: ingen registrert.';
    }
    return;
  }
  if (roomsHint) {
    roomsHint.textContent = `Ledige rom (${availableRooms.length}): ${availableRooms.join(', ')}`;
  }
  if (!roomsList) {
    return;
  }
  for (const room of availableRooms) {
    const pill = document.createElement('div');
    pill.className = 'room-pill';

    const roomLabel = document.createElement('span');
    roomLabel.textContent = room;
    pill.appendChild(roomLabel);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Slett';
    deleteButton.setAttribute('data-remove-room', room);
    pill.appendChild(deleteButton);

    roomsList.appendChild(pill);
  }
};

const parsePreferences = (rawValue) => {
  return parsePreferenceList(rawValue.split(','));
};

if (form) {
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
}

const normalizeApplicant = (item) => {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const name = String(item.name || '').trim();
  const currentRoom = String(item.currentRoom || '').trim();
  const currentRoomType = String(item.currentRoomType || '').trim();
  const seniority = Number(item.seniority);
  const preferences = Array.isArray(item.preferences) ? item.preferences : [];
  const cleanedPreferences = parsePreferenceList(preferences);

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

if (uploadInput) {
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
}

const normalizeRooms = (data) => {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map(normalizeRoom)
    .filter((value) => value.length > 0);
};

if (roomsList) {
  roomsList.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || typeof target.getAttribute !== 'function') {
      return;
    }
    const roomToRemove = target.getAttribute('data-remove-room');
    if (!roomToRemove) {
      return;
    }
    removeRoom(roomToRemove);
  });
}

if (roomAddButton && roomInput) {
  roomAddButton.addEventListener('click', () => {
    const value = normalizeRoom(roomInput.value);
    if (!value) {
      alert('Skriv inn et romnummer f\u00f8r du legger til.');
      return;
    }
    addRooms([value], false);
    roomInput.value = '';
    roomInput.focus();
  });
}

if (roomsApplyButton && roomsManualInput) {
  roomsApplyButton.addEventListener('click', () => {
    const parsedRooms = parseRoomList(roomsManualInput.value || '');
    if (parsedRooms.length === 0) {
      alert('Legg inn minst ett gyldig rom.');
      return;
    }
    addRooms(parsedRooms, false);
    roomsManualInput.value = '';
  });
}

if (roomsClearButton) {
  roomsClearButton.addEventListener('click', () => {
    availableRooms.length = 0;
    if (roomsManualInput) {
      roomsManualInput.value = '';
    }
    if (roomInput) {
      roomInput.value = '';
    }
    renderAvailableRooms();
  });
}

if (roomsUploadInput) {
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

      addRooms(parsedRooms, true);
      roomsUploadInput.value = '';
    } catch (error) {
      alert('Kunne ikke lese JSON-filen for ledige rom.');
      roomsUploadInput.value = '';
    }
  });
}

if (runButton) {
  runButton.addEventListener('click', async () => {
    if (resultContainer) {
      resultContainer.innerHTML = '';
    }

    if (availableRooms.length === 0) {
      alert('Legg til minst ett ledig rom f\u00f8r fordeling.');
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

      if (resultContainer) {
        resultContainer.appendChild(assignmentList);
      }
    } catch (error) {
      if (resultContainer) {
        resultContainer.textContent = 'Kunne ikke hente fordeling fra serveren.';
      }
    }
  });
}

renderApplicants();
renderAvailableRooms();
