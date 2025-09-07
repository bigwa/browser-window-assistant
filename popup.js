// Popup JavaScript - 分离的外部文件
console.log('Popup script loaded');

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup DOM loaded');
    console.log('Context check - window location:', window.location.href);
    console.log('Context check - parent window:', window.parent === window);
    
    // 初始化国际化
    initializeI18n();
    
    await loadStats();
    setupButtons();
});

// 初始化国际化文本
function initializeI18n() {
    // 获取所有需要国际化的元素
    const i18nElements = document.querySelectorAll('[data-i18n]');
    
    i18nElements.forEach(element => {
        const messageKey = element.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(messageKey);
        if (message) {
            element.textContent = message;
        }
    });
}

// 加载指示器控制函数
function showLoading(message = chrome.i18n.getMessage('processing')) {
    const indicator = document.getElementById('loadingIndicator');
    const text = document.getElementById('loadingText');
    const buttons = document.querySelectorAll('.button');
    
    if (indicator && text) {
        text.textContent = message;
        indicator.style.display = 'flex';
        
        // 禁用所有按钮
        buttons.forEach(btn => btn.disabled = true);
    }
}

function hideLoading() {
    const indicator = document.getElementById('loadingIndicator');
    const buttons = document.querySelectorAll('.button');
    
    if (indicator) {
        indicator.style.display = 'none';
        
        // 启用所有按钮
        buttons.forEach(btn => btn.disabled = false);
    }
}

// 设置按钮事件
function setupButtons() {
    // 保存会话
    document.getElementById('saveNow').addEventListener('click', async () => {
        showLoading(chrome.i18n.getMessage('saving'));
        
        try {
            const response = await chrome.runtime.sendMessage({ action: 'saveSession' });
            
            hideLoading();
            
            if (response && response.success) {
                showStatus(chrome.i18n.getMessage('sessionSaved'), 'success');
                setTimeout(() => loadStats(), 500);
            } else {
                showStatus(chrome.i18n.getMessage('saveFailed') + ': ' + (response ? response.error : chrome.i18n.getMessage('unknownError')), 'error');
            }
        } catch (error) {
            hideLoading();
            console.error('Save error:', error);
            showStatus(chrome.i18n.getMessage('saveFailed') + ': ' + error.message, 'error');
        }
    });
    
    // 保存并关闭浏览器窗口
    document.getElementById('saveAndClose').addEventListener('click', async () => {
        // 显示确认对话框
        const confirmed = confirm(chrome.i18n.getMessage('confirmSaveAndClose'));
        
        if (!confirmed) {
            console.log('User cancelled save and close operation');
            return; // 用户取消操作
        }
        
        console.log('User confirmed save and close operation');
        
        showLoading(chrome.i18n.getMessage('saving'));
        
        try {
            // 获取当前窗口ID
            let currentWindowId;
            try {
                const currentWindow = await chrome.windows.getCurrent();
                currentWindowId = currentWindow.id;
                console.log('Got current window ID:', currentWindowId);
            } catch (error) {
                console.log('Cannot get current window ID:', error);
            }
            
            console.log('Sending saveAndCloseAllTabs message with windowId:', currentWindowId);
            
            const response = await chrome.runtime.sendMessage({ 
                action: 'saveAndCloseAllTabs',
                windowId: currentWindowId
            });
            
            console.log('Received response:', response);
            
            hideLoading();
            
            if (response && response.success) {
                const closedCount = response.closedTabs || 0;
                const remainingCount = response.remainingTabs || 0;
                const successMsg = `已保存会话！关闭了 ${closedCount} 个标签页，剩余 ${remainingCount} 个标签页`;
                showStatus(successMsg, 'success');
                console.log('Save and close completed:', response);
                // popup会随标签页关闭而关闭
            } else {
                showStatus(chrome.i18n.getMessage('saveFailed') + ': ' + (response ? response.error : chrome.i18n.getMessage('unknownError')), 'error');
            }
        } catch (error) {
            hideLoading();
            console.error('Save and close window error:', error);
            showStatus(chrome.i18n.getMessage('saveFailed') + ': ' + error.message, 'error');
        }
    });
    
    // 恢复快照
    document.getElementById('restoreSnapshot').addEventListener('click', async () => {
        showLoading(chrome.i18n.getMessage('restoring'));
        
        try {
            const response = await chrome.runtime.sendMessage({ action: 'restoreSnapshot' });
            
            hideLoading();
            
            if (response && response.success) {
                let message;
                if (response.tabsCount === 0 && response.skippedCount > 0) {
                    message = response.message || chrome.i18n.getMessage('allTabsAlreadyOpen');
                } else if (response.tabsCount === 0 && response.skippedCount === 0) {
                    message = response.message || chrome.i18n.getMessage('noValidTabs');
                } else if (response.message) {
                    message = response.message;
                } else {
                    message = chrome.i18n.getMessage('restoreSuccess', [response.tabsCount.toString()]);
                }
                
                showStatus(message, response.tabsCount > 0 ? 'success' : 'info');
                
                // 根据结果调整关闭时间
                const closeDelay = response.tabsCount > 0 ? 2000 : 3000;
                setTimeout(() => {
                    // 安全关闭控制面板
                    try {
                        window.close();
                    } catch (error) {
                        console.log('Failed to close popup:', error);
                        document.body.style.display = 'none';
                    }
                }, closeDelay);
            } else if (response && (response.noSnapshot || response.emptySnapshot)) {
                // 显示友好的提示信息，不关闭弹窗
                showStatus(response.message, 'info');
                console.log('No snapshot available, showing friendly prompt');
            } else {
                showStatus(chrome.i18n.getMessage('restoreFailed') + ': ' + (response ? response.error : '未知错误'), 'error');
            }
        } catch (error) {
            hideLoading();
            console.error('Restore error:', error);
            showStatus(chrome.i18n.getMessage('restoreFailed') + ': ' + error.message, 'error');
        }
    });
    
    // 查看快照
    document.getElementById('viewSnapshot').addEventListener('click', async () => {
        showLoading(chrome.i18n.getMessage('loading'));
        
        try {
            const response = await chrome.runtime.sendMessage({ action: 'openSnapshot' });
            
            hideLoading();
            
            if (response && response.success) {
                // 安全关闭控制面板
                try {
                    window.close();
                } catch (error) {
                    console.log('Failed to close popup:', error);
                    document.body.style.display = 'none';
                }
            } else {
                showStatus(chrome.i18n.getMessage('openSnapshotFailed') + ': ' + (response ? response.error : chrome.i18n.getMessage('unknownError')), 'error');
            }
        } catch (error) {
            hideLoading();
            console.error('Open error:', error);
            showStatus(chrome.i18n.getMessage('openSnapshotFailed') + ': ' + error.message, 'error');
        }
    });
    
    // 生成历史快照
    document.getElementById('generateHistorySnapshot').addEventListener('click', async () => {
        await generateHistorySnapshot();
    });
}

// 加载统计信息
async function loadStats() {
    try {
        // 获取当前标签页和窗口
        const windows = await chrome.windows.getAll({ populate: true });
        let totalTabs = 0;
        
        windows.forEach(window => {
            window.tabs.forEach(tab => {
                if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                    totalTabs++;
                }
            });
        });
        
        document.getElementById('currentTabs').textContent = totalTabs;
        document.getElementById('currentWindows').textContent = windows.length;
        
        // 获取上次保存时间
        const stored = await chrome.storage.local.get(['lastSession']);
        if (stored.lastSession && stored.lastSession.timestamp) {
            const lastSaved = new Date(stored.lastSession.timestamp);
            document.getElementById('lastSaved').textContent = formatTime(lastSaved);
        } else {
            document.getElementById('lastSaved').textContent = chrome.i18n.getMessage('neverSaved');
        }
        
    } catch (error) {
        console.error('Load stats error:', error);
        showStatus(chrome.i18n.getMessage('loadStatsFailed'), 'error');
    }
}


// 显示状态消息
function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
    
    // 3秒后隐藏
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// 格式化时间
function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return chrome.i18n.getMessage('timeAgo', [days.toString(), chrome.i18n.getMessage('days')]);
    }
    if (hours > 0) {
        return chrome.i18n.getMessage('timeAgo', [hours.toString(), chrome.i18n.getMessage('hours')]);
    }
    if (minutes > 0) {
        return chrome.i18n.getMessage('timeAgo', [minutes.toString(), chrome.i18n.getMessage('minutes')]);
    }
    return chrome.i18n.getMessage('justNow');
}

// 生成历史快照
async function generateHistorySnapshot() {
    try {
        showLoading(chrome.i18n.getMessage('processing'));
        
        // 发送消息给background script来生成历史快照
        const response = await chrome.runtime.sendMessage({
            action: 'generateHistorySnapshot'
        });
        
        hideLoading();
        
        if (response.success) {
            showStatus(chrome.i18n.getMessage('historyAnalyzeComplete'), 'success');
            
            // 打开历史快照页面
            setTimeout(() => {
                chrome.tabs.create({
                    url: response.historySnapshotUrl
                });
                window.close();
            }, 1000);
        } else {
            console.error('History snapshot generation failed:', response);
            const errorMsg = response.error || chrome.i18n.getMessage('historyAnalyzeFailed');
            showStatus(errorMsg, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Generate history snapshot error:', error);
        const errorMsg = error.message || chrome.i18n.getMessage('historyAnalyzeFailed');
        showStatus(errorMsg, 'error');
    }
}