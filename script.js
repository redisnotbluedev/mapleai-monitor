let chart = null;
let autoRefreshInterval = null;
let currentToken = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('mapleai_token');
    if (savedToken) {
        document.getElementById('apiToken').value = savedToken;
        loadData();
    }
});

// Load data with token
async function loadData() {
    const token = document.getElementById('apiToken').value.trim();
    if (!token) {
        showError('Please enter your API token');
        return;
    }

    currentToken = token;
    localStorage.setItem('mapleai_token', token);
    
    const loadBtn = document.getElementById('loadBtnText');
    const spinner = document.getElementById('loadSpinner');
    loadBtn.style.display = 'none';
    spinner.style.display = 'inline-block';

    await fetchData();
    
    loadBtn.style.display = 'inline';
    spinner.style.display = 'none';
}

// Clear token
function clearToken() {
    document.getElementById('apiToken').value = '';
    localStorage.removeItem('mapleai_token');
    currentToken = null;
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('refreshBtn').style.display = 'none';
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Fetch data from API
async function fetchData() {
    if (!currentToken) return;

    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    statusDot.className = 'status-dot loading';
    statusText.textContent = 'Loading...';

    try {
        const [keyInfo, usageHistory] = await Promise.all([
            fetch('https://api.mapleai.de/v1/key-info', {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            }),
            fetch('https://api.mapleai.de/v1/usage-history', {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            })
        ]);

        if (!keyInfo.ok || !usageHistory.ok) {
            throw new Error('API request failed. Please check your token.');
        }

        const keyData = await keyInfo.json();
        const usageData = await usageHistory.json();

        updateDashboard(keyData, usageData);
        showDashboard();
        hideError();
        
        statusDot.className = 'status-dot active';
        statusText.textContent = 'Live';
        
        // Start auto refresh
        if (!autoRefreshInterval) {
            autoRefreshInterval = setInterval(() => fetchData(), 30000); // Refresh every 30 seconds
        }
    } catch (error) {
        showError(error.message);
        statusDot.className = 'status-dot error';
        statusText.textContent = 'Error';
    }
}

// Refresh data manually
function refreshData() {
    const btn = document.getElementById('refreshBtn');
    btn.style.transform = 'rotate(360deg)';
    setTimeout(() => {
        btn.style.transform = 'rotate(0deg)';
    }, 500);
    
    fetchData();
}

// Update dashboard with data
function updateDashboard(keyData, usageData) {
    // Update user info
    const userInfoHtml = `
        <h2>👤 User: ${keyData.username} 
            <span class="plan-badge">${keyData.plan}</span>
            ${keyData.admin ? '<span style="margin-left: 10px;">👑</span>' : ''}
        </h2>
        <div class="user-details">
            <div class="user-detail-item">
                <div class="user-detail-label">Username</div>
                <div class="user-detail-value">@${keyData.username}</div>
            </div>
            <div class="user-detail-item">
                <div class="user-detail-label">Plan</div>
                <div class="user-detail-value">${keyData.plan}</div>
            </div>
            <div class="user-detail-item">
                <div class="user-detail-label">Admin Status</div>
                <div class="user-detail-value">${keyData.admin ? 'Yes' : 'No'}</div>
            </div>
        </div>
        ${keyData.banned ? `
            <div class="ban-info">
                <h3>⛔ Account Banned</h3>
                <p><strong>Reason:</strong> ${keyData.ban_reason || 'Not specified'}</p>
                <p><strong>Expires:</strong> ${keyData.ban_expires || 'Never'}</p>
            </div>
        ` : ''}
    `;
    document.getElementById('userInfo').innerHTML = userInfoHtml;
    document.getElementById('userInfo').className = `user-info ${keyData.admin ? 'admin' : ''} fade-in`;

    // Update RPM
    updateRateCard('rpm', keyData.rpm, keyData.rpm_used, 'RPM');
    
    // Update RPD
    updateRateCard('rpd', keyData.rpd, keyData.rpd_used, 'RPD');

    // Update total usage
    document.getElementById('totalUsage').textContent = keyData.total_usage.toLocaleString();
    document.getElementById('totalTokens').textContent = parseInt(keyData.total_tokens_used).toLocaleString();

    // Update usage history chart
    updateChart(usageData);

    // Update last update time
    document.getElementById('lastUpdate').textContent = `Last updated: ${new Date().toLocaleString()}`;
}

// Update rate card (RPM/RPD)
function updateRateCard(type, limit, used, label) {
    const isUnlimited = limit === 'unlimited';
    const card = document.getElementById(`${type}Card`);
    const badge = document.getElementById(`${type}Badge`);
    const value = document.getElementById(`${type}Value`);
    const progress = document.getElementById(`${type}Progress`);
    const fill = document.getElementById(`${type}Fill`);
    const text = document.getElementById(`${type}Text`);

    if (isUnlimited) {
        card.className = 'stat-card infinite';
        badge.textContent = '♾️ Unlimited';
        badge.className = 'usage-badge infinite';
        value.textContent = '∞';
        progress.style.display = 'none';
    } else {
        const limitNum = parseInt(limit);
        const usedNum = parseInt(used);
        const percentage = (usedNum / limitNum) * 100;
        
        card.className = 'stat-card';
        badge.textContent = label;
        badge.className = `usage-badge ${percentage > 80 ? 'limited' : ''}`;
        value.textContent = `${usedNum} / ${limitNum}`;
        
        progress.style.display = 'block';
        fill.style.width = `${Math.min(percentage, 100)}%`;
        
        if (percentage > 90) {
            fill.style.background = 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)';
            fill.style.boxShadow = '0 0 10px rgba(248, 113, 113, 0.3)';
        } else if (percentage > 70) {
            fill.style.background = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
            fill.style.boxShadow = '0 0 10px rgba(251, 191, 36, 0.3)';
        } else {
            fill.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
            fill.style.boxShadow = '0 0 10px rgba(139, 92, 246, 0.3)';
        }
        
        text.textContent = `${percentage.toFixed(1)}% used`;
    }
}

// Update chart
function updateChart(usageData) {
    const ctx = document.getElementById('usageChart').getContext('2d');
    
    // Calculate total usage for the period
    const totalPeriodUsage = usageData.data.reduce((a, b) => a + b, 0);
    const avgUsage = (totalPeriodUsage / usageData.data.length).toFixed(1);
    const maxUsage = Math.max(...usageData.data);
    const minUsage = Math.min(...usageData.data);
    const trend = usageData.data[usageData.data.length - 1] > usageData.data[0] ? '📈' : '📉';

    // Format labels
    const labels = usageData.labels.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily API Usage',
                data: usageData.data,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 4,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: '#8b5cf6',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    borderWidth: 1,
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Usage: ${context.parsed.y} requests`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        callback: function(value) {
                            return value + ' req';
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });

    // Add summary stats
    const summaryHtml = `
        <div style="display:
