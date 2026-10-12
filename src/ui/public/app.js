/**
 * GateStory Dashboard Frontend Application
 */

async function init() {
  await Promise.all([
    loadFixtures(),
    loadVisits(),
    loadHeatmap(),
    loadPollerStatus(),
  ]);

  setupEventListeners();
}

// 1. Load 12 Fixture Scenarios
async function loadFixtures() {
  const container = document.getElementById('fixtures-container');
  try {
    const res = await fetch('/api/fixtures');
    const data = await res.json();

    container.innerHTML = '';
    data.scenarios.forEach((s) => {
      const btn = document.createElement('button');
      btn.className = 'fixture-btn';
      btn.innerHTML = `
        <div class="fixture-name">${s.index}. ${s.name}</div>
        <div class="fixture-meta">${s.eventCount} events · ${s.expectedOutcome}</div>
      `;
      btn.addEventListener('click', () => replayScenario(s.id));
      container.appendChild(btn);
    });
  } catch (err) {
    container.innerHTML = `<div style="color: red; font-size: 12px;">Failed to load fixtures: ${err.message}</div>`;
  }
}

// 2. Replay Fixture Scenario
async function replayScenario(scenarioId) {
  try {
    const res = await fetch(`/api/fixtures/replay/${encodeURIComponent(scenarioId)}`, {
      method: 'POST',
    });
    const result = await res.json();
    if (result.success) {
      await Promise.all([loadVisits(), loadHeatmap()]);
    }
  } catch (err) {
    alert(`Replay failed: ${err.message}`);
  }
}

// 3. Load Visits and Storyline
async function loadVisits() {
  const listContainer = document.getElementById('visits-list');
  const countTag = document.getElementById('visit-count-tag');

  try {
    const res = await fetch('/api/visits');
    const data = await res.json();

    countTag.textContent = `${data.count} visit${data.count === 1 ? '' : 's'} recorded`;

    if (!data.visits || data.visits.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--ink-muted);">
          No visits recorded. Select a test scenario above or poll the Ring API.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';
    data.visits.forEach((v) => {
      const card = document.createElement('article');
      card.className = 'visit-card';

      const timeStr = new Date(v.startTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const durationSec = Math.round(v.durationMs / 1000);

      // Camera chain hops
      const hopsHtml = v.cameraChain
        .map(
          (h) => `
          <span class="chain-hop">
            <span class="hop-dot"></span>
            ${h.zone.toUpperCase()}
          </span>
        `
        )
        .join('<span class="chain-arrow">➔</span>');

      const gateDwell = Math.round((v.dwellTimeByZone.gate || 0) / 1000);
      const walkDwell = Math.round((v.dwellTimeByZone.walkway || 0) / 1000);
      const doorDwell = Math.round((v.dwellTimeByZone.door || 0) / 1000);

      card.innerHTML = `
        <div class="visit-top">
          <div class="visit-time">${timeStr} · Duration: ${durationSec}s</div>
          <div>
            <span class="badge badge-${v.state.toLowerCase()}">${v.state}</span>
            <span class="badge badge-${v.outcome.toLowerCase()}" style="margin-left: 4px;">${v.outcome.replace(/_/g, ' ')}</span>
          </div>
        </div>

        <div class="camera-chain">
          ${hopsHtml}
        </div>

        <div class="visit-story">
          ${v.story}
        </div>

        <div class="visit-stats">
          <div class="dwell-bars">
            <span class="dwell-item">🚪 Gate: <strong>${gateDwell}s</strong></span>
            <span class="dwell-item">🚶 Walkway: <strong>${walkDwell}s</strong></span>
            <span class="dwell-item">🏡 Door: <strong>${doorDwell}s</strong></span>
          </div>
          <div>
            <button class="btn btn-sm btn-snapshot" data-visit-id="${v.id}" data-zone="door">
              📷 Camera HUD
            </button>
          </div>
        </div>
      `;

      listContainer.appendChild(card);
    });

    // Attach snapshot listeners
    document.querySelectorAll('.btn-snapshot').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const visitId = e.currentTarget.getAttribute('data-visit-id');
        const zone = e.currentTarget.getAttribute('data-zone') || 'door';
        openSnapshotModal(visitId, zone);
      });
    });
  } catch (err) {
    listContainer.innerHTML = `<div style="color: red;">Failed to load visits: ${err.message}</div>`;
  }
}

// 4. Load Heatmap Metrics
async function loadHeatmap() {
  try {
    const res = await fetch('/api/heatmap');
    const data = await res.json();

    const maxDwell = Math.max(
      data.avgDwellSec.gate,
      data.avgDwellSec.walkway,
      data.avgDwellSec.door,
      10
    );

    document.getElementById('heat-gate-val').textContent = `${data.avgDwellSec.gate}s`;
    document.getElementById('heat-gate-bar').style.width = `${Math.min(100, Math.round((data.avgDwellSec.gate / maxDwell) * 100))}%`;

    document.getElementById('heat-walk-val').textContent = `${data.avgDwellSec.walkway}s`;
    document.getElementById('heat-walk-bar').style.width = `${Math.min(100, Math.round((data.avgDwellSec.walkway / maxDwell) * 100))}%`;

    document.getElementById('heat-door-val').textContent = `${data.avgDwellSec.door}s`;
    document.getElementById('heat-door-bar').style.width = `${Math.min(100, Math.round((data.avgDwellSec.door / maxDwell) * 100))}%`;
  } catch (err) {
    console.error('Heatmap load failed:', err);
  }
}

// 5. Load Poller Status
async function loadPollerStatus() {
  try {
    const res = await fetch('/api/ring/status');
    const status = await res.json();
    if (status.deviceId) {
      const shortDev = status.deviceId.length > 25 ? `${status.deviceId.slice(0, 18)}...` : status.deviceId;
      document.getElementById('proof-log-line').textContent =
        `[ring] GET /v1/history/devices/${shortDev}/events ${status.lastHttpStatus || 200} (${status.lastEventCount} events) · api.amazonvision.com`;
    }
  } catch (err) {
    console.error('Poller status load failed:', err);
  }
}

// 6. Setup Event Listeners
function setupEventListeners() {
  // Poll Ring API button
  document.getElementById('btn-poll-now').addEventListener('click', async () => {
    const btn = document.getElementById('btn-poll-now');
    btn.disabled = true;
    btn.textContent = 'Polling...';
    try {
      const res = await fetch('/api/ring/poll', { method: 'POST' });
      const data = await res.json();
      await Promise.all([loadVisits(), loadHeatmap(), loadPollerStatus()]);
      alert(`Polled Ring API! Found ${data.polledCount || 0} events.`);
    } catch (err) {
      alert(`Poll failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔄 Poll Ring API';
    }
  });

  // Replay Fixture 1
  document.getElementById('btn-replay-fixture-1').addEventListener('click', () => {
    replayScenario('01-normal-delivery');
  });

  // Reset Engine Log
  document.getElementById('btn-reset-engine').addEventListener('click', async () => {
    await fetch('/api/fixtures/reset', { method: 'POST' });
    await Promise.all([loadVisits(), loadHeatmap()]);
  });

  // Snapshot modal close
  document.getElementById('modal-close-btn').addEventListener('click', () => {
    document.getElementById('modal-snapshot').classList.remove('active');
  });

  document.getElementById('modal-snapshot').addEventListener('click', (e) => {
    if (e.target.id === 'modal-snapshot') {
      document.getElementById('modal-snapshot').classList.remove('active');
    }
  });

  // MCP quick buttons
  document.getElementById('btn-mcp-timeline').addEventListener('click', async () => {
    const res = await fetch('/api/visits');
    const data = await res.json();
    if (data.visits && data.visits.length > 0) {
      const timelineRes = await fetch(`/api/visits/${data.visits[0].id}/timeline`);
      const timelineData = await timelineRes.json();
      alert(`MCP get_visit_timeline result:\n${JSON.stringify(timelineData, null, 2)}`);
    } else {
      alert('Replay a visit first to test MCP timeline.');
    }
  });

  document.getElementById('btn-mcp-story').addEventListener('click', async () => {
    const res = await fetch('/api/visits');
    const data = await res.json();
    if (data.visits && data.visits.length > 0) {
      alert(`MCP get_visit_story result:\n"${data.visits[0].story}"`);
    } else {
      alert('Replay a visit first to test MCP storyline.');
    }
  });

  document.getElementById('btn-mcp-search').addEventListener('click', async () => {
    const res = await fetch('/api/visits?outcome=reached_door_completed');
    const data = await res.json();
    alert(`MCP search_visitors (outcome=reached_door_completed):\n${data.count} matching visits found.`);
  });

  document.getElementById('btn-mcp-rule').addEventListener('click', async () => {
    const res = await fetch('/api/rules');
    const data = await res.json();
    alert(`MCP create_gate_rule / list_rules:\n${JSON.stringify(data.rules, null, 2)}`);
  });

  document.getElementById('btn-mcp-logs').addEventListener('click', async () => {
    const res = await fetch('/api/access-log?limit=5');
    const data = await res.json();
    alert(`MCP get_access_log (latest entries):\n${JSON.stringify(data.logs, null, 2)}`);
  });
}

function openSnapshotModal(visitId, zone) {
  const modal = document.getElementById('modal-snapshot');
  const img = document.getElementById('modal-img');
  const title = document.getElementById('modal-title');

  title.textContent = `Ring Protect Snapshot · ${zone.toUpperCase()} Camera`;
  img.src = `/api/snapshots/${visitId}/${zone}?t=${Date.now()}`;
  modal.classList.add('active');
}

window.addEventListener('DOMContentLoaded', init);
