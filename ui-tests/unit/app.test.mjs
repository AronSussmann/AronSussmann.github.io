import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

const appScript = readFileSync(
  resolve(process.cwd(), 'src/main/resources/static/app.js'),
  'utf8'
);

const baseHtml = `
<!doctype html>
<html lang="no">
  <body>
    <form id="applicant-form">
      <input id="name" />
      <input id="current-room-number" />
      <select id="current-room">
        <option value="">Velg</option>
        <option value="Enkeltrom">Enkeltrom</option>
      </select>
      <input id="seniority" />
      <input id="preferences" />
      <button type="submit" id="submit-applicant">Legg til</button>
    </form>

    <table id="applicant-table"><tbody></tbody></table>
    <button id="run-allocation" type="button">Fordel</button>
    <div id="result"></div>

    <input id="json-upload" type="file" />
    <input id="rooms-upload" type="file" />
    <div id="rooms-hint">Ledige rom: ingen lastet inn.</div>
    <div id="app-status">Status: venter på script.</div>
    <div id="rooms-list"></div>
    <input id="room-input" />
    <button id="room-add" type="button">Legg til</button>
    <input id="rooms-manual" />
    <button id="rooms-apply" type="button">Legg til flere</button>
    <button id="rooms-clear" type="button">Tøm</button>
  </body>
</html>
`;

const setupApp = () => {
  const dom = new JSDOM(baseHtml, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const { document } = window;

  window.API_BASE = '';
  window.alert = vi.fn();
  window.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      assignments: [{ name: 'Aron', assignedRoom: '102', note: 'Test' }],
      unassigned: []
    })
  });

  window.eval(appScript);
  return { window, document };
};

const click = (window, element) => {
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
};

const submitApplicant = (window, document, name = 'Aron') => {
  document.getElementById('name').value = name;
  document.getElementById('current-room-number').value = '901';
  document.getElementById('current-room').value = 'Enkeltrom';
  document.getElementById('seniority').value = '4';
  document.getElementById('preferences').value = '102';
  document
    .getElementById('applicant-form')
    .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
};

describe('room editor feature', () => {
  it('marks app status as script loaded on startup', () => {
    const { document } = setupApp();

    expect(document.getElementById('app-status').textContent).toContain('script lastet');
  });

  it('adds a single room and renders a removable room pill', () => {
    const { window, document } = setupApp();

    document.getElementById('room-input').value = '102';
    click(window, document.getElementById('room-add'));

    expect(document.getElementById('rooms-hint').textContent).toContain('102');
    expect(document.querySelectorAll('#rooms-list .room-pill').length).toBe(1);
    expect(document.querySelector('#rooms-list [data-remove-room="102"]')).not.toBeNull();
  });

  it('adds multiple rooms, normalizes, and deduplicates', () => {
    const { window, document } = setupApp();

    document.getElementById('rooms-manual').value = '301, a12, 301, A12';
    click(window, document.getElementById('rooms-apply'));

    const pillLabels = [...document.querySelectorAll('#rooms-list .room-pill span')].map(
      (node) => node.textContent
    );
    expect(pillLabels).toEqual(['301', 'A12']);
    expect(document.getElementById('rooms-hint').textContent).toContain('Ledige rom (2)');
  });

  it('removes a room via the Slett button', () => {
    const { window, document } = setupApp();

    document.getElementById('room-input').value = '102';
    click(window, document.getElementById('room-add'));
    click(window, document.querySelector('#rooms-list [data-remove-room="102"]'));

    expect(document.querySelectorAll('#rooms-list .room-pill').length).toBe(0);
    expect(document.getElementById('rooms-hint').textContent).toContain('ingen registrert');
  });

  it('clears all rooms using the clear button', () => {
    const { window, document } = setupApp();

    document.getElementById('rooms-manual').value = '201,202';
    click(window, document.getElementById('rooms-apply'));
    click(window, document.getElementById('rooms-clear'));

    expect(document.querySelectorAll('#rooms-list .room-pill').length).toBe(0);
    expect(document.getElementById('rooms-hint').textContent).toContain('ingen registrert');
  });

  it('alerts when trying allocation without any available rooms', () => {
    const { window, document } = setupApp();

    submitApplicant(window, document);
    click(window, document.getElementById('run-allocation'));

    expect(window.alert).toHaveBeenCalledWith('Legg til minst ett ledig rom før fordeling.');
  });

  it('sends allocation request and renders result when applicant and room exist', async () => {
    const { window, document } = setupApp();

    submitApplicant(window, document);
    document.getElementById('room-input').value = '102';
    click(window, document.getElementById('room-add'));

    click(window, document.getElementById('run-allocation'));
    for (let attempt = 0; attempt < 5; attempt++) {
      if (document.getElementById('result').textContent) {
        break;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    expect(window.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = window.fetch.mock.calls[0];
    expect(url).toBe('/api/assign');
    expect(options.method).toBe('POST');

    const parsedBody = JSON.parse(options.body);
    expect(parsedBody.availableRooms).toEqual(['102']);
    expect(parsedBody.applicants).toHaveLength(1);
    expect(document.getElementById('result').textContent).toContain('Aron -> 102');
  });

  it('alerts when manual list has no valid rooms', () => {
    const { window, document } = setupApp();

    document.getElementById('rooms-manual').value = ' , ; \n ';
    click(window, document.getElementById('rooms-apply'));

    expect(window.alert).toHaveBeenCalledWith('Legg inn minst ett gyldig rom.');
  });
});
