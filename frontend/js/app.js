document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // DOM Element References
    // -------------------------------------------------------------------------
    const predictionForm = document.getElementById('predictionForm');
    const resetBtn = document.getElementById('resetBtn');
    const predictBtn = document.getElementById('predictBtn');
    const btnText = predictBtn.querySelector('.btn-text');
    const spinner = predictBtn.querySelector('.spinner');
    const fillSampleBtn = document.getElementById('fillSampleBtn');
    
    const formErrorAlert = document.getElementById('formErrorAlert');
    const formErrorMessage = document.getElementById('formErrorMessage');
    
    const statusDot = document.querySelector('#systemStatusBadge .status-dot');
    const statusText = document.getElementById('statusText');
    
    const resultPlaceholder = document.getElementById('resultPlaceholder');
    const resultContent = document.getElementById('resultContent');
    const resultStatusTag = document.getElementById('resultStatusTag');
    
    const outcomeBox = document.getElementById('outcomeBox');
    const outcomeTitle = document.getElementById('outcomeTitle');
    const outcomeDesc = document.getElementById('outcomeDesc');
    
    const probabilityValue = document.getElementById('probabilityValue');
    const progressBarFill = document.getElementById('progressBarFill');
    const probNegVal = document.getElementById('probNegVal');
    const probPosVal = document.getElementById('probPosVal');
    const summaryChips = document.getElementById('summaryChips');
    const disclaimerText = document.getElementById('disclaimerText');
    
    const historyTableBody = document.getElementById('historyTableBody');
    const historyCount = document.getElementById('historyCount');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    
    // Feature Field IDs
    const featureIds = [
        'n_pregnant', 'glucose', 'tension', 'thickness',
        'insulin', 'bmi', 'pedigree', 'age'
    ];
    
    // Session History State
    let sessionHistory = [];

    // -------------------------------------------------------------------------
    // Health Check Initialization
    // -------------------------------------------------------------------------
    async function checkBackendHealth() {
        try {
            const response = await fetch('/health');
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'healthy') {
                    statusDot.className = 'status-dot healthy';
                    statusText.textContent = 'Backend & Model Ready';
                    return;
                }
            }
            statusDot.className = 'status-dot unhealthy';
            statusText.textContent = 'Service Degraded';
        } catch (err) {
            statusDot.className = 'status-dot unhealthy';
            statusText.textContent = 'Backend Offline';
        }
    }
    checkBackendHealth();

    // -------------------------------------------------------------------------
    // Client-side Validation Logic
    // -------------------------------------------------------------------------
    function validateField(id) {
        const input = document.getElementById(id);
        const errSpan = document.getElementById(`err-${id}`);
        const valStr = input.value.trim();
        
        input.classList.remove('is-invalid');
        errSpan.textContent = '';
        
        if (valStr === '') {
            input.classList.add('is-invalid');
            errSpan.textContent = 'This field is required.';
            return false;
        }
        
        const num = Number(valStr);
        if (isNaN(num)) {
            input.classList.add('is-invalid');
            errSpan.textContent = 'Must be a valid number.';
            return false;
        }
        
        if (num < 0) {
            input.classList.add('is-invalid');
            errSpan.textContent = 'Cannot be negative.';
            return false;
        }

        if ((id === 'n_pregnant' || id === 'age') && !Number.isInteger(num)) {
            input.classList.add('is-invalid');
            errSpan.textContent = 'Must be a whole integer.';
            return false;
        }
        
        return true;
    }

    // Attach real-time input event listeners
    featureIds.forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('input', () => {
            validateField(id);
            if (formErrorAlert.classList.contains('hidden') === false) {
                const allValid = featureIds.every(fid => {
                    const v = document.getElementById(fid).value.trim();
                    return v !== '' && Number(v) >= 0;
                });
                if (allValid) {
                    formErrorAlert.classList.add('hidden');
                }
            }
        });
    });

    function validateAllFields() {
        let isAllValid = true;
        featureIds.forEach(id => {
            const valid = validateField(id);
            if (!valid) isAllValid = false;
        });
        return isAllValid;
    }

    // -------------------------------------------------------------------------
    // Form Submission & API Request
    // -------------------------------------------------------------------------
    predictionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        formErrorAlert.classList.add('hidden');
        
        if (!validateAllFields()) {
            formErrorMessage.textContent = 'Please fix the highlighted invalid fields before predicting.';
            formErrorAlert.classList.remove('hidden');
            return;
        }

        // Build Payload with exact 8 feature names
        const payload = {
            n_pregnant: parseInt(document.getElementById('n_pregnant').value.trim(), 10),
            glucose: parseFloat(document.getElementById('glucose').value.trim()),
            tension: parseFloat(document.getElementById('tension').value.trim()),
            thickness: parseFloat(document.getElementById('thickness').value.trim()),
            insulin: parseFloat(document.getElementById('insulin').value.trim()),
            bmi: parseFloat(document.getElementById('bmi').value.trim()),
            pedigree: parseFloat(document.getElementById('pedigree').value.trim()),
            age: parseInt(document.getElementById('age').value.trim(), 10)
        };

        // UI Loading State
        predictBtn.disabled = true;
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');

        try {
            const response = await fetch('/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                const msg = data.message || (data.details ? data.details.join(', ') : 'Server Error');
                throw new Error(msg);
            }

            // Display Prediction Result
            renderPredictionResult(data, payload);

            // Add to session history
            addToHistory(data, payload);

        } catch (err) {
            formErrorMessage.textContent = `Prediction failed: ${err.message}`;
            formErrorAlert.classList.remove('hidden');
        } finally {
            predictBtn.disabled = false;
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    });

    // -------------------------------------------------------------------------
    // Render Results Card
    // -------------------------------------------------------------------------
    function renderPredictionResult(data, payload) {
        resultPlaceholder.classList.add('hidden');
        resultContent.classList.remove('hidden');

        const isHighRisk = data.prediction === 1;
        const probPosPercent = (data.probabilities.positive * 100).toFixed(1);
        const probNegPercent = (data.probabilities.negative * 100).toFixed(1);

        if (isHighRisk) {
            resultStatusTag.textContent = 'High Risk';
            resultStatusTag.className = 'badge positive';
            
            outcomeBox.className = 'outcome-box high-risk';
            outcomeTitle.textContent = 'High Diabetes Risk Detected';
            outcomeDesc.textContent = 'The ML model evaluated these parameters as indicative of elevated diabetes risk.';
        } else {
            resultStatusTag.textContent = 'Low Risk';
            resultStatusTag.className = 'badge negative';
            
            outcomeBox.className = 'outcome-box low-risk';
            outcomeTitle.textContent = 'Low Diabetes Risk Detected';
            outcomeDesc.textContent = 'The ML model evaluated these parameters as within normal risk ranges.';
        }

        probabilityValue.textContent = `${probPosPercent}% Risk`;
        progressBarFill.style.width = `${probPosPercent}%`;

        probNegVal.textContent = `${probNegPercent}%`;
        probPosVal.textContent = `${probPosPercent}%`;

        if (data.disclaimer) {
            disclaimerText.textContent = data.disclaimer;
        }

        // Render Summary Chips
        summaryChips.innerHTML = `
            <div class="chip">Preg: <strong>${payload.n_pregnant}</strong></div>
            <div class="chip">Glucose: <strong>${payload.glucose}</strong></div>
            <div class="chip">BP: <strong>${payload.tension}</strong></div>
            <div class="chip">Thickness: <strong>${payload.thickness}</strong></div>
            <div class="chip">Insulin: <strong>${payload.insulin}</strong></div>
            <div class="chip">BMI: <strong>${payload.bmi}</strong></div>
            <div class="chip">Pedigree: <strong>${payload.pedigree}</strong></div>
            <div class="chip">Age: <strong>${payload.age}</strong></div>
        `;
    }

    // -------------------------------------------------------------------------
    // Reset Button Handler
    // -------------------------------------------------------------------------
    resetBtn.addEventListener('click', () => {
        predictionForm.reset();
        formErrorAlert.classList.add('hidden');
        
        featureIds.forEach(id => {
            const input = document.getElementById(id);
            const errSpan = document.getElementById(`err-${id}`);
            input.classList.remove('is-invalid');
            if (errSpan) errSpan.textContent = '';
        });

        // Reset Result View
        resultPlaceholder.classList.remove('hidden');
        resultContent.classList.add('hidden');
        resultStatusTag.textContent = 'Awaiting Input';
        resultStatusTag.className = 'badge neutral';
    });

    // -------------------------------------------------------------------------
    // Sample Data Loader
    // -------------------------------------------------------------------------
    fillSampleBtn.addEventListener('click', () => {
        const samples = [
            { n_pregnant: 6, glucose: 148, tension: 72, thickness: 35, insulin: 0, bmi: 33.6, pedigree: 0.627, age: 50 },
            { n_pregnant: 1, glucose: 85, tension: 66, thickness: 29, insulin: 0, bmi: 26.6, pedigree: 0.351, age: 31 },
            { n_pregnant: 8, glucose: 183, tension: 64, thickness: 0, insulin: 0, bmi: 23.3, pedigree: 0.672, age: 32 }
        ];
        const randomSample = samples[Math.floor(Math.random() * samples.length)];
        
        Object.keys(randomSample).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                input.value = randomSample[key];
                validateField(key);
            }
        });
        formErrorAlert.classList.add('hidden');
    });

    // -------------------------------------------------------------------------
    // Session History Management
    // -------------------------------------------------------------------------
    function addToHistory(data, payload) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const historyItem = {
            id: sessionHistory.length + 1,
            time: timeStr,
            payload,
            prediction: data.prediction,
            risk_status: data.risk_status,
            probability: (data.probabilities.positive * 100).toFixed(1)
        };
        
        sessionHistory.unshift(historyItem);
        renderHistoryTable();
    }

    function renderHistoryTable() {
        historyCount.textContent = `${sessionHistory.length} prediction${sessionHistory.length === 1 ? '' : 's'} recorded`;

        if (sessionHistory.length === 0) {
            historyTableBody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="6">No predictions made during this session yet.</td>
                </tr>
            `;
            return;
        }

        historyTableBody.innerHTML = sessionHistory.map(item => {
            const badgeClass = item.prediction === 1 ? 'badge positive' : 'badge negative';
            const payloadSummary = `Gluc: ${item.payload.glucose} | BMI: ${item.payload.bmi} | Age: ${item.payload.age}`;
            
            return `
                <tr>
                    <td>#${item.id}</td>
                    <td>${item.time}</td>
                    <td><code>${payloadSummary}</code></td>
                    <td><span class="${badgeClass}">${item.risk_status}</span></td>
                    <td><strong>${item.probability}%</strong></td>
                    <td>
                        <button type="button" class="btn-sample load-history-btn" data-id="${item.id}" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">
                            Load Values
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach event listeners to load history values
        document.querySelectorAll('.load-history-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'), 10);
                const item = sessionHistory.find(h => h.id === id);
                if (item) {
                    Object.keys(item.payload).forEach(key => {
                        const input = document.getElementById(key);
                        if (input) {
                            input.value = item.payload[key];
                            validateField(key);
                        }
                    });
                    formErrorAlert.classList.add('hidden');
                }
            });
        });
    }

    clearHistoryBtn.addEventListener('click', () => {
        sessionHistory = [];
        renderHistoryTable();
    });
});
