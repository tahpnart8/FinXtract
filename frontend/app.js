/**
 * FinXtract — Client v2.0
 * ================================
 * Orchestrates: Config → Upload → Gemini AI Extraction → Excel Download
 */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8002'
    : '';  // On Vercel: use same-origin proxy (vercel.json rewrites /api/* → Render)

const MAX_DAILY_REQUESTS = 50;

// ── DOM Elements ──────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const el = {
    form: $('bctcForm'),
    tickerInput: $('tickerInput'),
    periodType: $('periodType'),
    aiModelSelect: $('aiModelSelect'),
    quarterFrom: $('quarterFrom'),
    yearFrom: $('yearFrom'),
    quarterTo: $('quarterTo'),
    yearTo: $('yearTo'),
    formSection: $('formSection'),
    uploadSection: $('uploadSection'),
    progressSection: $('progressSection'),
    resultSection: $('resultSection'),
    uploadContainer: $('uploadContainer'),
    processAiBtn: $('processAiBtn'),
    backToConfigBtn: $('backToConfigBtn'),
    progressFill: $('progressFill'),
    progressText: $('progressText'),
    progressMessage: $('progressMessage'),
    downloadBtn: $('downloadBtn'),
    newQueryBtn: $('newQueryBtn'),
    serverStatus: $('serverStatus'),
    statusDot: $('statusDot'),
    apiUsageBadge: $('apiUsageBadge'),
    apiUsageText: $('apiUsageText'),
    stepsNav: $('stepsNav'),
    resultSummary: $('resultSummary'),

};

let config = {};

// ── Initialize ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    checkHealth();
    fetchUsageCount();

    // Init tsParticles
    tsParticles.load("tsparticles", {
        fpsLimit: 60,
        particles: {
            number: { value: 60, density: { enable: true, value_area: 800 } },
            color: { value: ["#22c55e", "#4ade80", "#3b82f6"] },
            shape: { type: "circle" },
            opacity: { value: 0.4, random: true, anim: { enable: true, speed: 1, opacity_min: 0.1, sync: false } },
            size: { value: 3, random: true, anim: { enable: true, speed: 2, size_min: 0.1, sync: false } },
            links: { enable: true, distance: 150, color: "#94a3b8", opacity: 0.3, width: 1 },
            move: { enable: true, speed: 1.5, direction: "none", random: true, straight: false, out_mode: "out", bounce: false, attract: { enable: false, rotateX: 600, rotateY: 1200 } }
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: { enable: true, mode: "grab" },
                onclick: { enable: true, mode: "repulse" },
                resize: true
            },
            modes: {
                grab: { distance: 200, links: { opacity: 0.6 } },
                repulse: { distance: 250, duration: 0.4 }
            }
        },
        retina_detect: true
    });
});

// ── Health Check ──────────────────────────────────────────────────────────────

async function checkHealth() {
    try {
        const resp = await fetch(`${API_BASE}/health`);
        if (resp.ok) {
            el.serverStatus.textContent = 'Server online';
            el.statusDot.classList.add('online');
        }
    } catch {
        el.serverStatus.textContent = 'Server offline';
        el.statusDot.classList.remove('online');
    }
}

// ── API Usage Counter (Global Sync) ───────────────────────────────────────────

let currentUsage = 0;

async function fetchUsageCount() {
    try {
        const resp = await fetch(`${API_BASE}/api/jobs/quota/usage`);
        if (resp.ok) {
            const data = await resp.json();
            currentUsage = data.used;
            updateApiUsageUI();
        }
    } catch (e) {
        console.error("Failed to fetch quota", e);
    }
}

function updateApiUsageUI() {
    el.apiUsageText.textContent = `${currentUsage} / ${MAX_DAILY_REQUESTS}`;
    el.apiUsageBadge.classList.remove('warning', 'danger');
    if (currentUsage >= MAX_DAILY_REQUESTS) {
        el.apiUsageBadge.classList.add('danger');
    } else if (currentUsage >= 40) {
        el.apiUsageBadge.classList.add('warning');
    }
}

async function canMakeRequests(count) {
    await fetchUsageCount(); // Luôn lấy số liệu mới nhất trước khi trích xuất
    if (currentUsage + count > MAX_DAILY_REQUESTS) {
        const remaining = Math.max(0, MAX_DAILY_REQUESTS - currentUsage);
        alert(`⚠️ Giới hạn hệ thống: Chỉ còn ${remaining} lượt trích xuất hôm nay.\n\nBạn đang yêu cầu ${count} file nhưng hệ thống chỉ còn ${remaining} lượt. Vui lòng giảm số file hoặc đợi sang ngày mai.`);
        return false;
    }
    return true;
}

// ── Navigation & Steps & State ────────────────────────────────────────────────

function saveState(sectionId, extraData = {}) {
    const state = {
        sectionId,
        config,
        ...extraData
    };
    sessionStorage.setItem('finxtract_state', JSON.stringify(state));
}

function restoreState() {
    try {
        const saved = sessionStorage.getItem('finxtract_state');
        if (saved) {
            const state = JSON.parse(saved);
            config = state.config || {};
            if (state.sectionId === 'uploadSection') {
                generateUploadInputs();
            } else if (state.sectionId === 'resultSection' && state.htmlPreview) {
                $('previewContainer').innerHTML = state.htmlPreview;
                el.downloadBtn.onclick = () => window.open(state.downloadUrl, '_blank');
                el.resultSummary.textContent = state.resultSummary;
            }
            showSection(state.sectionId, false);
        }
    } catch (e) {
        console.error("Failed to restore state", e);
    }
}

function showSection(id, shouldSave = true) {
    [el.formSection, el.uploadSection, el.progressSection, el.resultSection]
        .forEach(s => s.classList.add('hidden'));
    $(id).classList.remove('hidden');

    if (id === 'resultSection') {
        // Show modal and prevent body scrolling
        $(id).classList.add('fullscreen');
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }

    if (shouldSave) {
        let extra = {};
        if (id === 'resultSection') {
            extra.htmlPreview = $('previewContainer').innerHTML;
            extra.resultSummary = el.resultSummary.textContent;
            // Hack to get downloadUrl from onclick
            const clickStr = el.downloadBtn.onclick ? el.downloadBtn.onclick.toString() : '';
            const match = clickStr.match(/window\.open\((['"`])(.*?)\1/);
            if (match) extra.downloadUrl = match[2];
        }
        saveState(id, extra);
    }

    // Update step indicator
    const stepMap = { 'formSection': 1, 'uploadSection': 2, 'progressSection': 3, 'resultSection': 4 };
    const current = stepMap[id] || 1;
    el.stepsNav.querySelectorAll('.step-item').forEach(item => {
        const step = parseInt(item.dataset.step);
        item.classList.remove('active', 'done');
        if (step === current) item.classList.add('active');
        else if (step < current) item.classList.add('done');
    });
}

// ── Step 1: Config ────────────────────────────────────────────────────────────

function toggleQuarterInputs() {
    const isQuarter = el.periodType.value === 'quarter';
    if (el.quarterFrom) el.quarterFrom.classList.toggle('hidden', !isQuarter);
    if (el.quarterTo) el.quarterTo.classList.toggle('hidden', !isQuarter);
}

el.periodType.addEventListener('change', toggleQuarterInputs);
// Ensure correct state on load if browser remembers form inputs
document.addEventListener('DOMContentLoaded', () => {
    toggleQuarterInputs();
});

el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    config = {
        ticker: el.tickerInput.value.trim().toUpperCase(),
        period: el.periodType.value,
        aiModel: el.aiModelSelect ? el.aiModelSelect.value : 'gemini-3.1-flash-lite',
        from: parseInt(el.yearFrom.value),
        to: parseInt(el.yearTo.value),
        qFrom: parseInt(el.quarterFrom.value),
        qTo: parseInt(el.quarterTo.value)
    };

    if (config.period === 'year') {
        if (config.from > config.to) {
            alert('Năm bắt đầu không được lớn hơn năm kết thúc.');
            return;
        }
    } else {
        if (config.from > config.to || (config.from === config.to && config.qFrom > config.qTo)) {
            alert('Kỳ bắt đầu không được lớn hơn kỳ kết thúc.');
            return;
        }
    }

    generateUploadInputs();
    showSection('uploadSection');
});

// ── Step 2: Upload ────────────────────────────────────────────────────────────

function generateUploadInputs() {
    el.uploadContainer.innerHTML = '';
    const periods = [];
    if (config.period === 'year') {
        for (let y = config.from; y <= config.to; y++) {
            periods.push(String(y));
        }
    } else {
        for (let y = config.from; y <= config.to; y++) {
            let startQ = (y === config.from) ? config.qFrom : 1;
            let endQ = (y === config.to) ? config.qTo : 4;
            for (let q = startQ; q <= endQ; q++) {
                periods.push(`${y}-Q${q}`);
            }
        }
    }

    config.periodsList = periods;

    periods.forEach(label => {
        const row = document.createElement('div');
        row.className = 'upload-row';
        row.innerHTML = `
            <div class="year-label">
                <i data-lucide="file-text"></i>
                Kỳ: ${label}
            </div>
            <div class="file-name">Kéo thả file PDF vào đây hoặc Click</div>
            <input type="file" accept="application/pdf" class="pdf-input" data-period="${label}">
        `;

        const fileInput = row.querySelector('.pdf-input');
        const nameDisplay = row.querySelector('.file-name');

        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            row.classList.add('dragover');
        });
        row.addEventListener('dragleave', () => {
            row.classList.remove('dragover');
        });
        row.addEventListener('drop', (e) => {
            row.classList.remove('dragover');
            // Browser handles the file drop to <input type="file"> natively if dropped exactly on the invisible input.
            // But just in case, we visually update it via the change event.
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                row.classList.add('has-file');
                nameDisplay.innerHTML = `<i data-lucide="check-circle" style="width:14px;height:14px"></i> ${e.target.files[0].name}`;
                lucide.createIcons();
            } else {
                row.classList.remove('has-file');
                nameDisplay.textContent = 'Kéo thả file PDF vào đây hoặc Click';
            }
        });

        el.uploadContainer.appendChild(row);
    });

    lucide.createIcons();
}

el.backToConfigBtn.addEventListener('click', () => showSection('formSection'));

// ── Step 3: AI Extraction (Async Polling) ─────────────────────────────────────

async function warmupServer() {
    el.progressMessage.textContent = 'Đang kết nối server… (có thể mất 30-60s)';
    el.progressFill.style.width = '5%';
    el.progressText.textContent = '5%';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        await fetch(`${API_BASE}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
    } catch (e) {
        throw new Error('Không thể kết nối tới server. Vui lòng đợi 1-2 phút rồi thử lại.');
    }
}

/**
 * Poll job status until done or error (max 5 minutes per job).
 */
async function pollJobResult(jobId, periodLabel) {
    const maxPollTime = 5 * 60 * 1000; // 5 minutes
    const pollInterval = 3000; // 3 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollTime) {
        await new Promise(r => setTimeout(r, pollInterval));

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        el.progressMessage.textContent = `Hệ thống đang trích xuất báo cáo tài chính ${ periodLabel }…(${ elapsed }s)`;

        try {
            const resp = await fetch(`${API_BASE}/api/jobs/status/${jobId}`);
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.detail || `Server trả về lỗi ${ resp.status } `);
            }

            const job = await resp.json();

            if (job.status === 'done') {
                return { period: job.period, data: job.data };
            }
            if (job.status === 'error') {
                throw new Error(job.detail || 'Lỗi không xác định từ AI');
            }
            // status === 'processing' → keep polling
        } catch (err) {
            if (err.message.includes('Failed to fetch')) {
                // Network blip, keep trying
                continue;
            }
            throw err;
        }
    }

    throw new Error(`Quá thời gian chờ(5 phút).Gemini API phản hồi quá chậm cho file ${ periodLabel }.`);
}

el.processAiBtn.addEventListener('click', async () => {
    const inputs = document.querySelectorAll('.pdf-input');
    const files = [];

    for (const input of inputs) {
        if (input.files.length > 0) {
            files.push({ period: input.dataset.period, file: input.files[0] });
        }
    }

    if (files.length === 0) {
        alert('Vui lòng chọn ít nhất 1 file PDF.');
        return;
    }

    if (!canMakeRequests(files.length)) return;

    showSection('progressSection');

    // Warmup server
    try {
        await warmupServer();
    } catch (err) {
        alert(err.message);
        showSection('uploadSection');
        return;
    }

    const allData = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
        const item = files[i];
        const basePct = Math.round((i / total) * 90) + 5;
        el.progressFill.style.width = `${ basePct }% `;
        el.progressText.textContent = `${ basePct }% `;
        el.progressMessage.textContent = `Đang upload PDF năm ${ item.period }… (${ i + 1 }/${total})`;

        try {
            // 1. Submit PDF (fast, returns job_id in < 2 seconds)
            const fd = new FormData();
            fd.append('ticker', config.ticker);
            fd.append('period', item.period);
            fd.append('ai_model', config.aiModel);
            fd.append('file', item.file);

            const submitResp = await fetch(`${API_BASE}/api/jobs/extract-pdf`, {
                method: 'POST',
                body: fd,
            });

            if (!submitResp.ok) {
                const errText = await submitResp.text();
                let detail = 'Lỗi upload file';
                try { detail = JSON.parse(errText).detail; } catch { }
                throw new Error(detail);
            }

            const { job_id } = await submitResp.json();

            // 2. Poll for result (handles the long Gemini processing)
            const result = await pollJobResult(job_id, item.period);
            allData.push(result);

            await fetchUsageCount();
        } catch (err) {
            alert(`Lỗi khi xử lý năm ${ item.period }: ${ err.message } `);
            showSection('uploadSection');
            return;
        }
    }

    // Generate Excel
    el.progressFill.style.width = '95%';
    el.progressText.textContent = '95%';
    el.progressMessage.textContent = 'Đang tạo file Excel…';

    try {
        const resp = await fetch(`${API_BASE}/api/jobs/generate-excel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker: config.ticker,
                periods: config.periodsList,
                yearly_data: allData,
            }),
        });

        if (!resp.ok) throw new Error('Lỗi khi tạo Excel');
        const data = await resp.json();

        el.progressFill.style.width = '100%';
        el.progressText.textContent = '100%';

        const downloadUrl = `${API_BASE}${data.download_url}`;
        await renderPreview(downloadUrl);

        el.resultSummary.textContent = `Đã trích xuất ${ allData.length } kỳ báo cáo cho ${ config.ticker } `;
        showSection('resultSection');
        el.downloadBtn.onclick = () => window.open(downloadUrl, '_blank');
    } catch (err) {
        alert('Lỗi tạo Excel: ' + err.message);
        showSection('uploadSection');
    }
});

// ── Step 4: Result Preview ────────────────────────────────────────────────────

async function renderPreview(fileUrl) {
    const container = $('previewContainer');
    container.innerHTML = '<p style="padding:16px;color:var(--text-muted)">Đang tải preview…</p>';

    try {
        const resp = await fetch(fileUrl);
        const buf = await resp.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const html = XLSX.utils.sheet_to_html(ws);

        const doc = new DOMParser().parseFromString(html, 'text/html');
        const table = doc.querySelector('table');

        if (table) {
            container.innerHTML = '';
            container.appendChild(table);
        }
    } catch {
        container.innerHTML = '<p style="padding:16px;color:var(--red-500)">Không thể load preview. Vui lòng tải file trực tiếp.</p>';
    }
}

// ── Event Listeners ───────────────────────────────────────────────────────────

if ($('closeFullscreenBtn')) {
    $('closeFullscreenBtn').addEventListener('click', () => {
        el.resultSection.classList.remove('fullscreen');
        saveState('resultSection', {
            htmlPreview: $('previewContainer').innerHTML,
            resultSummary: el.resultSummary.textContent
        });
    });
}

el.newQueryBtn.addEventListener('click', () => {
    sessionStorage.removeItem('finxtract_state');
    showSection('formSection');
    el.tickerInput.value = '';
});

// Restore state on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(restoreState, 100);
});
