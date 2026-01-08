// Global variables
let chart = null;
let autoRefreshInterval = null;
let currentToken = null;
let serviceStatusInterval = null;
let globalServiceData = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load saved token if it exists
    const savedToken = localStorage.getItem('mapleai_token');
    if (savedToken) {
        document.getElementById('apiToken').value = savedToken;
        loadData();
    }
    
    // Check service status on load
    checkServiceStatus();
    
    // Periodically check service status
    serviceStatusInterval = setInterval(() => checkServiceStatus(), 60000); // Check every 60 seconds
});

// Check service status (no token required)
async function checkServiceStatus() {
    const statusDot = document.getElementById('serviceStatusDot');
    const statusText = document.getElementById('serviceStatusText');
    const envBadge = document.getElementById('environmentBadge');
    const serviceStatusDiv = document.getElementById('serviceStatus');
    
    try {
        const response = await fetch('https://api.mapleai.de/', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error('Service unavailable');
        }
        
        const data = await response.json();
        
        // Show service status
        serviceStatusDiv.style.display = 'flex';
        statusDot.className = 'status-dot active';
        statusText.textContent = `Service ${data.status} - ${data.requests.toLocaleString()} requests served`;
        envBadge.textContent = data.environment;
        
        // Store global stats for dashboard
        globalServiceData = data;
        
        // Update dashboard if it's visible
        if (document.getElementById('dashboard').style.display !== 'none') {
            updateGlobalStats();
        }
        
    } catch (error) {
        serviceStatusDiv.style.display = 'flex';
        statusDot.className = 'status-dot error';
        statusText.textContent = 'Service unreachable';
        envBadge.textContent = 'offline';
        envBadge.style.background = 'rgba(248, 113, 113, 0.15)';
        envBadge.style.borderColor = 'rgba(248, 113, 113, 0.3)';
        envBadge.style.color = '#fecaca';
        
        console.error('Service status check failed:', error);
    }
}

// Toggle token visibility
function toggleTokenVisibility() {
    const tokenInput = document.getElementById('apiToken');
    const toggleBtn = document.getElementById('tokenToggle');
    
    if (tokenInput.type === 'password') {
        tokenInput.type = 'text';
        toggleBtn.textContent = '🙈';
    } else {
        tokenInput.type = 'password';
        toggleBtn.textContent = '👁️';
    }
}

// Show/hide security details
function showSecurityDetails() {
    document.getElementById('securityDetails').style.display = 'block';
}

function hideSecurityDetails() {
    document.getElementById('securityDetails').style.display = 'none';
}

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
    globalServiceData = null;
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

    // Update Global Stats if available
    if (globalServiceData) {
        updateGlobalStats();
    }

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

// Update global service stats
function updateGlobalStats() {
    const data = globalServiceData;
    if (!data) return;

    const globalStatsHtml = `
        <h3>🌍 Global Service Statistics</h3>
        <div class="global-stats-content">
            <div class="global-stat-item">
                <div class="global-stat-value">${data.requests.toLocaleString()}</div>
                <div class="global-stat-label">Total Requests</div>
            </div>
            <div class="global-stat-item">
                <div class="global-stat-value">${parseInt(data.total_tokens_used).toLocaleString()}</div>
                <div class="global-stat-label">Total Tokens Used</div>
            </div>
            <div class="global-stat-item">
                <div class="global-stat-value">${data.endpoints.length}</div>
                <div class="global-stat-label">Available Endpoints</div>
            </div>
        </div>
    `;
    
    const globalStatsDiv = document.getElementById('globalStats');
    globalStatsDiv.innerHTML = globalStatsHtml;
    globalStatsDiv.style.display = 'block';

    // Update global stats in the stats grid too
    document.getElementById('globalRequests').textContent = data.requests.toLocaleString();
    document.getElementById('globalTokens').textContent = parseInt(data.total_tokens_used).toLocaleString();

    // Update endpoints list
    const endpointsList = document.getElementById('endpointsList');
    const endpointCount = document.getElementById('endpointCount');
    
    endpointsList.innerHTML = data.endpoints.map(endpoint => 
        `<div class="endpoint-item">${endpoint}</div>`
    ).join('');
    
    endpointCount.textContent = `${data.endpoints.length} endpoints available`;
    
    // Show endpoints section
    document.getElementById('endpointsSection').style.display = 'block';
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
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-top: 20px;">
            <div style="text-align: center; background: rgba(15, 23, 42, 0.4); padding: 15px; border-radius: 10px; border: 1px solid rgba(99, 102, 241, 0.2);">
                <div style="font-size: 1.5em; font-weight: 700; color: #f8fafc;">${totalPeriodUsage}</div>
                <div style="font-size: 0.85em; opacity: 0.7; color: #94a3b8;">Total</div>
            </div>
            <div style="text-align: center; background: rgba(15, 23, 42, 0.4); padding: 15px; border-radius: 10px; border: 1px solid rgba(99, 102, 241, 0.2);">
                <div style="font-size: 1.5em; font-weight: 700; color: #f8fafc;">${avgUsage}</div>
                <div style="font-size: 0.85em; opacity: 0.7; color: #94a3b8;">Average</div>
            </div>
            <div style="text-align: center; background: rgba(15, 23, 42, 0.4); padding: 15px; border-radius: 10px; border: 1px solid rgba(99, 102, 241, 0.2);">
                <div style="font-size: 1.5em; font-weight: 700; color: #f8fafc;">${maxUsage}</div>
                <div style="font-size: 0.85em; opacity: 0.7; color: #94a3b8;">Max</div>
            </div>
            <div style="text-align: center; background: rgba(15, 23, 42, 0.4); padding: 15px; border-radius: 10px; border: 1px solid rgba(99, 102, 241, 0.2);">
                <div style="font-size: 1.5em; font-weight: 700; color: #f8fafc;">${trend}</div>
                <div style="font-size: 0.85em; opacity: 0.7; color: #94a3b8;">Trend</div>
            </div>
        </div>
    `;
    
    // Add summary to chart container
    const chartContainer = document.querySelector('.chart-container');
    const existingSummary = chartContainer.querySelector('.chart-summary');
    if (existingSummary) {
        existingSummary.remove();
    }
    
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'chart-summary fade-in';
    summaryDiv.innerHTML = summaryHtml;
    chartContainer.appendChild(summaryDiv);
}

// Show dashboard
function showDashboard() {
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('refreshBtn').style.display = 'flex';
    
    // Also update global stats if we have them
    if (globalServiceData) {
        updateGlobalStats();
    }
}

// Show error
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        hideError();
    }, 5000);
}

// Hide error
function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

// Handle Enter key
document.getElementById('apiToken').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loadData();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    if (serviceStatusInterval) {
        clearInterval(serviceStatusInterval);
    }
});
